const express = require('express');
const crypto = require('crypto');
const v1Cors = require('../middleware/v1Cors');
const sanitizeQuery = require('../middleware/sanitizeQuery');
const { preAuthLimiter, tokenLimiter, tokenCeilingLimiter, chargeMiss } = require('../middleware/v1Limiters');
const requireToken = require('../middleware/requireToken');
const loadOwnerData = require('../lib/loadOwnerData');
const { applyInclude } = require('../lib/applyInclude');
const buildFsTree = require('../lib/buildFsTree');
const {
  responseCache, buildCacheKey, normalizedFilters, filterError, filterQuery, NEGATIVE_TTL_MS, RESPONSE_CACHE_MAX_ITEM_BYTES,
} = require('../lib/cache');
const { v1Error } = require('../lib/v1Errors');
const logger = require('../lib/logger');

const router = express.Router();
// Chain (council design): cors → IP limiter → query sanitizer → token (hash set, pre-DB bucket,
// origin) → per-token limiters → [route: section guard → filter validation → cached section → view].
// There is deliberately no JSON body parser: the router is GET-only.
router.use(v1Cors, preAuthLimiter, sanitizeQuery, requireToken, tokenLimiter, tokenCeilingLimiter);

function setHeaders(res, etag) {
  res.setHeader('ETag', etag);
  // `private` for pk and sk alike: the URL carries no tenant, so a shared cache must never store it.
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.setHeader('Vary', 'Authorization, Origin');
}
function hasEtag(req, etag) {
  return (req.get('if-none-match') || '').split(',').map((item) => item.trim().replace(/^W\//, '')).includes(etag);
}
// `facets` (lists only) holds the per-item values the in-memory filters need, since the App's field
// list may not serve them (stack, featured, slug, category).
function makeEntry(data, ownerId, facets) {
  const serialized = JSON.stringify({ data });
  const etag = `"${crypto.createHash('sha256').update(serialized).digest('hex')}"`;
  const entry = { serialized, etag, ownerId: String(ownerId), bytes: Buffer.byteLength(serialized) };
  if (facets) { entry.facets = facets; entry.extraBytes = Buffer.byteLength(JSON.stringify(facets)); }
  return entry;
}
const EMPTY_LIST = makeEntry([], '');
function send(req, res, entry) {
  setHeaders(res, entry.etag);
  if (hasEtag(req, entry.etag)) return res.status(304).end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.send(entry.serialized);
}
const sendError = (res, error) => v1Error(res, error.status, error.code, error.message, error.extra);
function sectionEnabled(key, message = `The ${key} section is not enabled for this app`) {
  return (req, res, next) => (req.cmsApp.include?.[key]?.enabled ? next() : v1Error(res, 403, 'section_disabled', message, { section: key }));
}
// A repeated or malformed filter is a 400 that names the parameter, never a silent unfiltered 200.
function validFilters(req, res, next) {
  const problem = filterError(req);
  return problem ? v1Error(res, 400, 'bad_request', problem.message, { param: problem.param }) : next();
}
const enabledSections = (req) => Object.entries(req.cmsApp.include || {}).filter(([key, value]) => key !== 'fs' && value?.enabled).map(([key]) => key);
const notConfigured = (what) => ({ error: { status: 404, code: 'not_configured', message: `The ${what} has not been set up yet` } });
const notFound = (message) => ({ error: { status: 404, code: 'not_found', message } });

// One cached entry per owner + version + App + section. The first request for a key charges the owner
// and global miss budgets (weighted by `units`) and loads; concurrent requests for the same key wait for
// it. The key is taken before the load so a concurrent edit cannot file stale data under the new version.
// A 404 is cached for NEGATIVE_TTL_MS. When the budget refuses a reload, an expired entry of the same
// version is served instead (stale-if-busy): versions change on every edit, so it is only time-expired.
const inflight = new Map();
async function getEntry(req, name, units, produce) {
  const key = buildCacheKey(req, name);
  const hit = responseCache.get(key);
  if (hit) return { key, entry: hit, hit: true };
  let pending = inflight.get(key);
  if (!pending) {
    const charge = chargeMiss(req.ownerId, units(req));
    if (!charge.ok) {
      const stale = responseCache.peek(key);
      return stale ? { key, entry: stale, hit: true } : { key, charge };
    }
    pending = produce(req).then((result) => {
      if (result.error) {
        const entry = { ownerId: String(req.ownerId), error: result.error };
        responseCache.set(key, entry, NEGATIVE_TTL_MS);
        return entry;
      }
      const entry = makeEntry(result.data, req.ownerId, result.facets);
      if (entry.bytes > RESPONSE_CACHE_MAX_ITEM_BYTES) {
        // The published-content budget keeps real bodies below this; serve it, uncached, and say so.
        logger.warn({ reqId: req.id, owner: String(req.ownerId), app: String(req.cmsApp._id), path: req.path, bytes: entry.bytes }, '/v1 response above the cacheable size');
      }
      responseCache.set(key, entry); // bodies above the item cap are served but not stored
      return entry;
    }).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  return { key, entry: await pending, hit: false };
}
// `view(req, entry, key)` turns the cached section into this route's answer (an entry or { error }).
function serve(name, units, produce, view = (req, entry) => entry) {
  return async (req, res, next) => {
    try {
      const result = await getEntry(req, name, units, produce);
      if (result.charge) { res.setHeader('Retry-After', '1'); return v1Error(res, result.charge.status, result.charge.code, result.charge.message); }
      res.locals.cacheHit = result.hit;
      if (result.entry.error) return sendError(res, result.entry.error);
      const answer = view(req, result.entry, result.key);
      return answer.error ? sendError(res, answer.error) : send(req, res, answer);
    } catch (err) { return next(err); }
  };
}
// A view derived from a section (a filtered list, one project, the category grouping) is cached beside
// it under the section's key, so it shares the section's version and owner purge. Only views with
// content are stored; the values that produce them are bounded by the owner's own data.
function derived(key, build) {
  let entry = responseCache.get(key);
  if (!entry) { entry = build(); responseCache.set(key, entry); }
  return entry;
}
const parsedData = (entry) => JSON.parse(entry.serialized).data;
function filteredList(matches) {
  return (req, entry, key) => {
    const filters = normalizedFilters(req);
    const query = filterQuery(filters);
    if (!query) return entry;
    const indexes = entry.facets.flatMap((facet, index) => (matches(facet, filters) ? [index] : []));
    if (!indexes.length) return EMPTY_LIST;
    if (indexes.length === entry.facets.length) return entry;
    return derived(`${key}?${query}`, () => {
      const data = parsedData(entry);
      return makeEntry(indexes.map((index) => data[index]), req.ownerId);
    });
  };
}
const one = () => 1;
const list = (key) => async (req) => ({ data: applyInclude(req.cmsApp, await loadOwnerData(req.ownerId, [key]))[key] || [] });
// The granted items plus their filter facets, read from the stored documents by _id.
const section = (key, facetOf) => async (req) => {
  const raw = await loadOwnerData(req.ownerId, [key]);
  const data = applyInclude(req.cmsApp, raw)[key] || [];
  const byId = new Map((raw[key] || []).map((item) => [String(item._id), item]));
  return { data, facets: data.map((item) => facetOf(byId.get(String(item._id)) || {})) };
};
const projectsSection = section('projects', (item) => ({
  slug: item.slug, featured: item.featured === true,
  stack: Array.isArray(item.stack) ? item.stack.map((tag) => String(tag).toLowerCase()) : [],
}));
const skillsSection = section('skills', (item) => ({ category: item.category || '' }));

router.get('/app', (req, res) => {
  const key = buildCacheKey(req);
  let entry = responseCache.get(key);
  res.locals.cacheHit = Boolean(entry);
  if (!entry) {
    entry = makeEntry({
      name: req.cmsApp.name, type: req.cmsApp.type,
      enabledSections: Object.entries(req.cmsApp.include || {}).filter(([, value]) => value?.enabled).map(([key]) => key),
    }, req.ownerId);
    responseCache.set(key, entry);
  }
  return send(req, res, entry);
});
router.get('/profile', sectionEnabled('profile'), serve('/profile', one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['profile']);
  if (!raw.profile?.configured) return notConfigured('profile');
  return { data: applyInclude(req.cmsApp, raw).profile };
}));
router.get('/resume', sectionEnabled('resume'), serve('/resume', one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['resume']);
  if (!raw.resume) return notConfigured('resume');
  return { data: applyInclude(req.cmsApp, raw).resume };
}));
router.get('/socials', sectionEnabled('socials'), serve('/socials', one, list('socials')));
router.get('/skills', sectionEnabled('skills'), validFilters, serve('/skills', one, skillsSection,
  filteredList((facet, filters) => !filters.category || facet.category.toLowerCase() === filters.category)));
