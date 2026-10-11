// The public docs render the repository's own markdown, not a second copy of it. Vite inlines
// each file at build time with `?raw`, so a page can never drift from what the repo ships.
//
// Only the four consumer-facing documents are published here. The operator material in docs/
// (setup, environment, deployment, operations, architecture, data model) stays in the repository
// for whoever runs the service; a consumer of the hosted API never needs it.
import licenseText from '../../../LICENSE?raw';

const rawDocs = import.meta.glob('../../../docs/*.md', { query: '?raw', import: 'default', eager: true });

const basename = (path) => path.split('/').pop();

// Ordered the way a new account reads them: get to a first request, then look things up.
const PAGES = [
  { slug: 'quickstart', file: 'QUICKSTART.md', title: 'Quickstart', blurb: 'From sign-up to your first request in about ten minutes: content, an App, a key, a fetch at build time.', group: 'Start here' },
  { slug: 'api', file: 'API_REFERENCE.md', title: 'API reference', blurb: 'Every /v1 endpoint, its query parameters, the response envelope, every error code and header.', group: 'Reference' },
  { slug: 'limits', file: 'LIMITS_AND_ERRORS.md', title: 'Limits & errors', blurb: 'The beta limits, what each error code means, and how to fetch so you never meet them.', group: 'Reference' },
  { slug: 'fields', file: 'CONTENT_FIELDS.md', title: 'Content fields', blurb: 'Which fields each section can serve, which ones are on by default, and which are never served.', group: 'Reference' },
];

export const DOC_GROUPS = ['Start here', 'Reference'];

export const DOCS = PAGES.flatMap((page) => {
  const match = Object.entries(rawDocs).find(([path]) => basename(path) === page.file);
  // A renamed or deleted file drops out of the index instead of rendering an empty page.
  return match ? [{ ...page, body: match[1], source: `docs/${page.file}` }] : [];
});

// Nothing beyond the four docs is published. Kept as an export so the pages that render extras
// keep working if one is ever added back. `/readme` therefore resolves to no page.
export const EXTRA_PAGES = [];

export const LICENSE = { name: 'MIT License', body: licenseText, source: 'LICENSE' };

export const getDoc = (slug) => DOCS.find((doc) => doc.slug === slug) || EXTRA_PAGES.find((page) => page.slug === slug) || null;

// The placeholder the docs use for the public API base. DocPage swaps it for this deployment's
// real base URL before rendering, so every snippet is copy-ready.
export const API_BASE_PLACEHOLDER = '{{API_BASE}}';

// Maps a full repo path to the route that renders that same file. Keyed on the whole path, not the
// basename, so a hypothetical server/README.md cannot be mistaken for the root one.
const ROUTE_FOR_PATH = new Map([
  ...DOCS.map((doc) => [`docs/${doc.file}`, `/docs/${doc.slug}`]),
  ['LICENSE', '/license'],
]);

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
 * Anything with no page here goes to GitHub, at the path the link actually points to.
 *
 * @param {string} href the link as written in the markdown
 * @param {string} repoUrl the repository's web URL
 * @param {string} source the repo path of the file that contains the link, e.g. `docs/QUICKSTART.md`
 */
export function resolveDocLink(href, repoUrl, source = '') {
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
  // Not a page here: send it to the file in the repository, resolved to its real location.
  return `${repoUrl}/blob/main/${path}${suffix}`;
}
