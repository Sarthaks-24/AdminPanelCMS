#!/usr/bin/env node
/**
 * Smoke test of a deployed dashboard + API pair (X-04). Build gates only see the client and
 * validateEnv only sees the server; this checks the two as deployed.
 *
 *   npm run smoke -- https://portfoliocontrol.dev https://api.portfoliocontrol.dev
 *   node scripts/smoke-deploy.mjs <dashboardUrl> <apiUrl>
 *
 *   1. the API's publicApiBase (GET /api/auth/config) is allowed by the dashboard's CSP connect-src
 *      (the Content-Security-Policy header, else the <meta> in the page);
 *   2. a CORS preflight from the dashboard origin is answered with credentials allowed;
 *   3. the SPA deep links answer 200 HTML (/verify-email?token=x, /reset-password, /dashboard/apps);
 *   4. the two hosts are not provably cross-site (the session cookie is SameSite=Lax);
 *   5. GET /v1/projects without a key answers 401 JSON.
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

await check('1. dashboard CSP connect-src allows the API', async () => {
  const configRes = await request(`${api}/api/auth/config`, { headers: { Accept: 'application/json' } });
  if (!configRes.ok) fail(`GET ${api}/api/auth/config answered ${configRes.status}`);
  const config = await configRes.json();
  if (!config.publicApiBase) fail('the API reports no publicApiBase (set PUBLIC_API_URL on the server)');
  const origin = new URL(config.publicApiBase).origin;
  const page = await request(`${dashboard}/`);
  let policy = page.headers.get('content-security-policy');
  let source = 'header';
  if (!policy) {
    const meta = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(await page.text());
    policy = meta?.[1];
    source = '<meta>';
  }
  if (!policy) fail(`${dashboard}/ sends no Content-Security-Policy header or <meta>`);
  const connect = parseCsp(policy).get('connect-src') || [];
  if (!connect.includes(origin)) fail(`connect-src (${source}) is "${connect.join(' ')}", missing ${origin}`);
  if (origin !== api) fail(`publicApiBase ${origin} is not the API you passed (${api})`);
  return `${origin} via ${source}`;
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

const failed = results.filter((ok) => !ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks failed.` : `\nAll ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
