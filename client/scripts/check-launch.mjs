#!/usr/bin/env node
/**
 * Launch gate: fails while any owner placeholder is still in something a visitor can see.
 *
 * Two halves:
 *   1. the build env (client/.env plus VITE_* in the process env, read with the same loadEnv as
 *      `vite build`): every VITE_SITE_* identity value and the prod API URL must be set and must not
 *      be a bracketed placeholder or an example.com value (CI builds with example values, so CI
 *      reports here by design);
 *   2. a scan of the visitor-facing files for owner placeholders that are not build inputs
 *      (README.md, SECURITY.md, the public docs). src/content/site.js is skipped: its bracketed
 *      values are only the dev fallbacks for unset VITE_SITE_* inputs, which half 1 covers.
 *
 * It is NOT part of `npm run lint`: run `npm run check:launch` before the first invite and before
 * setting LEGAL_POLICIES_APPROVED=true. CI runs it as a non-blocking step.
 *
 * Run from client/: `node scripts/check-launch.mjs`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadEnv } from 'vite';
import { PUBLIC_DOCS } from '../src/content/docLinks.js';
import { isPlaceholder, resolveBuildEnv, resolveSite, SITE_VARS } from '../config/buildEnv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const repoRoot = path.resolve(clientRoot, '..');

const PLACEHOLDER = /\[(Operator legal name|Jurisdiction|your-domain|support email|Hosting provider|Backup storage provider|Log provider|security contact email)\]|OWNER-APPROVAL|<api-host>/g;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const hits = [];

// 1. The build inputs.
const env = loadEnv(process.env.CHECK_LAUNCH_MODE || 'production', clientRoot, 'VITE_');
try {
  const build = resolveBuildEnv(env, 'build');
  if (build.mode !== 'prod') hits.push(`VITE_MODE resolves to ${build.mode}; a production deploy needs VITE_MODE=prod`);
  if (isPlaceholder(new URL(build.apiUrl).hostname)) hits.push(`VITE_PROD_API_URL=${env.VITE_PROD_API_URL}: still an example value`);
} catch (error) {
  hits.push(`build env: ${error.message.replace(/\n\s*/g, ' ')}`);
}
const site = resolveSite(env);
for (const [key, name] of Object.entries(SITE_VARS)) {
  if (key === 'statusUrl' && !site[key]) continue; // optional: unset hides the footer link
  if (isPlaceholder(site[key])) hits.push(`${name}=${site[key] || '(unset)'}: set the real value in the deploy's build env`);
}

// 2. Visitor-facing files that are not filled from the build inputs.
const siteJs = path.join(clientRoot, 'src', 'content', 'site.js');
const files = [
  ...walk(path.join(clientRoot, 'src')).filter((file) => /\.(jsx?|css|html)$/.test(file) && file !== siteJs && !/\.test\.jsx?$/.test(file)),
  path.join(clientRoot, 'index.html'),
  ...walk(path.join(clientRoot, 'public')).filter((file) => !/\.(png|jpe?g|gif|webp|ico|woff2?)$/i.test(file)),
  ...PUBLIC_DOCS.map((doc) => path.join(repoRoot, 'docs', doc.file)),
  path.join(repoRoot, 'README.md'),
  path.join(repoRoot, 'SECURITY.md'),
];

for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(PLACEHOLDER)) hits.push(`${path.relative(repoRoot, file)}:${index + 1}: ${match[0]}`);
  });
}

if (hits.length) {
  console.error(`Launch check: ${hits.length} owner placeholder(s) left. Fill them in (identity values are VITE_SITE_* build inputs; see client/.env.example):\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log('Launch check: no owner placeholders left.');
