const express = require('express');
const crypto = require('crypto');
const v1Cors = require('../middleware/v1Cors');
const sanitizeQuery = require('../middleware/sanitizeQuery');
const { preAuthLimiter, tokenLimiter, tokenCeilingLimiter, chargeMiss } = require('../middleware/v1Limiters');
const requireToken = require('../middleware/requireToken');
const loadOwnerData = require('../lib/loadOwnerData');
const { applyInclude } = require('../lib/applyInclude');
const buildFsTree = require('../lib/buildFsTree');
const { responseCache, buildCacheKey, normalizedFilters } = require('../lib/cache');
const { v1Error } = require('../lib/v1Errors');
const logger = require('../lib/logger');

// Any single /v1 body above this is a bug or an abuse case, never a legitimate response.
const MAX_RESPONSE_BYTES = 1024 * 1024;

const router = express.Router();
// Chain (council design): cors → IP limiter → query sanitizer → token (hash set, pre-DB bucket,
// origin) → per-token limiters → [route: section guard → cache lookup → miss budget → load].
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
function makeEntry(data, ownerId) {
  const serialized = JSON.stringify({ data });
  const etag = `"${crypto.createHash('sha256').update(serialized).digest('hex')}"`;
  return { serialized, etag, ownerId: String(ownerId), bytes: Buffer.byteLength(serialized) };
}
function send(req, res, entry) {
  setHeaders(res, entry.etag);
  if (hasEtag(req, entry.etag)) return res.status(304).end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.send(entry.serialized);
}
// Router-level cache lookup: a hit answers (200 or 304) before any budget is charged.
function cacheLookup(req, res, next) {
  const entry = responseCache.get(buildCacheKey(req));
  res.locals.cacheHit = Boolean(entry);
  if (!entry) return next();
  return send(req, res, entry);
}
function sectionEnabled(key, message = `The ${key} section is not enabled for this app`) {
  return (req, res, next) => (req.cmsApp.include?.[key]?.enabled ? next() : v1Error(res, 403, 'section_disabled', message, { section: key }));
}
const enabledSections = (req) => Object.entries(req.cmsApp.include || {}).filter(([key, value]) => key !== 'fs' && value?.enabled).map(([key]) => key);
const notConfigured = (what) => ({ error: { status: 404, code: 'not_configured', message: `The ${what} has not been set up yet` } });
const notFound = (message) => ({ error: { status: 404, code: 'not_found', message } });

// Single-flight miss handling: the first request for a key charges the owner and global miss
// budgets (weighted by `units`) and loads; concurrent requests for the same key wait for it.
// The key is taken before the load so a concurrent edit cannot file stale data under the new version.
const inflight = new Map();
function respond(units, produce) {
  return async (req, res, next) => {
    try {
      const key = buildCacheKey(req);
      let pending = inflight.get(key);
      if (!pending) {
        const charge = chargeMiss(req.ownerId, units(req));
        if (!charge.ok) { res.setHeader('Retry-After', '1'); return v1Error(res, charge.status, charge.code, charge.message); }
        pending = produce(req).then((result) => {
          if (result.error) return result;
          const entry = makeEntry(result.data, req.ownerId);
          if (entry.bytes > MAX_RESPONSE_BYTES) return { oversize: entry.bytes };
          responseCache.set(key, entry); // bodies above the item cap are served but not stored
          return { entry };
        }).finally(() => inflight.delete(key));
        inflight.set(key, pending);
      }
      const result = await pending;
      if (result.error) return v1Error(res, result.error.status, result.error.code, result.error.message, result.error.extra);
      if (result.oversize) {
        logger.error({ reqId: req.id, owner: String(req.ownerId), app: String(req.cmsApp._id), path: req.path, bytes: result.oversize }, '/v1 response exceeds the 1 MB ceiling');
        return v1Error(res, 500, 'internal', 'Response too large to serve');
      }
      return send(req, res, result.entry);
    } catch (err) { return next(err); }
  };
}
const one = () => 1;
const list = (key, options = () => ({})) => async (req) => ({ data: applyInclude(req.cmsApp, await loadOwnerData(req.ownerId, [key]), options(req))[key] || [] });

router.get('/app', cacheLookup, (req, res) => {
  const entry = makeEntry({
    name: req.cmsApp.name, type: req.cmsApp.type,
    enabledSections: Object.entries(req.cmsApp.include || {}).filter(([, value]) => value?.enabled).map(([key]) => key),
  }, req.ownerId);
  responseCache.set(buildCacheKey(req), entry);
  return send(req, res, entry);
});
router.get('/profile', sectionEnabled('profile'), cacheLookup, respond(one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['profile']);
  if (!raw.profile?.configured) return notConfigured('profile');
  return { data: applyInclude(req.cmsApp, raw).profile };
}));
router.get('/resume', sectionEnabled('resume'), cacheLookup, respond(one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['resume']);
  if (!raw.resume) return notConfigured('resume');
  return { data: applyInclude(req.cmsApp, raw).resume };
}));
router.get('/socials', sectionEnabled('socials'), cacheLookup, respond(one, list('socials')));
router.get('/skills', sectionEnabled('skills'), cacheLookup, respond(one, list('skills', normalizedFilters)));
router.get('/skills/categories', sectionEnabled('skills'), cacheLookup, respond(one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['skills']);
  const skills = applyInclude(req.cmsApp, raw).skills || [];
  const categoryById = new Map(raw.skills.map((item) => [String(item._id), item.category || 'Uncategorized']));
  const grouped = {};
  for (const item of skills) (grouped[categoryById.get(String(item._id))] ||= []).push(item);
  return { data: grouped };
}));
router.get('/projects', sectionEnabled('projects'), cacheLookup, respond(one, list('projects', normalizedFilters)));
router.get('/projects/:slug', sectionEnabled('projects'), cacheLookup, respond(one, async (req) => {
  const raw = await loadOwnerData(req.ownerId, ['projects']);
  const project = applyInclude(req.cmsApp, raw, { slug: req.params.slug }).projects?.[0];
  return project ? { data: project } : notFound('Project not found or not published');
}));
for (const key of ['experience', 'education', 'certifications']) router.get(`/${key}`, sectionEnabled(key), cacheLookup, respond(one, list(key)));
router.get('/fs', sectionEnabled('fs', 'Virtual filesystem is not enabled for this app'), cacheLookup,
  respond((req) => enabledSections(req).length, async (req) => {
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
