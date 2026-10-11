#!/usr/bin/env node
/**
 * Smoke test of a deployed dashboard + API pair (X-04). Build gates only see the client and
 * validateEnv only sees the server; this checks the two as deployed.
 *
 *   npm run smoke -- https://portfoliocontrol.dev https://api.portfoliocontrol.dev
 *   node scripts/smoke-deploy.mjs <dashboardUrl> <apiUrl>
 *
 *   1. the API's publicApiBase (GET /api/auth/config) is allowed by every dashboard CSP (header and
 *      <meta>) that has connect-src (or default-src as its fallback), and at least one such policy exists;
 *   2. a CORS preflight from the dashboard origin is answered with credentials allowed;
 *   3. the SPA deep links answer 200 HTML (/verify-email?token=x, /reset-password, /dashboard/apps);
 *   4. the two hosts are not provably cross-site (the session cookie is SameSite=Lax);
 *   5. GET /v1/projects without a key answers 401 JSON;
 *   6. the dashboard sends header-only protections: frame-ancestors (header CSP) or X-Frame-Options,
 *      Strict-Transport-Security, X-Content-Type-Options: nosniff;
 *   7. <api>/readyz answers 200;
 *   8. <dashboard>/.well-known/security.txt answers 200 text/plain with a Contact: line.
 * Prints PASS/FAIL per check; exits 1 on any failure. Node 22 (global fetch), no dependencies.
 */
import { provablyCrossSite } from '../src/lib/sameSite.js';
import { parseCsp } from '../config/csp.js';

const [dashboardArg, apiArg] = process.argv.slice(2);
if (!dashboardArg || !apiArg) {
  console.error('Usage: node scripts/smoke-deploy.mjs <dashboardUrl> <apiUrl>');
  process.exit(2);
}
let dashboard;
let api;
try {
  dashboard = new URL(dashboardArg).origin;
  // Accept the API as a bare origin or with /api, like VITE_PROD_API_URL.
  api = new URL(apiArg).origin;
} catch {
  console.error('Both arguments must be absolute URLs, e.g. https://portfoliocontrol.dev https://api.portfoliocontrol.dev');
  process.exit(2);
}

const TIMEOUT_MS = 15000;
const request = (url, init = {}) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS), ...init });
const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push(true);
    console.log(`PASS  ${name}${detail ? `: ${detail}` : ''}`);
  } catch (error) {
    results.push(false);
    console.log(`FAIL  ${name}: ${error.message}`);
  }
}
const fail = (message) => { throw new Error(message); };

