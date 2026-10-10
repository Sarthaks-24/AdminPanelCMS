/**
 * The landing page demo runs the real scoping rules against a sample content pool.
 * The field lists come from server/lib/modelConstants.js and the two functions below mirror
 * server/lib/applyInclude.js and server/lib/buildFsTree.js, so what a visitor sees on the
 * page is what the API would actually return for the scope they built.
 */

// PUBLIC_FIELDS, trimmed to the sections the demo shows.
export const SECTIONS = [
  {
    key: 'profile',
    label: 'Profile',
    note: 'Who you are. One record.',
    fields: ['name', 'headline', 'shortBio', 'email', 'location.city', 'location.country', 'statusText', 'isAvailableForHire'],
    // email is withheld by default on the server too: it is in PUBLIC_FIELDS but not DEFAULT_FIELDS.
    withheldByDefault: ['email'],
  },
  {
    key: 'projects',
    label: 'Projects',
    note: 'Many records. Each one draft or published.',
    fields: ['title', 'slug', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'links.github', 'links.live', 'featured'],
    withheldByDefault: ['caseStudyBody'],
  },
  {
    key: 'skills',
    label: 'Skills',
    note: 'Grouped by category.',
    fields: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured'],
    withheldByDefault: [],
  },
  {
    key: 'fs',
    label: 'Filesystem view',
    note: 'The same granted content as a file tree, for terminal-style sites.',
    fields: null,
    withheldByDefault: [],
  },
];

// A sample pool. Not anyone's real content; the shapes and field names are the real ones.
export const POOL = {
  profile: {
    _id: '6708a1f4c2b19e0001a3f201',
    name: 'Avery Lindqvist',
    headline: 'Backend engineer, distributed systems',
    shortBio: 'I build the parts of products that have to stay up. Ten years of queues, caches and the postmortems that followed.',
    aboutMarkdown: '## Background\n\nI started on payment reconciliation and never quite left the world of systems that cannot lose a record.',
    email: 'avery@example.com',
    location: { city: 'Göteborg', country: 'Sweden', isRemoteAvailable: true },
    statusText: 'Open to contract work from March',
    isAvailableForHire: true,
  },
  projects: [
    {
      _id: '6708a1f4c2b19e0001a3f210',
      title: 'Aperture',
      slug: 'aperture',
      role: 'Lead Engineer',
      shortDescription: 'An ingest pipeline that moved 40M events a day without a dropped record.',
      keyMetric: 'p99 latency 14ms',
      highlights: ['Replaced a cron fan-out with a partitioned log', 'Cut replay time from 6 hours to 11 minutes'],
      caseStudyBody: '# Aperture\n\nThe old pipeline dropped records under backpressure. We rebuilt it around a partitioned log...',
      stack: ['typescript', 'kafka', 'postgres'],
      links: { github: 'https://github.com/example/aperture', live: 'https://aperture.example.com' },
      featured: true,
    },
    {
      _id: '6708a1f4c2b19e0001a3f211',
      title: 'Nightjar',
      slug: 'nightjar',
      role: 'Contributor',
      shortDescription: 'A scheduler for backfills that respects downstream rate limits.',
      keyMetric: '0 rate-limit incidents in 14 months',
      highlights: ['Token-bucket per downstream tenant'],
      caseStudyBody: '# Nightjar\n\nBackfills kept tripping third-party rate limits...',
      stack: ['go', 'redis'],
      links: { github: 'https://github.com/example/nightjar', live: '' },
      featured: false,
    },
  ],
  skills: [
    { _id: '6708a1f4c2b19e0001a3f220', name: 'Go', category: 'Languages', proficiency: 5, yearsOfExperience: 6, featured: true },
    { _id: '6708a1f4c2b19e0001a3f221', name: 'TypeScript', category: 'Languages', proficiency: 4, yearsOfExperience: 8, featured: true },
    { _id: '6708a1f4c2b19e0001a3f222', name: 'Kafka', category: 'Infrastructure', proficiency: 4, yearsOfExperience: 5, featured: false },
  ],
};

// DEFAULT_FIELDS: what a section falls back to when an App names no fields of its own.
export const defaultFieldsFor = (section) => (section.fields
  ? section.fields.filter((field) => !section.withheldByDefault.includes(field))
  : null);

const SECTION_BY_KEY = Object.fromEntries(SECTIONS.map((section) => [section.key, section]));

export const buildDefaultScope = () => Object.fromEntries(SECTIONS.map((section) => [
  section.key,
  { enabled: true, fields: defaultFieldsFor(section) },
]));

const getPath = (value, path) => path.split('.').reduce((current, key) => (current == null ? undefined : current[key]), value);

