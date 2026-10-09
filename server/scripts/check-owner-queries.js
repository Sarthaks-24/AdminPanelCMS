const fs = require('node:fs');
const path = require('node:path');

const roots = ['controllers', 'routes', 'scripts', 'lib', 'middleware', 'plugins'];
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith('.js')) {
      if (entry.name === 'check-owner-queries.js') continue;
      const source = fs.readFileSync(fullPath, 'utf8');
      const relative = path.relative(process.cwd(), fullPath);
      const normalized = relative.replace(/\\/g, '/');
      const migrationExempt = normalized === 'scripts/migrate-legacy-tenancy.js' &&
        source.includes('ownerGuard-exemption: legacy tenant migration requires native collection updates');
      if (/\.collection\b/.test(source) && !migrationExempt) violations.push(`${relative}: raw collection access bypasses ownerGuard`);
      const nativeDbExemptions = {
        'scripts/migrate-legacy-tenancy.js': 'ownerGuard-exemption: legacy tenant migration requires native collection updates',
        'scripts/audit-db.js': 'ownerGuard-exemption: read-only database inventory uses native commands',
        'scripts/setup-db.js': 'ownerGuard-exemption: setup preflight and confirmed fresh cleanup use native database APIs',
        'scripts/prepare-production-db.js': 'ownerGuard-exemption: production setup preflight uses native database metadata only',
        'scripts/db-stats.js': 'ownerGuard-exemption: db stats utility uses native database stats and collection inventory',
        'scripts/verify-backup-restore.js': 'ownerGuard-exemption: restore drill is constrained to a confirmed, local disposable database',
      };
      const nativeDbExempt = nativeDbExemptions[normalized] && source.includes(nativeDbExemptions[normalized]);
      if (/mongoose\.connection\.db\b/.test(source) && !nativeDbExempt) violations.push(`${relative}: native database access bypasses ownerGuard`);
      const bulkWriteImplementationExempt = normalized === 'plugins/ownerGuard.js' &&
        source.includes('ownerGuard-implementation-exemption: validated scopedBulkWrite wrapper');
      if (/\.bulkWrite\s*\(/.test(source) && !bulkWriteImplementationExempt) violations.push(`${relative}: use scopedBulkWrite instead of bulkWrite`);
      const identityLookupExempt = normalized === 'middleware/requireSession.js' &&
        source.includes('ownerGuard-exemption: User is an identity lookup, not tenant content');
      if (/\.findById(?:AndUpdate|AndDelete|AndRemove|AndReplace)?\s*\(/.test(source) && !identityLookupExempt) {
        violations.push(`${relative}: use an explicit owner filter instead of findById*`);
      }
    }
  }
}

for (const root of roots) walk(path.join(__dirname, '..', root));
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Owner query static checks passed.');
}
