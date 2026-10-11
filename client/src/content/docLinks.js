// Pure link logic for the public docs, kept free of Vite-only imports so scripts/check-docs.mjs can
// run the exact same rules in Node.

// The documents published at /docs/<slug>. src/content/docs.js imports each file by name; this list
// is the one place a new public doc is registered.
export const PUBLIC_DOCS = [
  { slug: 'quickstart', file: 'QUICKSTART.md' },
  { slug: 'api', file: 'API_REFERENCE.md' },
  { slug: 'limits', file: 'LIMITS_AND_ERRORS.md' },
  { slug: 'fields', file: 'CONTENT_FIELDS.md' },
  { slug: 'changelog', file: 'CHANGELOG.md' },
];

// Placeholders the docs are written against. DocPage swaps them for the service's real values
// before rendering, so every snippet is copy-ready. {{API_BASE}} is the bare origin of the public
// API with no trailing slash and no path; every documented path starts with /v1.
export const API_BASE_PLACEHOLDER = '{{API_BASE}}';
export const SUPPORT_EMAIL_PLACEHOLDER = '{{SUPPORT_EMAIL}}';

// Maps a full repo path to the route that renders that same file. Keyed on the whole path, not the
// basename, so a hypothetical server/README.md cannot be mistaken for the root one.
const ROUTE_FOR_PATH = new Map(PUBLIC_DOCS.map((doc) => [`docs/${doc.file}`, `/docs/${doc.slug}`]));

/** Resolves `./x`, `../x` and bare `x` against the directory holding the file that linked to it. */
function repoPath(href, sourceDir) {
  const segments = href.startsWith('/') ? href.slice(1).split('/') : [...sourceDir.split('/').filter(Boolean), ...href.split('/')];
  const out = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') out.pop();
    else out.push(segment);
  }
  return out.join('/');
}

/**
 * Rewrites the repo-relative links inside a markdown file to the routes that serve them here.
 * A bare `LIMITS_AND_ERRORS.md#rate-limits` inside docs/ becomes `/docs/limits#rate-limits`.
 * A link to a file that has no page here resolves to `null`, and Markdown renders its label as
 * plain text: the public site never links into the source tree. `npm run lint` fails on any such
 * link (scripts/check-docs.mjs).
 *
 * @param {string} href the link as written in the markdown
 * @param {string} source the repo path of the file that contains the link, e.g. `docs/QUICKSTART.md`
 * @returns {string|null}
 */
export function resolveDocLink(href, source = '') {
  if (!href || /^([a-z]+:|#|\/\/)/i.test(href)) return href;
  const [rawPath, hash] = href.split('#');
  const suffix = hash ? `#${hash}` : '';
  if (!rawPath) return href;
  const sourceDir = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
  const path = repoPath(rawPath, sourceDir);
  const route = ROUTE_FOR_PATH.get(path);
  if (route) return `${route}${suffix}`;
  // A site-absolute link to a route rather than a file (`/signup`, `/login`, `/legal/terms`) stays
  // a route. Repository files always carry an extension; routes never do.
  if (href.startsWith('/') && !/\.[a-z0-9]+$/i.test(path)) return href;
  // Not a page here. Never fall back to the repository.
  return null;
}
