const mongoose = require('mongoose');
const App = require('../models/App');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const { PUBLIC_FIELDS, DEFAULT_FIELDS } = require('../lib/modelConstants');
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
const SINGLETON_MODELS = { profile: 'Profile', resume: 'Resume' };
const SECTION_KEYS = [...Object.keys(SINGLETON_MODELS), ...Object.keys(COLLECTION_MODELS), 'fs'];
const MAX_CATEGORIES = 50;
const MAX_CATEGORY_LENGTH = 60;
const editable = ['name', 'type', 'allowedOrigins', 'include'];
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const tokenKindFor = (appType) => (appType === 'static' ? 'pk' : 'sk');
const liveTokenFilter = (now = new Date()) => ({ revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] });

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

// Validates and normalises `fields[]` for one section: known public fields only, unique, capped (§4).
function validateFields(section, modelName, config, errors) {
  if (config.fields === undefined) return;
  const allowed = PUBLIC_FIELDS[modelName];
  if (!Array.isArray(config.fields)) { errors.push(`${section}.fields must be an array`); return; }
  if (config.fields.length > allowed.length) { errors.push(`${section}.fields may contain at most ${allowed.length} entries`); return; }
  const fields = config.fields.map((field) => (typeof field === 'string' ? field.trim() : field));
  const unknown = fields.filter((field) => !allowed.includes(field));
  if (unknown.length) errors.push(`${section}.fields contains invalid field${unknown.length > 1 ? 's' : ''}: ${unknown.slice(0, 5).map(String).join(', ')}`);
  if (new Set(fields).size !== fields.length) errors.push(`${section}.fields must not contain duplicate fields`);
  config.fields = [...new Set(fields)];
}

// `verifyIdsFor` lists the sections whose `ids` must be checked for ownership. On create that is every
// section; on update only the sections the client actually sent (stale stored ids are pruned beforehand, A15).
async function validateApp(ownerId, data, { verifyIdsFor = 'all', verifyCategories = true } = {}) {
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
  const allowedSections = new Set(SECTION_KEYS);
  for (const key of Object.keys(include)) if (!allowedSections.has(key)) errors.push(`include.${key} is not supported`);
  for (const [section, modelName] of Object.entries(COLLECTION_MODELS)) {
    const config = include[section];
    if (config === undefined) continue;
    if (!isRecord(config)) { errors.push(`${section} must be an object`); continue; }
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') errors.push(`${section}.enabled must be a boolean`);
    if (!['all', 'featured', 'selected'].includes(config.mode || 'all')) errors.push(`${section}.mode is invalid`);
    validateFields(section, modelName, config, errors);
    if (config.ids !== undefined && !Array.isArray(config.ids)) { errors.push(`${section}.ids must be an array`); continue; }
    const ids = config.ids || [];
    if (ids.length > LIMITS.itemsPerCollection) { errors.push(`${section}.ids may contain at most ${LIMITS.itemsPerCollection} ids`); continue; }
    if (ids.some((id) => !mongoose.isValidObjectId(id))) { errors.push(`${section}.ids contains invalid ObjectId`); continue; }
    const uniqueIds = [...new Set(ids.map(String))];
    if (uniqueIds.length !== ids.length) errors.push(`${section}.ids must not contain duplicate ids`);
    if (uniqueIds.length && (verifyIdsFor === 'all' || verifyIdsFor.has(section))) {
      const Model = mongoose.model(modelName);
      const owned = await Model.countDocuments({ owner: ownerId, _id: { $in: uniqueIds } });
      if (owned !== uniqueIds.length) errors.push(`${section}.ids contains unowned items`);
    }
  }
  for (const [section, modelName] of Object.entries(SINGLETON_MODELS)) {
    const config = include[section];
    if (config === undefined) continue;
    if (!isRecord(config)) { errors.push(`${section} must be an object`); continue; }
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') errors.push(`${section}.enabled must be a boolean`);
    validateFields(section, modelName, config, errors);
  }
  if (isRecord(include.skills) && include.skills.categories !== undefined) {
    const { categories } = include.skills;
    if (!Array.isArray(categories)) errors.push('skills.categories must be an array');
    else if (categories.length > MAX_CATEGORIES) errors.push(`skills.categories may contain at most ${MAX_CATEGORIES} entries`);
    else {
      const trimmed = categories.map((category) => (typeof category === 'string' ? category.trim() : category));
      if (trimmed.some((category) => typeof category !== 'string' || !category || category.length > MAX_CATEGORY_LENGTH)) {
        errors.push(`skills.categories entries must be non-empty strings of at most ${MAX_CATEGORY_LENGTH} characters`);
      } else {
        if (new Set(trimmed).size !== trimmed.length) errors.push('skills.categories must not contain duplicates');
        const unique = [...new Set(trimmed)];
        if (unique.length && verifyCategories) {
          // Categories are per owner (§2.6): only names the owner actually uses on a skill are accepted.
          const known = new Set(await mongoose.model('Skill').distinct('category', { owner: ownerId }));
          const unknown = unique.filter((category) => !known.has(category));
          if (unknown.length) errors.push(`skills.categories contains categories you have no skills in: ${unknown.slice(0, 5).join(', ')}`);
        }
        include.skills.categories = unique;
      }
    }
  }
  if (include.fs !== undefined && (!isRecord(include.fs) || (include.fs.enabled !== undefined && typeof include.fs.enabled !== 'boolean'))) errors.push('fs.enabled must be a boolean');
  data.include = include;
  return errors;
}

