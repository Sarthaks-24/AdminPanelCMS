// FE-09: the session cookie is SameSite=Lax/Strict, so the dashboard and the API must be on one site
// (one registrable domain). Deciding that exactly needs the Public Suffix List; this check never claims two
// hosts are the same site, it only reports pairs that are provably cross-site:
//  - a registrable domain has at least two labels, so hosts whose last two labels differ are different sites;
//  - the shared-hosting suffixes below are on the PSL, so two different hosts under them are different sites.
// Pairs it cannot decide (two *.co.uk hosts, say) are left to the deploy smoke check.
const SHARED_HOSTING_SUFFIXES = [
  'pages.dev', 'onrender.com', 'fly.dev', 'netlify.app', 'vercel.app', 'workers.dev', 'herokuapp.com',
  'railway.app', 'up.railway.app', 'github.io', 'azurewebsites.net', 'azurestaticapps.net', 'amplifyapp.com',
  'cloudfront.net',
];

function hostOf(value) {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/\.$/, '') || null; } catch { return null; }
}
const lastTwoLabels = (host) => host.split('.').slice(-2).join('.');
const onSharedHosting = (host) => SHARED_HOSTING_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));

// True only when the two URLs (or origins) are certainly on different sites.
function provablyCrossSite(first, second) {
  const a = hostOf(first);
  const b = hostOf(second);
  if (!a || !b || a === b) return false;
  if (lastTwoLabels(a) !== lastTwoLabels(b)) return true;
  return onSharedHosting(a) || onSharedHosting(b);
}

module.exports = { provablyCrossSite, SHARED_HOSTING_SUFFIXES };
