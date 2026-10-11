const fs = require('node:fs');
const path = require('node:path');

// Static backstop for ownerGuard: flags code paths that bypass the Mongoose query hooks.
//
// Exemptions are per line, never per file. A flagged line passes only when it, or the comment block directly
// above it (consecutive `//` lines with nothing in between), carries `ownerGuard-exemption: <reason>`. A script
// with many native calls in one place may wrap them in
//   // ownerGuard-exemption-begin: <reason>
//   ...
//   // ownerGuard-exemption-end
// The reason is mandatory (at least 10 characters). Usage: node scripts/check-owner-queries.js [--root <dir>]...
const SERVER_ROOT = path.join(__dirname, '..');
const DEFAULT_ROOTS = ['controllers', 'routes', 'scripts', 'lib', 'middleware', 'plugins', 'models'].map((dir) => path.join(SERVER_ROOT, dir));

const RULES = [
  { pattern: /\.collection\b/, message: 'raw collection access bypasses ownerGuard' },
  { pattern: /\.connection\.db\b/, message: 'native database access bypasses ownerGuard' },
  { pattern: /\.getClient\s*\(/, message: 'native client access bypasses ownerGuard' },
  { pattern: /\.bulkWrite\s*\(/, message: 'use scopedBulkWrite instead of bulkWrite' },
  { pattern: /\.findById(?:AndUpdate|AndDelete|AndRemove|AndReplace)?\s*\(/, message: 'use an explicit owner filter instead of findById*' },
  { pattern: /\[\s*['"`](?:collection|collections|db|getClient|bulkWrite|findById\w*)['"`]\s*\]/, message: 'bracket access to a guarded API bypasses ownerGuard' },
];

const MARKER = /ownerGuard-(?:implementation-)?exemption:\s*(.{10,})/;
const BEGIN = /ownerGuard-exemption-begin:\s*(.{10,})/;
const END = /ownerGuard-exemption-end\b/;
const isComment = (line) => /^\s*\/\//.test(line);

function lintSource(source, relative) {
  const violations = [];
  const lines = source.split(/\r?\n/);
  let region = false;
  lines.forEach((line, index) => {
    if (BEGIN.test(line)) { region = true; return; }
    if (END.test(line)) { region = false; return; }
    if (isComment(line)) return;
    const rule = RULES.find(({ pattern }) => pattern.test(line));
    if (!rule || region || MARKER.test(line)) return;
    for (let above = index - 1; above >= 0 && isComment(lines[above]); above -= 1) {
      if (MARKER.test(lines[above])) return;
    }
    violations.push(`${relative}:${index + 1}: ${rule.message}`);
  });
  if (region) violations.push(`${relative}: ownerGuard-exemption-begin without a matching ownerGuard-exemption-end`);
  return violations;
}

function walk(dir, violations) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, violations);
    else if (entry.name.endsWith('.js') && fullPath !== __filename) {
      const relative = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
      violations.push(...lintSource(fs.readFileSync(fullPath, 'utf8'), relative));
    }
  }
}

function main(argv = process.argv.slice(2)) {
  const roots = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === '--root' && argv[i + 1]) roots.push(path.resolve(argv[(i += 1)]));
  const violations = [];
  for (const root of roots.length ? roots : DEFAULT_ROOTS) walk(root, violations);
  if (violations.length) {
    console.error(violations.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Owner query static checks passed.');
  }
}

if (require.main === module) main();

module.exports = { lintSource, RULES };
