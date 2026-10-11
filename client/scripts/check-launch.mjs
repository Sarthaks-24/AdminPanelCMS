#!/usr/bin/env node
/**
 * Launch gate: fails while any owner placeholder is still in something a visitor can see.
 *
 * The placeholders are deliberate until the owner supplies the facts (legal name, jurisdiction,
 * domain, providers). They all live in src/content/site.js, plus the copies that cannot import it
 * (public/_headers, public/.well-known/security.txt, README.md, SECURITY.md). This script lists every
 * one left, so it is NOT part of `npm run lint`: run `npm run check:launch` before the first invite
 * and before setting LEGAL_POLICIES_APPROVED=true. CI runs it as a non-blocking step.
 *
 * Run from client/: `node scripts/check-launch.mjs`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PUBLIC_DOCS } from '../src/content/docLinks.js';

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

const files = [
  ...walk(path.join(clientRoot, 'src')).filter((file) => /\.(jsx?|css|html)$/.test(file)),
  path.join(clientRoot, 'index.html'),
  ...walk(path.join(clientRoot, 'public')).filter((file) => !/\.(png|jpe?g|gif|webp|ico|woff2?)$/i.test(file)),
  ...PUBLIC_DOCS.map((doc) => path.join(repoRoot, 'docs', doc.file)),
  path.join(repoRoot, 'README.md'),
  path.join(repoRoot, 'SECURITY.md'),
];

const hits = [];
for (const file of files) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, index) => {
    for (const match of line.matchAll(PLACEHOLDER)) hits.push(`${path.relative(repoRoot, file)}:${index + 1}: ${match[0]}`);
  });
}

if (hits.length) {
  console.error(`Launch check: ${hits.length} owner placeholder(s) left. Fill them in (most live in client/src/content/site.js):\n  ${hits.join('\n  ')}`);
  process.exit(1);
}
console.log('Launch check: no owner placeholders left.');
