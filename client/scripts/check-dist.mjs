#!/usr/bin/env node
/**
 * Checks the production build in dist/. Runs after `vite build` (npm run build).
 *
 *   1. dist/_headers exists and carries a CSP with frame-ancestors 'none';
 *   2. every inline <script> in dist/index.html is allowed by a 'sha256-…' source in that CSP, so a
 *      change to the theme script cannot silently break the page under the CSP;
 *   3. dist/_redirects answers /v1 and /api with 404 before the SPA catch-all;
 *   4. nothing from the internal operator runbooks reached the public bundle (connection strings,
 *      secret names, the superadmin grant script).
 *
 * `node scripts/check-dist.mjs --print-hash` prints the hash of the inline script in index.html
 * (the source file, not the build) for pasting into public/_headers.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const dist = path.join(clientRoot, 'dist');

const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).filter((body) => body.trim());
const sha256 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;

if (process.argv.includes('--print-hash')) {
  for (const body of inlineScripts(readFileSync(path.join(clientRoot, 'index.html'), 'utf8'))) console.log(`'${sha256(body)}'`);
  process.exit(0);
}

const problems = [];

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('check-dist: dist/index.html is missing; run vite build first.');
  process.exit(1);
}

const headersFile = path.join(dist, '_headers');
const headers = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : null;
if (!headers) problems.push('dist/_headers is missing: the security headers (CSP, frame-ancestors, HSTS) would not be served');
const csp = headers && (/^\s*Content-Security-Policy:\s*(.+)$/m.exec(headers) || [])[1];
if (headers && !csp) problems.push('dist/_headers has no Content-Security-Policy');
if (csp && !/frame-ancestors 'none'/.test(csp)) problems.push("the CSP lacks frame-ancestors 'none'");
if (headers && !/^\s*X-Frame-Options:\s*DENY/m.test(headers)) problems.push('dist/_headers lacks X-Frame-Options: DENY');

if (csp) {
  const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
  for (const body of inlineScripts(html)) {
    const hash = sha256(body);
    if (!csp.includes(`'${hash}'`)) problems.push(`inline script in dist/index.html is not allowed by the CSP: add '${hash}' to script-src in public/_headers (or run node scripts/check-dist.mjs --print-hash)`);
  }
}

const redirectsFile = path.join(dist, '_redirects');
const redirects = existsSync(redirectsFile) ? readFileSync(redirectsFile, 'utf8') : '';
const rules = redirects.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
const catchAll = rules.findIndex((rule) => rule.startsWith('/* '));
for (const prefix of ['/v1/*', '/api/*']) {
  const at = rules.findIndex((rule) => rule.startsWith(`${prefix} `));
  if (at === -1 || (catchAll !== -1 && at > catchAll)) problems.push(`dist/_redirects must handle ${prefix} above the SPA catch-all`);
}

// Strings that exist only in the operator runbooks (docs/OPERATIONS.md, DEPLOYMENT.md, ENVIRONMENT.md, …).
const OPERATOR_MARKERS = ['mongodb+srv', 'MONGODB_URI', 'JWT_SECRET', 'BACKUP_PASSPHRASE', 'RCLONE_CONFIG', 'superadmin:grant'];
const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});
for (const file of walk(dist).filter((name) => /\.(js|html|css|map|txt|json)$/.test(name))) {
  const text = readFileSync(file, 'utf8');
  for (const marker of OPERATOR_MARKERS) {
    if (text.includes(marker)) problems.push(`${path.relative(clientRoot, file)} contains "${marker}": operator documentation reached the public bundle`);
  }
}

if (problems.length) {
  console.error(`Build check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('Build check: _headers, CSP script hashes, _redirects and the operator-doc scan are OK.');
