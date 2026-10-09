const express = require('express');
const crypto = require('crypto');
const sanitizeMongoInput = require('../middleware/sanitizeMongoInput');
const v1Cors = require('../middleware/v1Cors');
const { preAuthLimiter, tokenLimiter, ownerV1Limiter, globalV1Limiter } = require('../middleware/v1Limiters');
const requireToken = require('../middleware/requireToken');
const loadOwnerData = require('../lib/loadOwnerData');
const { applyInclude } = require('../lib/applyInclude');
const buildFsTree = require('../lib/buildFsTree');
const { responseCache, buildCacheKey } = require('../lib/cache');
const qString = require('../lib/qString');

const router = express.Router();
router.use(v1Cors, preAuthLimiter, express.json({ limit: '256kb' }), sanitizeMongoInput, requireToken, tokenLimiter, ownerV1Limiter, globalV1Limiter);
const error = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, error: code, message, ...extra });
function setHeaders(req, res, etag) {
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', req.tokenType === 'pk' ? 'public, max-age=60' : 'private, max-age=60');
  res.setHeader('Vary', 'Authorization, Origin');
}
function hasEtag(req, etag) {
  return (req.get('if-none-match') || '').split(',').map((item) => item.trim().replace(/^W\//, '')).includes(etag);
}
function sendData(req, res, body, key = buildCacheKey(req)) {
  const serialized = JSON.stringify(body);
  const etag = `"${crypto.createHash('sha256').update(serialized).digest('hex')}"`;
  responseCache.set(key, { body, etag, ownerId: String(req.ownerId) });
  setHeaders(req, res, etag);
  if (hasEtag(req, etag)) return res.status(304).end();
  return res.json(body);
}
function cached(req, res) {
  const item = responseCache.get(buildCacheKey(req));
  if (!item) return false;
  setHeaders(req, res, item.etag);
  if (hasEtag(req, item.etag)) res.status(304).end();
  else res.json(item.body);
  return true;
}
router.get('/app', (req, res) => sendData(req, res, {
  name: req.cmsApp.name, type: req.cmsApp.type,
  enabledSections: Object.entries(req.cmsApp.include || {}).filter(([, value]) => value?.enabled).map(([key]) => key),
}));
function section(key, options = () => ({})) {
  return async (req, res, next) => {
    try {
      if (!req.cmsApp.include?.[key]?.enabled) return error(res, 403, 'section_disabled', `The ${key} section is not enabled for this app`, { section: key });
      if (cached(req, res)) return;
      const cacheKey = buildCacheKey(req); // Taken before the load so a concurrent edit can't file stale data under the new version.
      const raw = await loadOwnerData(req.ownerId, [key]);
      const view = applyInclude(req.cmsApp, raw, options(req));
      return sendData(req, res, view[key] ?? null, cacheKey);
    } catch (err) { return next(err); }
  };
}
router.get('/profile', section('profile'));
router.get('/resume', section('resume'));
router.get('/socials', section('socials'));
router.get('/skills', section('skills', (req) => ({ category: qString(req, 'category') })));
router.get('/skills/categories', async (req, res, next) => {
  try {
    if (!req.cmsApp.include?.skills?.enabled) return error(res, 403, 'section_disabled', 'The skills section is not enabled for this app', { section: 'skills' });
    if (cached(req, res)) return;
    const cacheKey = buildCacheKey(req);
    const raw = await loadOwnerData(req.ownerId, ['skills']);
    const skills = applyInclude(req.cmsApp, raw).skills || [];
    const categoryById = new Map(raw.skills.map((item) => [String(item._id), item.category || 'Uncategorized']));
    const grouped = {};
    for (const item of skills) (grouped[categoryById.get(String(item._id))] ||= []).push(item);
    return sendData(req, res, grouped, cacheKey);
  } catch (err) { return next(err); }
});
router.get('/projects', section('projects', (req) => ({
  stack: qString(req, 'stack') || qString(req, 'tag'),
  featured: qString(req, 'featured') === 'true' ? true : undefined,
})));
router.get('/projects/:slug', async (req, res, next) => {
  try {
    if (!req.cmsApp.include?.projects?.enabled) return error(res, 403, 'section_disabled', 'The projects section is not enabled for this app', { section: 'projects' });
    if (cached(req, res)) return;
    const cacheKey = buildCacheKey(req);
    const raw = await loadOwnerData(req.ownerId, ['projects']);
    const project = applyInclude(req.cmsApp, raw, { slug: req.params.slug }).projects?.[0];
    if (!project) return error(res, 404, 'not_found', 'Project not found or not published');
    return sendData(req, res, project, cacheKey);
  } catch (err) { return next(err); }
});
for (const key of ['experience', 'education', 'certifications']) router.get(`/${key}`, section(key));
router.get('/fs', async (req, res, next) => {
  try {
    if (!req.cmsApp.include?.fs?.enabled) return error(res, 403, 'section_disabled', 'Virtual filesystem is not enabled for this app', { section: 'fs' });
    if (cached(req, res)) return;
    const cacheKey = buildCacheKey(req);
    const enabled = Object.entries(req.cmsApp.include || {}).filter(([key, value]) => key !== 'fs' && value?.enabled).map(([key]) => key);
    const view = applyInclude(req.cmsApp, await loadOwnerData(req.ownerId, enabled));
    return sendData(req, res, buildFsTree(view), cacheKey);
  } catch (err) { return next(err); }
});
module.exports = router;
