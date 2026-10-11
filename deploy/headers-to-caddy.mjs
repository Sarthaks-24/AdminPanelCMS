// Turns the build's dist/_headers (Netlify / Cloudflare Pages syntax) into a Caddy `header` block, so
// the Caddy image sends exactly the same security headers as the static hosts. Only the `/*` section
// is read: it is the only one the dashboard uses.
// Usage: node deploy/headers-to-caddy.mjs client/dist/_headers > headers.caddy
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node headers-to-caddy.mjs <path to _headers>');
  process.exit(1);
}

const headers = [];
let inAll = false;
for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
  if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
  if (!/^\s/.test(raw)) { inAll = raw.trim() === '/*'; continue; }
  if (!inAll) continue;
  const at = raw.indexOf(':');
  if (at < 0) continue;
  headers.push([raw.slice(0, at).trim(), raw.slice(at + 1).trim()]);
}
if (!headers.length) {
  console.error(`${file}: no headers found under /*`);
  process.exit(1);
}

const quote = (value) => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
console.log('header {');
for (const [name, value] of headers) console.log(`\t${name} ${quote(value)}`);
console.log('}');
