#!/usr/bin/env node
/**
 * Checks the production build in dist/. Runs after `vite build` (npm run build).
 *
 *   1. no %TOKEN% from a template (index.html, public/_headers, security.txt) is left in dist/;
 *   2. dist/_headers carries a CSP with frame-ancestors 'none', X-Frame-Options: DENY, the API
 *      origin in connect-src, and a 'sha256-…' source for every inline <script> in dist/index.html;
 *   3. dist/index.html carries the same policy as a <meta> before its first script, with the API
 *      origin and the script hashes (for hosts that ignore _headers);
 *   4. dist/_redirects ends in the SPA fallback and there is no 404.html (it disables SPA mode on
 *      Cloudflare Pages);
 *   5. dist/.well-known/security.txt names the site domain and has not expired;
 *   6. nothing from the internal operator runbooks reached the public bundle.
 *
 * The API origin is resolved from the build env exactly as vite.config.js does (config/buildEnv.js).
 *
 * `node scripts/check-dist.mjs --print-hash` prints the hash of the inline script in index.html.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from 'vite';
import { resolveBuildEnv } from '../config/buildEnv.js';
import { parseCsp } from '../config/csp.js';
import { inlineScripts, LEFTOVER_TOKEN, sha256 } from '../config/deployFiles.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const dist = path.join(clientRoot, 'dist');

if (process.argv.includes('--print-hash')) {
  for (const body of inlineScripts(readFileSync(path.join(clientRoot, 'index.html'), 'utf8'))) console.log(`'${sha256(body)}'`);
  process.exit(0);
}

if (!existsSync(path.join(dist, 'index.html'))) {
  console.error('check-dist: dist/index.html is missing; run vite build first.');
  process.exit(1);
}

// `vite build` runs in mode "production" unless --mode says otherwise; CHECK_DIST_MODE mirrors that.
const build = resolveBuildEnv(loadEnv(process.env.CHECK_DIST_MODE || 'production', clientRoot, 'VITE_'), 'build');
const problems = [];
const read = (file) => (existsSync(file) ? readFileSync(file, 'utf8') : null);
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const hashes = inlineScripts(html).map(sha256);

function checkPolicy(label, policy) {
  const csp = parseCsp(policy);
  const connect = csp.get('connect-src') || [];
  if (!connect.includes(build.apiOrigin)) problems.push(`${label}: connect-src does not allow the API origin ${build.apiOrigin}, so every dashboard call would be blocked`);
  const scripts = csp.get('script-src') || [];
  for (const hash of hashes) {
    if (!scripts.includes(`'${hash}'`)) problems.push(`${label}: script-src does not allow the inline script in dist/index.html ('${hash}')`);
  }
  return csp;
}

// 1. Leftover template tokens.
for (const rel of ['index.html', '_headers', path.join('.well-known', 'security.txt')]) {
  const text = read(path.join(dist, rel));
  const left = text && [...new Set(text.match(LEFTOVER_TOKEN) || [])];
  if (left?.length) problems.push(`dist/${rel.replaceAll('\\', '/')} still contains ${left.join(', ')}: a build input was not filled in`);
}

// 2. _headers.
const headers = read(path.join(dist, '_headers'));
if (!headers) problems.push('dist/_headers is missing: the security headers (CSP, frame-ancestors, HSTS) would not be served');
const headerPolicy = headers && (/^\s*Content-Security-Policy:\s*(.+)$/m.exec(headers) || [])[1];
if (headers && !headerPolicy) problems.push('dist/_headers has no Content-Security-Policy');
if (headerPolicy) {
  const csp = checkPolicy('dist/_headers', headerPolicy);
  if ((csp.get('frame-ancestors') || []).join(' ') !== "'none'") problems.push("dist/_headers: the CSP lacks frame-ancestors 'none'");
}
if (headers && !/^\s*X-Frame-Options:\s*DENY/m.test(headers)) problems.push('dist/_headers lacks X-Frame-Options: DENY');

// 3. The <meta> copy.
const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(html);
if (!meta) problems.push('dist/index.html has no Content-Security-Policy <meta>: hosts that ignore _headers would serve no CSP');
else {
  const firstScript = html.search(/<script\b/i);
  if (firstScript !== -1 && meta.index > firstScript) problems.push('dist/index.html: the CSP <meta> comes after a <script>, so it does not govern it');
  const csp = checkPolicy('dist/index.html <meta>', meta[1].replaceAll('&#39;', "'"));
  for (const name of ['frame-ancestors', 'report-uri', 'sandbox']) if (csp.has(name)) problems.push(`dist/index.html <meta>: ${name} is not allowed in a meta policy`);
}

// 4. SPA fallback, host-neutral.
const rules = (read(path.join(dist, '_redirects')) || '').split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
if (!rules.some((rule) => /^\/\*\s+\/index\.html\s+200$/.test(rule))) problems.push('dist/_redirects lacks the SPA fallback "/*  /index.html  200"');
if (existsSync(path.join(dist, '404.html'))) problems.push('dist/404.html exists: on Cloudflare Pages it turns off SPA fallback, so /dashboard/* and /verify-email reloads would 404');

// 5. security.txt.
const security = read(path.join(dist, '.well-known', 'security.txt'));
if (!security) problems.push('dist/.well-known/security.txt is missing');
else {
  const expires = Date.parse((/^Expires:\s*(.+)$/m.exec(security) || [])[1]);
  if (!(expires > Date.now())) problems.push('dist/.well-known/security.txt: Expires is missing or in the past');
  if (build.site.domain && !security.includes(`security@${build.site.domain}`)) problems.push(`dist/.well-known/security.txt does not name security@${build.site.domain}`);
}

// 6. Strings that exist only in the operator runbooks (docs/OPERATIONS.md, DEPLOYMENT.md, ENVIRONMENT.md, …).
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
console.log(`Build check: CSP (_headers and <meta>, connect-src ${build.apiOrigin}, script hashes), templates, SPA fallback, security.txt and the operator-doc scan are OK.`);