router.get('/skills/categories', sectionEnabled('skills'), serve('/skills', one, skillsSection, (req, entry, key) => derived(`${key}#categories`, () => {
  const data = parsedData(entry);
  const grouped = {};
  entry.facets.forEach((facet, index) => (grouped[facet.category || 'Uncategorized'] ||= []).push(data[index]));
  return makeEntry(grouped, req.ownerId);
})));
router.get('/projects', sectionEnabled('projects'), validFilters, serve('/projects', one, projectsSection,
  filteredList((facet, filters) => (!filters.stack || facet.stack.includes(filters.stack))
    && (filters.featured === undefined || facet.featured === filters.featured))));
// Any slug, known or not, is answered from the one cached projects section: random slugs cost nothing.
router.get('/projects/:slug', sectionEnabled('projects'), serve('/projects', one, projectsSection, (req, entry, key) => {
  const index = entry.facets.findIndex((facet) => facet.slug === req.params.slug);
  if (index < 0) return notFound('Project not found or not published');
  return derived(`${key}/${index}`, () => makeEntry(parsedData(entry)[index], req.ownerId));
}));
for (const key of ['experience', 'education', 'certifications']) router.get(`/${key}`, sectionEnabled(key), serve(`/${key}`, one, list(key)));
router.get('/fs', sectionEnabled('fs', 'Virtual filesystem is not enabled for this app'),
  serve('/fs', (req) => enabledSections(req).length, async (req) => {
    const raw = await loadOwnerData(req.ownerId, enabledSections(req));
    if (raw.profile && !raw.profile.configured) delete raw.profile; // same rule as /v1/profile
    return { data: buildFsTree(applyInclude(req.cmsApp, raw)) };
  }));

// /v1-shaped 404 and error handler; CORS headers set earlier in the chain are preserved.
router.use((req, res) => v1Error(res, 404, 'not_found', `No /v1 route matches ${req.method} ${req.originalUrl.split('?')[0]}`));
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number(err?.status ?? err?.statusCode);
  if (status >= 400 && status < 500) return v1Error(res, status, 'bad_request', err.expose ? err.message : 'Bad request');
  logger.error({ err, reqId: req.id, method: req.method, path: req.originalUrl, owner: req.ownerId && String(req.ownerId), app: req.cmsApp && String(req.cmsApp._id) }, '/v1 request failed');
  return v1Error(res, 500, 'internal', 'Internal server error');
});
module.exports = router;
