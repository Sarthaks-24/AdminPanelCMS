const mongoose = require('mongoose');
const App = require('../models/App');
const { PUBLIC_FIELDS } = require('../lib/modelConstants');
const LIMITS = require('../config/limits');
const pickFields = require('../lib/pickFields');
const loadOwnerData = require('../lib/loadOwnerData');
const { applyInclude } = require('../lib/applyInclude');
const buildFsTree = require('../lib/buildFsTree');
const contentChanged = require('../lib/onContentChanged');
const ApiToken = require('../models/ApiToken');
const { generateToken } = require('../lib/tokens');
const { evictApp, evictTokenByHash } = require('../lib/cache');

const COLLECTION_MODELS = {
  socials: 'Social', skills: 'Skill', projects: 'Project', experience: 'Experience',
  education: 'Education', certifications: 'Certification',
};
const SKILL_CATEGORIES = ['Languages', 'Frontend', 'Backend & Systems', 'Databases & Caching', 'DevOps & Cloud', 'Hardware & Electronics', 'Tools & Frameworks'];
const editable = ['name', 'type', 'allowedOrigins', 'include'];
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function normalizeOrigin(value) {
  if (value === '*') return '*';
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const local = process.env.NODE_ENV !== 'production' && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.username || url.password || (url.protocol !== 'https:' && !local) || url.origin === 'null') return null;
    return url.origin.toLowerCase();
  } catch { return null; }
}

function mergeObject(base, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === 'object' && !Array.isArray(value) ? mergeObject(out[key], value) : value;
  }
  return out;
}

async function validateApp(ownerId, data) {
  const errors = [];
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 80) errors.push('name is required and must be at most 80 characters');
  if (!['static', 'protected'].includes(data.type)) errors.push('type must be static or protected');
  if (data.allowedOrigins === undefined) data.allowedOrigins = data.type === 'static' ? ['*'] : [];
  if (!Array.isArray(data.allowedOrigins)) errors.push('allowedOrigins must be an array');
  if (data.type === 'static' && Array.isArray(data.allowedOrigins) && data.allowedOrigins.length === 0) data.allowedOrigins = ['*'];
  const origins = Array.isArray(data.allowedOrigins) ? data.allowedOrigins.map(normalizeOrigin) : [];
  if (origins.includes(null)) errors.push('allowedOrigins must contain valid HTTPS origins (HTTP localhost is allowed outside production)');
  if (origins.includes('*') && origins.length !== 1) errors.push('* must be the only allowed origin');
  if (new Set(origins).size !== origins.length) errors.push('allowedOrigins must not contain duplicates');
  if (origins.length > 10) errors.push('max 10 allowedOrigins');
  if (data.type === 'static' && !origins.length) errors.push('static apps require an allowed origin or *');
  data.allowedOrigins = origins.filter(Boolean);
  if (data.include !== undefined && !isRecord(data.include)) errors.push('include must be an object');
  const include = isRecord(data.include) ? data.include : {};
  const allowedSections = new Set(['profile', 'resume', ...Object.keys(COLLECTION_MODELS), 'fs']);
  for (const key of Object.keys(include)) if (!allowedSections.has(key)) errors.push(`include.${key} is not supported`);
  for (const [section, modelName] of Object.entries(COLLECTION_MODELS)) {
    const config = include[section];
    if (config === undefined) continue;
    if (!isRecord(config)) { errors.push(`${section} must be an object`); continue; }
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') errors.push(`${section}.enabled must be a boolean`);
    if (!['all', 'featured', 'selected'].includes(config.mode || 'all')) errors.push(`${section}.mode is invalid`);
    if (config.fields !== undefined && (!Array.isArray(config.fields) || config.fields.some((field) => !PUBLIC_FIELDS[modelName].includes(field)))) errors.push(`${section}.fields contains invalid field`);
    if (config.ids !== undefined && !Array.isArray(config.ids)) { errors.push(`${section}.ids must be an array`); continue; }
    const ids = config.ids || [];
    if (ids.some((id) => !mongoose.isValidObjectId(id))) { errors.push(`${section}.ids contains invalid ObjectId`); continue; }
    const uniqueIds = [...new Set(ids.map(String))];
    if (uniqueIds.length !== ids.length) errors.push(`${section}.ids must not contain duplicate ids`);
    if (uniqueIds.length) {
      const Model = mongoose.model(modelName);
      const owned = await Model.countDocuments({ owner: ownerId, _id: { $in: uniqueIds } });
      if (owned !== uniqueIds.length) errors.push(`${section}.ids contains unowned items`);
    }
  }
  for (const [section, modelName] of [['profile', 'Profile'], ['resume', 'Resume']]) {
    const config = include[section];
    if (config === undefined) continue;
    if (!isRecord(config)) { errors.push(`${section} must be an object`); continue; }
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') errors.push(`${section}.enabled must be a boolean`);
    if (config.fields !== undefined && (!Array.isArray(config.fields) || config.fields.some((field) => !PUBLIC_FIELDS[modelName].includes(field)))) errors.push(`${section}.fields contains invalid field`);
  }
  if (include.skills?.categories !== undefined && (!Array.isArray(include.skills.categories) || include.skills.categories.some((category) => !SKILL_CATEGORIES.includes(category)))) errors.push('skills.categories contains invalid category');
  if (include.fs !== undefined && (!isRecord(include.fs) || (include.fs.enabled !== undefined && typeof include.fs.enabled !== 'boolean'))) errors.push('fs.enabled must be a boolean');
  data.include = include;
  return errors;
}

