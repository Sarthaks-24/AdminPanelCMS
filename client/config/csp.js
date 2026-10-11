// The one Content-Security-Policy for the dashboard and public site.
//
// Two copies are emitted from it at build time (config/deployFiles.js):
//  - dist/_headers, for hosts that read it (Netlify, Cloudflare Pages);
//  - a <meta http-equiv="Content-Security-Policy"> in dist/index.html, for hosts that don't
//    (Render static sites, Caddy on a VPS). A meta policy cannot carry frame-ancestors, report-uri or
//    sandbox, so those are left out of it; X-Frame-Options covers framing where headers work.
//
// script-src: 'self' plus the sha256 of each inline script in index.html (the pre-paint theme
//   loader), computed from the built HTML, so editing that script never needs a hand-pasted hash.
// connect-src: 'self' plus the API origin resolved from VITE_PROD_API_URL / VITE_DEV_API_URL.
// font-src 'self': the typefaces are self-hosted (@fontsource).
// script-src/frame-src https://challenges.cloudflare.com: the Cloudflare Turnstile widget.
// img-src https: tenants' project thumbnails and avatars are arbitrary https URLs.
// style-src 'unsafe-inline': index.html's first-paint <style> block and React style attributes.

export const META_UNSUPPORTED = ['frame-ancestors', 'report-uri', 'sandbox'];

/** @returns {Array<[string, ...string[]]>} directive name followed by its sources */
export function cspDirectives({ apiOrigin, scriptHashes = [] }) {
  const directives = [
    ['default-src', "'self'"],
    ['script-src', "'self'", 'https://challenges.cloudflare.com', ...scriptHashes.map((hash) => `'${hash}'`)],
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'https:'],
    ['font-src', "'self'"],
    ['frame-src', 'https://challenges.cloudflare.com'],
    ['connect-src', "'self'", ...(apiOrigin ? [apiOrigin] : [])],
    ['frame-ancestors', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['object-src', "'none'"],
  ];
  // Upgrading would break a dev-mode build that calls http://localhost; prod API URLs are always https.
  if (!apiOrigin || apiOrigin.startsWith('https:')) directives.push(['upgrade-insecure-requests']);
  return directives;
}

const serialise = (directives) => directives.map((parts) => parts.join(' ')).join('; ');

/** The policy for the Content-Security-Policy response header. */
export const cspHeader = (options) => serialise(cspDirectives(options));

/** The same policy without the directives a <meta> element cannot deliver. */
export const cspMeta = (options) => serialise(cspDirectives(options).filter(([name]) => !META_UNSUPPORTED.includes(name)));

/** Parses a policy string into a Map of directive → sources. */
export function parseCsp(policy) {
  const map = new Map();
  for (const part of String(policy || '').split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/).filter(Boolean);
    if (name) map.set(name.toLowerCase(), sources);
  }
  return map;
}