// Several CSP headers arrive joined by ", " (fetch combines repeated headers); CSP sources never contain commas.
const headerPolicies = (headers) => (headers.get('content-security-policy') || '').split(',').map((p) => p.trim()).filter(Boolean);
function metaPolicies(html) {
  const policies = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (!/http-equiv\s*=\s*["']?content-security-policy["'\s>/]/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) policies.push(value.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  return policies;
}

await check('1. dashboard CSP connect-src allows the API', async () => {
  const configRes = await request(`${api}/api/auth/config`, { headers: { Accept: 'application/json' } });
  if (!configRes.ok) fail(`GET ${api}/api/auth/config answered ${configRes.status}`);
  const config = await configRes.json();
  if (!config.publicApiBase) fail('the API reports no publicApiBase (set PUBLIC_API_URL on the server)');
  const origin = new URL(config.publicApiBase).origin;
  if (origin !== api) fail(`publicApiBase ${origin} is not the API you passed (${api})`);
  const page = await request(`${dashboard}/`);
  // Every policy is enforced (E-2): each header policy and each <meta> policy must allow the API.
  const policies = [
    ...headerPolicies(page.headers).map((policy) => ({ policy, source: 'header' })),
    ...metaPolicies(await page.text()).map((policy) => ({ policy, source: '<meta>' })),
  ];
  if (!policies.length) fail(`${dashboard}/ sends no Content-Security-Policy header or <meta>`);
  const relevant = [];
  for (const { policy, source } of policies) {
    const directives = parseCsp(policy);
    const name = directives.has('connect-src') ? 'connect-src' : directives.has('default-src') ? 'default-src' : null;
    if (!name) continue;
    const sources = directives.get(name);
    const allowed = sources.includes(origin) || (origin === dashboard && sources.includes("'self'"));
    if (!allowed) fail(`${name} (${source}) is "${sources.join(' ')}", missing ${origin}`);
    relevant.push(`${source} ${name}`);
  }
  if (!relevant.length) fail('no Content-Security-Policy has connect-src or default-src');
  return `${origin} via ${relevant.join(', ')}`;
});

await check('2. CORS preflight from the dashboard allows credentials', async () => {
  const res = await request(`${api}/api/auth/config`, {
    method: 'OPTIONS',
    headers: { Origin: dashboard, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'x-requested-with' },
  });
  const allowOrigin = res.headers.get('access-control-allow-origin');
  const allowCredentials = res.headers.get('access-control-allow-credentials');
  if (allowOrigin !== dashboard) fail(`Access-Control-Allow-Origin is ${allowOrigin ?? '(none)'}, expected ${dashboard} (check CLIENT_ORIGIN)`);
  if (allowCredentials !== 'true') fail(`Access-Control-Allow-Credentials is ${allowCredentials ?? '(none)'}, expected true`);
  return `status ${res.status}`;
});

for (const path of ['/verify-email?token=x', '/reset-password', '/dashboard/apps']) {
  await check(`3. ${path} serves the SPA`, async () => {
    const res = await request(`${dashboard}${path}`);
    const type = res.headers.get('content-type') || '';
    if (res.status !== 200) fail(`status ${res.status} (the host needs an SPA fallback to /index.html)`);
    if (!type.includes('text/html')) fail(`content-type ${type}`);
  });
}

await check('4. dashboard and API are on one site', async () => {
  const a = new URL(dashboard).hostname;
  const b = new URL(api).hostname;
  if (provablyCrossSite(a, b)) fail(`${a} and ${b} are different sites, so the SameSite=Lax session cookie is never sent; serve both from one registrable domain`);
  return `${a} / ${b}`;
});

await check('5. /v1/projects without a key answers 401 JSON', async () => {
  const res = await request(`${api}/v1/projects`, { headers: { Accept: 'application/json' } });
  const type = res.headers.get('content-type') || '';
  if (res.status !== 401) fail(`status ${res.status}`);
  if (!type.includes('application/json')) fail(`content-type ${type}`);
  const body = await res.json();
  return body.error ? `error ${body.error}` : '';
});

// E-5: protections a <meta> policy cannot carry must come from real response headers.
await check('6. dashboard sends the header-only protections', async () => {
  const res = await request(`${dashboard}/`);
  const missing = [];
  const framing = headerPolicies(res.headers).some((policy) => parseCsp(policy).has('frame-ancestors')) || Boolean(res.headers.get('x-frame-options'));
  if (!framing) missing.push('frame-ancestors (header CSP) or X-Frame-Options');
  if (!res.headers.get('strict-transport-security')) missing.push('Strict-Transport-Security');
  if ((res.headers.get('x-content-type-options') || '').toLowerCase().trim() !== 'nosniff') missing.push('X-Content-Type-Options: nosniff');
  if (missing.length) fail(`missing ${missing.join('; ')} (the host must send these as headers)`);
});

await check('7. API /readyz answers 200', async () => {
  const res = await request(`${api}/readyz`);
  if (res.status !== 200) fail(`status ${res.status}`);
});

await check('8. dashboard serves /.well-known/security.txt', async () => {
  const res = await request(`${dashboard}/.well-known/security.txt`);
  const type = res.headers.get('content-type') || '';
  if (res.status !== 200) fail(`status ${res.status}`);
  if (!type.includes('text/plain')) fail(`content-type ${type} (an SPA fallback answers text/html)`);
  if (!/^Contact:\s*\S+/im.test(await res.text())) fail('no Contact: line');
});

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
