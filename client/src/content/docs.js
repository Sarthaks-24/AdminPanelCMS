// The public docs render the repository's own markdown, not a second copy of it. Vite inlines
// each file at build time with `?raw`, so a page can never drift from what the repo ships.
//
// Only the consumer-facing documents are imported, one by one. Never glob docs/*.md: the operator
// runbooks in docs/ (setup, environment, deployment, operations, architecture, data model) are
// internal and must not reach the public bundle. `npm run check:dist` fails the build if they do.
import quickstart from '../../../docs/QUICKSTART.md?raw';
import apiReference from '../../../docs/API_REFERENCE.md?raw';
import limitsAndErrors from '../../../docs/LIMITS_AND_ERRORS.md?raw';
import contentFields from '../../../docs/CONTENT_FIELDS.md?raw';
import changelog from '../../../docs/CHANGELOG.md?raw';

// Ordered the way a new account reads them: get to a first request, then look things up.
const PAGES = [
  { slug: 'quickstart', file: 'QUICKSTART.md', body: quickstart, title: 'Quickstart', blurb: 'From sign-up to your first request in about ten minutes: content, an App, a key, a fetch at build time.', group: 'Start here' },
  { slug: 'api', file: 'API_REFERENCE.md', body: apiReference, title: 'API reference', blurb: 'Every /v1 endpoint, its query parameters, the response envelope, every error code and header.', group: 'Reference' },
  { slug: 'limits', file: 'LIMITS_AND_ERRORS.md', body: limitsAndErrors, title: 'Limits & errors', blurb: 'The beta limits, what each error code means, and how to fetch so you never meet them.', group: 'Reference' },
  { slug: 'fields', file: 'CONTENT_FIELDS.md', body: contentFields, title: 'Content fields', blurb: 'Which fields each section can serve, which ones are on by default, and which are never served.', group: 'Reference' },
  { slug: 'changelog', file: 'CHANGELOG.md', body: changelog, title: 'Changelog', blurb: 'Changes to the API, the limits and the legal text, newest first.', group: 'Reference' },
];

export const DOC_GROUPS = ['Start here', 'Reference'];

// `source` is the file's path in the repository. It is used only to resolve relative links between
// the docs; it is never shown to visitors.
export const DOCS = PAGES.filter((page) => page.body).map((page) => ({ ...page, source: `docs/${page.file}` }));

// Nothing beyond the docs above is published. Kept as an export so the pages that render extras
// keep working if one is ever added back.
export const EXTRA_PAGES = [];

export const getDoc = (slug) => DOCS.find((doc) => doc.slug === slug) || EXTRA_PAGES.find((page) => page.slug === slug) || null;

export { API_BASE_PLACEHOLDER, SUPPORT_EMAIL_PLACEHOLDER, resolveDocLink } from './docLinks';