async function patchOwnedApp(ownerId, appId, body) {
  const app = await App.findOne({ _id: appId, owner: ownerId });
  if (!app) return { notFound: true };
  const patch = pickFields(body, editable);
  const merged = { ...app.toObject(), ...patch };
  if (Object.hasOwn(patch, 'include')) merged.include = mergeObject(app.include?.toObject?.() || app.include || {}, patch.include);
  const errors = await validateApp(ownerId, merged);
  if (errors.length) return { errors };
  for (const field of editable) if (field in patch) app.set(field, merged[field]);
  await app.save();
  evictApp(app._id);
  await contentChanged.onContentChanged(ownerId);
  const response = app.toObject({ getters: false, virtuals: false });
  delete response.quotaSlot;
  return { app, response };
}

async function removeOwnedApp(ownerId, appId) {
  const app = await App.findOneAndDelete({ _id: appId, owner: ownerId });
  if (!app) return null;
  evictApp(app._id);
  const tokens = await ApiToken.find({ app: app._id, owner: ownerId, revokedAt: null }).select('hash').lean();
  await ApiToken.updateMany({ app: app._id, owner: ownerId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  for (const token of tokens) evictTokenByHash(token.hash);
  await contentChanged.onContentChanged(ownerId);
  return app;
}

exports.listApps = async (req, res, next) => {
  try { res.json(await App.find({ owner: req.userId }).sort({ createdAt: -1 }).select('-quotaSlot').lean()); }
  catch (error) { next(error); }
};

exports.getApp = async (req, res, next) => {
  try {
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).select('-quotaSlot').lean();
    return app ? res.json(app) : res.status(404).json({ success: false, error: 'not_found' });
  } catch (error) { return next(error); }
};

exports.createApp = async (req, res, next) => {
  try {
    const payload = pickFields(req.body, editable);
    if (payload.allowedOrigins === undefined) payload.allowedOrigins = [];
    const errors = await validateApp(req.userId, payload);
    if (errors.length) return res.status(400).json({ success: false, error: 'validation_failed', details: errors });
    // A unique owner/slot index makes the per-owner limit safe across concurrent server processes.
    for (let quotaSlot = 0; quotaSlot < LIMITS.appsPerOwner; quotaSlot += 1) {
      try {
        const app = await App.create({ ...payload, owner: req.userId, quotaSlot });
        await contentChanged.onContentChanged(req.userId);
        const response = app.toObject({ getters: false, virtuals: false });
        delete response.quotaSlot;
        return res.status(201).json(response);
      } catch (error) {
        if (error.code === 11000) continue;
        throw error;
      }
    }
    return res.status(403).json({ success: false, error: 'quota_exceeded', resource: 'apps', limit: LIMITS.appsPerOwner });
  } catch (error) { next(error); }
};

exports.updateApp = async (req, res, next) => {
  try {
    const result = await patchOwnedApp(req.userId, req.params.id, req.body);
    if (result.notFound) return res.status(404).json({ success: false, error: 'not_found' });
    if (result.errors) return res.status(400).json({ success: false, error: 'validation_failed', details: result.errors });
    return res.json(result.response);
  } catch (error) { next(error); }
};

exports.deleteApp = async (req, res, next) => {
  try {
    const app = await removeOwnedApp(req.userId, req.params.id);
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    return res.json({ success: true });
  } catch (error) { next(error); }
};

exports.getTokens = async (req, res, next) => {
  try {
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).select('_id').lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    const tokens = await ApiToken.find({ app: app._id, owner: req.userId })
      .select('type prefix value label expiresAt lastUsedAt revokedAt createdAt +value').sort({ createdAt: -1 }).lean();
    return res.json(tokens.map((token) => {
      if (token.type === 'sk') delete token.value;
      return token;
    }));
  } catch (error) { return next(error); }
};

