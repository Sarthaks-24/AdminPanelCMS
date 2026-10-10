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

// Maps a repo path from a markdown link to the route that renders that same file.
const ROUTE_FOR_FILE = new Map([
  ...DOCS.map((doc) => [doc.file, `/docs/${doc.slug}`]),
  ['README.md', '/readme'],
  ['LICENSE', '/license'],
]);

/**
 * Rewrites the repo-relative links inside a markdown file to the routes that serve them here.
 * `docs/DEPLOYMENT.md#known-limits` and `../docs/DEPLOYMENT.md` both become `/docs/deployment#known-limits`.
 * Anything with no page of its own falls through to the file on GitHub.
 */
export function resolveDocLink(href, repoUrl) {
  if (!href || /^([a-z]+:|#|\/\/)/i.test(href)) return href;
  const [path, hash] = href.split('#');
  const file = basename(path);
  if (path.startsWith('client/README.md') || path.endsWith('client/README.md')) return `/docs/client${hash ? `#${hash}` : ''}`;
  const route = ROUTE_FOR_FILE.get(file);
  if (route) return `${route}${hash ? `#${hash}` : ''}`;
  // Not a page here: send it to the file in the repository.
  return `${repoUrl}/blob/main/${path.replace(/^(\.\.\/|\.\/)+/, '')}${hash ? `#${hash}` : ''}`;
}