// Drops stored `selected` ids whose items no longer exist and stored skill categories the owner no longer
// uses (both can change outside the App editor), so a stale selection can never make the App unsaveable (B1).
// Returns the cleaned include and whether anything changed.
async function pruneStaleSelections(ownerId, include) {
  let changed = false;
  const cleaned = { ...include };
  const categories = cleaned.skills?.categories;
  if (Array.isArray(categories) && categories.length) {
    const known = new Set(await mongoose.model('Skill').distinct('category', { owner: ownerId }));
    const kept = categories.filter((category) => known.has(category));
    if (kept.length !== categories.length) { changed = true; cleaned.skills = { ...cleaned.skills, categories: kept }; }
  }
  for (const [section, modelName] of Object.entries(COLLECTION_MODELS)) {
    const ids = cleaned[section]?.ids;
    if (!Array.isArray(ids) || !ids.length) continue;
    const valid = ids.filter((id) => mongoose.isValidObjectId(id)).map(String);
    const existing = await mongoose.model(modelName).find({ owner: ownerId, _id: { $in: valid } }).select('_id').lean();
    const keep = new Set(existing.map((item) => String(item._id)));
    const kept = ids.filter((id) => keep.has(String(id)));
    if (kept.length !== ids.length) { changed = true; cleaned[section] = { ...cleaned[section], ids: kept }; }
  }
  return { include: cleaned, changed };
}

// B15: once an App changes type, every live token of the other kind is revoked and evicted from the cache.
async function revokeMismatchedTokens(ownerId, app) {
  const filter = { app: app._id, owner: ownerId, revokedAt: null, type: { $ne: tokenKindFor(app.type) } };
  const stale = await ApiToken.find(filter).select('hash').lean();
  if (!stale.length) return 0;
  await ApiToken.updateMany(filter, { $set: { revokedAt: new Date() } });
  for (const token of stale) evictTokenByHash(token.hash);
  return stale.length;
}

