#!/usr/bin/env node
/**
 * Fails when a public doc would render something a visitor should never see. Part of `npm run lint`.
 *
 * For every doc published at /docs/<slug> (PUBLIC_DOCS in src/content/docLinks.js):
 *   1. no `<!--` and no `OWNER-APPROVAL`: react-markdown shows raw HTML comments as literal text;
 *   2. every link resolves to a page on the site or an absolute URL (resolveDocLink, the same function
 *      the site uses). A link to a file with no public page would render as dead text;
 *   3. the base-URL rule: `{{API_BASE}}` is a bare origin and is only ever followed by `/v1...` (or
 *      stands alone), so no rendered URL can contain `/v1/v1`. Each doc is rendered against sample
 *      bases and checked for `/v1/v1`.
 *
 * Run from client/: `node scripts/check-docs.mjs`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API_BASE_PLACEHOLDER, PUBLIC_DOCS, resolveDocLink } from '../src/content/docLinks.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, '..', '..', 'docs');

// The origins {{API_BASE}} can render as: a configured API host, a same-origin fallback, a local API.
const SAMPLE_ORIGINS = ['https://api.example.com', 'https://example.com', 'http://localhost:5000'];

const problems = [];

/** Markdown links outside fenced code: `[label](href)`. Inline code spans are stripped first. */
function linksOf(markdown) {
  const links = [];
  let fence = null;
  markdown.split('\n').forEach((line, index) => {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const text = line.replace(/`[^`]*`/g, '');
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) links.push({ href: match[1], line: index + 1 });
  });
  return links;
}

for (const doc of PUBLIC_DOCS) {
  const source = `docs/${doc.file}`;
  let body;
  try {
    body = readFileSync(path.join(docsRoot, doc.file), 'utf8');
  } catch {
    problems.push(`${source}: missing (listed in PUBLIC_DOCS)`);
    continue;
  }
  const lines = body.split('\n');

  lines.forEach((line, index) => {
    const where = `${source}:${index + 1}`;
    if (line.includes('<!--')) problems.push(`${where}: HTML comment; it renders as visible text on the site`);
    if (line.includes('OWNER-APPROVAL')) problems.push(`${where}: OWNER-APPROVAL note in a public doc`);
    // The base-URL rule. {{API_BASE}} is a bare origin: it may stand alone or be followed by /v1.
    let at = line.indexOf(API_BASE_PLACEHOLDER);
    while (at !== -1) {
      const after = line.slice(at + API_BASE_PLACEHOLDER.length);
      if (after.startsWith('/') && !/^\/v1(\/|\b|$)/.test(after)) {
        problems.push(`${where}: ${API_BASE_PLACEHOLDER} must be followed by /v1/... (it is the bare origin): "${line.trim()}"`);
      }
      at = line.indexOf(API_BASE_PLACEHOLDER, at + 1);
    }
  });

  for (const origin of SAMPLE_ORIGINS) {
    const rendered = body.split(API_BASE_PLACEHOLDER).join(origin);
    if (rendered.includes('/v1/v1')) problems.push(`${source}: renders a /v1/v1 URL with base ${origin}`);
  }

  for (const { href, line } of linksOf(body)) {
    if (resolveDocLink(href, source) == null) problems.push(`${source}:${line}: link "${href}" has no page on the site`);
  }
}

if (problems.length) {
  console.error(`Public docs check failed (${problems.length}):\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`Public docs check: ${PUBLIC_DOCS.length} docs, links, base-URL paths and comments OK.`);