exports.createToken = async (req, res, next) => {
  try {
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).select('_id type').lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    if (!req.user.emailVerifiedAt) return res.status(403).json({ success: false, error: 'email_unverified', message: 'Verify your email before creating API tokens' });
    const now = new Date();
    await ApiToken.updateMany({ app: app._id, owner: req.userId, revokedAt: null, expiresAt: { $lte: now } }, { $set: { revokedAt: now } });
    const type = app.type === 'static' ? 'pk' : 'sk';
    const days = [30, 90, 365].includes(Number(req.body?.expiresInDays)) ? Number(req.body.expiresInDays) : null;
    const generated = generateToken(type);
    for (const quotaSlot of [0, 1]) {
      try {
        await ApiToken.create({ owner: req.userId, app: app._id, quotaSlot, type,
          prefix: generated.prefix, hash: generated.hash, value: type === 'pk' ? generated.token : null,
          label: String(req.body?.label || '').trim().slice(0, 60),
          expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null });
        return res.status(201).json({ token: generated.token, type, prefix: generated.prefix, shownOnce: type === 'sk' });
      } catch (error) { if (error.code !== 11000) throw error; }
    }
    return res.status(403).json({ success: false, error: 'quota_exceeded', resource: 'tokens', limit: 2, message: 'Maximum of 2 active tokens per app reached. Revoke an existing token first.' });
  } catch (error) { return next(error); }
};

exports.revokeToken = async (req, res, next) => {
  try {
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).select('_id').lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    const token = await ApiToken.findOneAndUpdate({ _id: req.params.tokenId, app: app._id, owner: req.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } }, { returnDocument: 'after' });
    if (!token) return res.status(404).json({ success: false, error: 'not_found' });
    evictTokenByHash(token.hash);
    return res.json({ success: true });
  } catch (error) { return next(error); }
};

exports.getAppPreview = async (req, res, next) => {
  try {
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    const enabled = Object.entries(app.include || {}).filter(([key, value]) => key !== 'fs' && value?.enabled).map(([key]) => key);
    const raw = await loadOwnerData(req.userId, enabled);
    const view = applyInclude(app, raw);
    if (app.include?.fs?.enabled) view.fs = buildFsTree(view);
    return res.json(view);
  } catch (error) { next(error); }
};

exports.validateApp = validateApp;
exports.patchOwnedApp = patchOwnedApp;
exports.removeOwnedApp = removeOwnedApp;