async function patchOwnedApp(ownerId, appId, body) {
  const app = await App.findOne({ _id: appId, owner: ownerId });
  if (!app) return { notFound: true };
  const patch = pickFields(body, editable);
  const stored = app.include?.toObject?.() || app.include || {};
  const pruned = await pruneStaleSelections(ownerId, stored);
  const merged = { ...app.toObject(), ...patch, include: pruned.include };
  const sentSections = new Set();
  let sentCategories = false;
  if (Object.hasOwn(patch, 'include')) {
    merged.include = mergeObject(pruned.include, patch.include);
    if (isRecord(patch.include)) {
      for (const section of Object.keys(COLLECTION_MODELS)) if (patch.include[section]?.ids !== undefined) sentSections.add(section);
      sentCategories = patch.include.skills?.categories !== undefined;
    }
  }
  const errors = await validateApp(ownerId, merged, { verifyIdsFor: sentSections, verifyCategories: sentCategories });
  if (errors.length) return { errors };
  const previousType = app.type;
  for (const field of editable) if (field in patch) app.set(field, merged[field]);
  if (pruned.changed && !('include' in patch)) app.set('include', merged.include);
  await app.save();
  evictApp(app._id);
  if (app.type !== previousType) await revokeMismatchedTokens(ownerId, app);
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
    const app = await App.findOne({ _id: req.params.id, owner: req.userId }).select('_id type').lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    const expectedKind = tokenKindFor(app.type);
    const tokens = await ApiToken.find({ app: app._id, owner: req.userId })
      .select('type prefix value label expiresAt lastUsedAt revokedAt createdAt +value').sort({ createdAt: -1 }).lean();
    return res.json(tokens.map((token) => {
      // sk values are never re-displayed; a pk value is only shown while the App still serves pk tokens.
      if (token.type === 'sk' || token.type !== expectedKind) delete token.value;
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
    const type = tokenKindFor(app.type);
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

// POST /api/apps/:id/check (contract §2.5): what this App would serve right now, and why it might serve nothing.
exports.checkApp = async (req, res, next) => {
  try {
    const owner = req.userId;
    const app = await App.findOne({ _id: req.params.id, owner }).lean();
    if (!app) return res.status(404).json({ success: false, error: 'not_found' });
    const include = app.include || {};
    const servedFields = (section, modelName) => (include[section]?.fields?.length ? include[section].fields : DEFAULT_FIELDS[modelName]);

    const [profile, resume, tokens] = await Promise.all([
      Profile.findOne({ owner }).select('configured').lean(),
      Resume.findOne({ owner }).select('_id').lean(),
      ApiToken.find({ app: app._id, owner, ...liveTokenFilter() }).select('prefix type lastUsedAt expiresAt').sort({ createdAt: -1 }).lean(),
    ]);
    const counts = await Promise.all(Object.values(COLLECTION_MODELS).map(async (modelName) => {
      const Model = mongoose.model(modelName);
      const [published, drafts] = await Promise.all([
        Model.countDocuments({ owner, visibility: 'published' }),
        Model.countDocuments({ owner, visibility: 'draft' }),
      ]);
      return [modelName, { published, drafts }];
    }));
    const countByModel = Object.fromEntries(counts);

    const sections = [
      { key: 'profile', enabled: Boolean(include.profile?.enabled), published: profile?.configured ? 1 : 0, drafts: 0, servedFields: servedFields('profile', 'Profile') },
      { key: 'resume', enabled: Boolean(include.resume?.enabled), published: resume ? 1 : 0, drafts: 0, servedFields: servedFields('resume', 'Resume') },
      ...Object.entries(COLLECTION_MODELS).map(([key, modelName]) => ({
        key, enabled: Boolean(include[key]?.enabled), ...countByModel[modelName], servedFields: servedFields(key, modelName),
      })),
      { key: 'fs', enabled: Boolean(include.fs?.enabled), published: 0, drafts: 0, servedFields: [] },
    ];

    const warnings = [];
    const contentSections = sections.filter((section) => section.key !== 'fs');
    if (!contentSections.some((section) => section.enabled)) warnings.push('no_sections_enabled');
    for (const section of contentSections) {
      if (!section.enabled) continue;
      if (section.key === 'profile') { if (!section.published) warnings.push('profile_missing'); continue; }
      if (section.key === 'resume') { if (!section.published) warnings.push('resume_missing'); continue; }
      if (section.published === 0) warnings.push(section.drafts > 0 ? `all_drafts:${section.key}` : `no_published:${section.key}`);
    }
    if (app.type === 'static' && (app.allowedOrigins || []).includes('*')) warnings.push('origin_star');
    if (!tokens.length) warnings.push('no_active_token');

    return res.json({
      success: true,
      app: { _id: app._id, name: app.name, type: app.type, allowedOrigins: app.allowedOrigins || [] },
      activeTokens: tokens.map((token) => ({ _id: token._id, prefix: token.prefix, type: token.type, lastUsedAt: token.lastUsedAt ?? null, expiresAt: token.expiresAt ?? null })),
      sections,
      warnings,
    });
  } catch (error) { return next(error); }
};

exports.validateApp = validateApp;
exports.patchOwnedApp = patchOwnedApp;
exports.removeOwnedApp = removeOwnedApp;
