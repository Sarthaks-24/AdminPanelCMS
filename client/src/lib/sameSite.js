// Is the dashboard on the same site as the API? The session cookie is SameSite=Lax, so when the two
// are on different sites the browser never sends it: sign-in answers 200 and every call after it 401.
//
// No Public Suffix List here, so this only ever answers "provably cross-site" (council ruling 1):
//  - the last two labels differ: a registrable domain has at least two labels, so the sites differ;
//  - the hosts differ and either ends in a shared-hosting suffix: those suffixes are on the PSL, so
//    each subdomain is its own site.
// Pairs it cannot decide (two *.co.uk hosts) return false; scripts/smoke-deploy.mjs tests the real pair.
// Pure and dependency-free: the smoke script imports it in Node.

export const SHARED_HOSTING_SUFFIXES = [
  'pages.dev', 'onrender.com', 'fly.dev', 'netlify.app', 'vercel.app', 'workers.dev', 'herokuapp.com',
  'railway.app', 'up.railway.app', 'github.io', 'azurewebsites.net', 'azurestaticapps.net', 'amplifyapp.com',
  'cloudfront.net',
];

const normalise = (host) => String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/:\d+$/, '');
const lastTwoLabels = (host) => host.split('.').slice(-2).join('.');
const onSharedHost = (host) => SHARED_HOSTING_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

/** True only when the two hosts are certainly different sites. Unknown or empty input → false. */
export function provablyCrossSite(hostA, hostB) {
  const a = normalise(hostA);
  const b = normalise(hostB);
  if (!a || !b || a === b) return false;
  if (lastTwoLabels(a) !== lastTwoLabels(b)) return true;
  return onSharedHost(a) || onSharedHost(b);
}

/** The host of an absolute URL, or '' when it is not one. */
export function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