function setPath(target, path, value) {
  const parts = path.split('.');
  let current = target;
  for (const part of parts.slice(0, -1)) current = current[part] ||= {};
  current[parts[parts.length - 1]] = value;
}

// Mirrors sanitizeFields: _id always travels, then each granted path, dotted paths rebuilt as objects.
function sanitize(item, fields) {
  const output = {};
  if (item._id != null) output._id = item._id;
  for (const path of fields) {
    const value = getPath(item, path);
    if (value === undefined) continue;
    setPath(output, path, value);
  }
  return output;
}

/**
 * What `fields` actually resolves to. Mirrors sanitizeFields: an App that names no fields is not
 * asking for nothing, it is asking for the section's default set. Worth showing, because it is
 * the one place where the grant editor's reading is not literal.
 */
function effectiveFields(sectionKey, scope) {
  const picked = scope[sectionKey]?.fields;
  if (Array.isArray(picked) && picked.length) return { fields: picked, usedDefaults: false };
  return { fields: defaultFieldsFor(SECTION_BY_KEY[sectionKey]) || [], usedDefaults: true };
}

export function scopedResponse(sectionKey, scope) {
  const grant = scope[sectionKey];
  if (!grant?.enabled) {
    const label = sectionKey === 'fs' ? 'Virtual filesystem' : `The ${sectionKey} section`;
    return {
      status: 403,
      usedDefaults: false,
      body: { success: false, error: 'section_disabled', message: `${label} is not enabled for this app`, section: sectionKey },
    };
  }
  if (sectionKey === 'fs') return { status: 200, usedDefaults: false, body: buildFsTree(scopedView(scope)) };
  const { fields, usedDefaults } = effectiveFields(sectionKey, scope);
  const body = sectionKey === 'profile'
    ? sanitize(POOL.profile, fields)
    : POOL[sectionKey].map((item) => sanitize(item, fields));
  return { status: 200, usedDefaults, body };
}

function scopedView(scope) {
  const view = {};
  for (const section of SECTIONS) {
    if (section.key === 'fs' || !scope[section.key]?.enabled) continue;
    const { fields } = effectiveFields(section.key, scope);
    view[section.key] = section.key === 'profile'
      ? sanitize(POOL.profile, fields)
      : POOL[section.key].map((item) => sanitize(item, fields));
  }
  return view;
}

const slugify = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'item';
const file = (path, content, mimeType = 'text/plain') => ({
  name: path.split('/').pop(),
  type: 'file',
  path,
  mimeType,
  content,
  size: new TextEncoder().encode(typeof content === 'string' ? content : JSON.stringify(content)).length,
});
const dir = (path, children) => ({ name: path.split('/').pop() || '/', type: 'directory', path, children });

// Mirrors server/lib/buildFsTree.js for the sections the demo covers.
function buildFsTree(view = {}) {
  const root = [];
  if (view.profile) root.push(dir('/about', [
    file('/about/bio.txt', [view.profile.shortBio, view.profile.statusText].filter(Boolean).join('\n\n')),
    file('/about/background.md', view.profile.aboutMarkdown || '', 'text/markdown'),
    file('/about/contact.json', { email: view.profile.email, location: view.profile.location }, 'application/json'),
  ]));
  if (view.skills) {
    const groups = {};
    for (const skill of view.skills) (groups[skill.category || 'other'] ||= []).push(skill);
    root.push(dir('/skills', Object.entries(groups).map(([category, skills]) => file(`/skills/${slugify(category)}.json`, skills, 'application/json'))));
  }
  if (view.projects) root.push(dir('/projects', [
    ...view.projects.map((project) => file(
      `/projects/${slugify(project.slug || project.title)}.md`,
      `# ${project.title || ''}\n\n${project.caseStudyBody || project.shortDescription || ''}`,
      'text/markdown',
    )),
    file('/projects/index.json', view.projects.map(({ title, slug, shortDescription, stack }) => ({ title, slug, shortDescription, stack })), 'application/json'),
  ]));
  return dir('/', root);
}

// Mirrors setHeaders in server/routes/v1.js: the token type decides whether a proxy may cache.
export const responseHeaders = (tokenType, etag) => [
  ['ETag', etag],
  ['Cache-Control', tokenType === 'pk' ? 'public, max-age=60' : 'private, max-age=60'],
  ['Vary', 'Authorization, Origin'],
];

// A stable short digest so the ETag line changes whenever the scoped body changes.
export function fakeEtag(body) {
  const text = JSON.stringify(body);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `"${hash.toString(16).padStart(8, '0')}${text.length.toString(16).padStart(4, '0')}"`;
}
