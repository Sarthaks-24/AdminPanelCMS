// The public pages render the repository's own markdown, not a second copy of it. Vite inlines
// each file at build time with `?raw`, so a doc can never drift from what the repo ships.
import readmeText from '../../../README.md?raw';
import clientReadmeText from '../../README.md?raw';
import licenseText from '../../../LICENSE?raw';

const rawDocs = import.meta.glob('../../../docs/*.md', { query: '?raw', import: 'default', eager: true });

const basename = (path) => path.split('/').pop();

// Ordered the way someone reads them: get it running, configure it, ship it, then look things up.
const PAGES = [
  { slug: 'setup', file: 'SETUP_GUIDE.md', title: 'Setup guide', blurb: 'Run the API and dashboard locally, make your first API call, fix what breaks.', group: 'Start here' },
  { slug: 'environment', file: 'ENVIRONMENT.md', title: 'Environment', blurb: 'The MODE switch and every variable, written twice: once for your machine, once for production.', group: 'Start here' },
  { slug: 'deployment', file: 'DEPLOYMENT.md', title: 'Deployment', blurb: 'Hosting layouts, the production checklist, backups, and the limits to read before real traffic.', group: 'Running it' },
  { slug: 'operations', file: 'OPERATIONS.md', title: 'Operations', blurb: 'The command-line scripts: seeding, invites, superadmin, backups, maintenance sweeps.', group: 'Running it' },
  { slug: 'api', file: 'API_REFERENCE.md', title: 'API reference', blurb: 'The public /v1 endpoints your sites call, and the /api routes the dashboard uses.', group: 'Reference' },
  { slug: 'architecture', file: 'ARCHITECTURE.md', title: 'Architecture', blurb: 'How tenancy, sessions, token scoping and response caching actually work.', group: 'Reference' },
  { slug: 'data-model', file: 'DATA_MODEL.md', title: 'Data model', blurb: 'Every collection, its fields, and the limits enforced on them.', group: 'Reference' },
];

export const DOC_GROUPS = ['Start here', 'Running it', 'Reference'];

export const DOCS = PAGES.flatMap((page) => {
  const match = Object.entries(rawDocs).find(([path]) => basename(path) === page.file);
  // A renamed or deleted file drops out of the index instead of rendering an empty page.
  return match ? [{ ...page, body: match[1], source: `docs/${page.file}` }] : [];
});

export const EXTRA_PAGES = [
  { slug: 'readme', title: 'Readme', body: readmeText, source: 'README.md' },
  { slug: 'client', title: 'Dashboard package', body: clientReadmeText, source: 'client/README.md' },
];

export const LICENSE = { name: 'MIT License', body: licenseText, source: 'LICENSE' };

export const getDoc = (slug) => DOCS.find((doc) => doc.slug === slug) || EXTRA_PAGES.find((page) => page.slug === slug) || null;

// Maps a full repo path to the route that renders that same file. Keyed on the whole path, not the
// basename, so a hypothetical server/README.md cannot be mistaken for the root one.
const ROUTE_FOR_PATH = new Map([
  ...DOCS.map((doc) => [`docs/${doc.file}`, `/docs/${doc.slug}`]),
  ['README.md', '/readme'],
  ['client/README.md', '/docs/client'],
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
 * `docs/DEPLOYMENT.md#known-limits` in the README and a bare `DEPLOYMENT.md#known-limits` inside
 * docs/ both become `/docs/deployment#known-limits`. Anything with no page here goes to GitHub,
 * at the path the link actually points to.
 *
 * @param {string} href the link as written in the markdown
 * @param {string} repoUrl the repository's web URL
 * @param {string} source the repo path of the file that contains the link, e.g. `docs/SETUP_GUIDE.md`
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
  // Not a page here: send it to the file in the repository, resolved to its real location.
  return `${repoUrl}/blob/main/${path}${suffix}`;
}
