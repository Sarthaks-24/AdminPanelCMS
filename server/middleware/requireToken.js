const { hashToken } = require('../lib/tokens');
const cache = require('../lib/cache');
const { ensureActiveTokensLoaded } = require('../lib/activeTokens');
const { takePreDbSlot } = require('./v1Limiters');
const { v1Error, V1_EXPOSE_HEADERS } = require('../lib/v1Errors');
const logger = require('../lib/logger');
const ApiToken = require('../models/ApiToken');
const App = require('../models/App');
const User = require('../models/User');

const TOKEN_FORMAT = /^(pk|sk)_live_[0-9A-Za-z]{43}$/;
// Single-flight token resolution: concurrent first requests with one token share one lookup.
const inflight = new Map();

async function resolveToken(tokenHash) {
  const tokenDoc = await ApiToken.findOne({ hash: tokenHash, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).lean();
  if (!tokenDoc) return null;
  const [appDoc, ownerUser] = await Promise.all([
    App.findOne({ _id: tokenDoc.app, owner: tokenDoc.owner }).lean(),
    User.findOne({ _id: tokenDoc.owner }).select('_id status').lean(),
  ]);
  if (!appDoc || !ownerUser) return null;
  return { tokenDoc, appDoc, ownerUser };
}

async function requireToken(req, res, next) {
  const invalid = () => v1Error(res, 401, 'token_invalid', 'Invalid, expired, or revoked API token');
  if (req.query.token !== undefined) return v1Error(res, 400, 'token_in_query', 'API tokens must be sent via Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) return v1Error(res, 401, 'token_missing', 'Authorization Bearer token required');
  const rawToken = match[1].trim();
  if (!TOKEN_FORMAT.test(rawToken)) return v1Error(res, 401, 'token_invalid', 'Malformed API token');
  const tokenHash = hashToken(rawToken);
  if (cache.badTokenCache.has(tokenHash)) return invalid();
  try {
    let entry = cache.tokenCache.get(tokenHash);
    // A revoke drops the hash from the active set; a cached entry must not outlive that.
    if (entry && cache.activeTokensLoaded() && !cache.isActiveToken(tokenHash)) {
      cache.tokenCache.delete(tokenHash);
      return invalid();
    }
    if (!entry) {
      // A hash outside the active set is rejected here with zero database work. Tokens written without
      // the model hooks (a script, a restore, another process) join the set at the next re-sync.
      const setReady = await ensureActiveTokensLoaded();
      if (setReady && !cache.isActiveToken(tokenHash)) return invalid();
      let pending = inflight.get(tokenHash);
      if (!pending) {
        if (!takePreDbSlot()) { res.setHeader('Retry-After', '1'); return v1Error(res, 503, 'busy', 'API is busy; retry shortly'); }
        pending = { gen: cache.tokenGen(), promise: resolveToken(tokenHash).finally(() => inflight.delete(tokenHash)) };
        inflight.set(tokenHash, pending);
      }
      entry = await pending.promise;
      // An eviction (revoke, suspend, App edit) during the resolve means its reads may predate the change:
      // read once more, outside the single-flight, and cache only a result no eviction raced (BE-01).
      let stable = cache.tokenGen() === pending.gen;
      if (!stable) {
        const gen = cache.tokenGen();
        entry = await resolveToken(tokenHash);
        stable = cache.tokenGen() === gen;
      }
      if (!entry) { cache.badTokenCache.set(tokenHash, true); cache.removeActiveToken(tokenHash); return invalid(); }
      if (stable) cache.tokenCache.set(tokenHash, entry);
    }
    const { tokenDoc, appDoc, ownerUser } = entry;
    if (tokenDoc.revokedAt || (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) <= new Date())) {
      cache.tokenCache.delete(tokenHash); cache.badTokenCache.set(tokenHash, true); cache.removeActiveToken(tokenHash);
      return invalid();
    }
    if (!ownerUser || ownerUser.status !== 'active') return v1Error(res, 401, 'account_unavailable', 'The account that owns this token is suspended or deactivated');
    // Belt to the dashboard's braces: a type flip revokes the other kind, but never serve a pk from a
    // protected app (its origin allowlist is empty) or an sk from a static one.
    if ((tokenDoc.type === 'pk' && appDoc.type !== 'static') || (tokenDoc.type === 'sk' && appDoc.type !== 'protected')) {
      return v1Error(res, 403, 'token_type_mismatch', `A ${tokenDoc.type}_ token cannot be used with a ${appDoc.type} app`);
    }
    if (tokenDoc.type === 'pk') {
      const origin = req.get('origin');
      const allowedOrigins = appDoc.allowedOrigins || [];
      if (origin && !allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) return v1Error(res, 403, 'origin_not_allowed', 'This origin is not allowed for this app');
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
        res.setHeader('Access-Control-Expose-Headers', V1_EXPOSE_HEADERS);
        res.setHeader('Vary', 'Authorization, Origin');
      }
    }
    req.cmsApp = appDoc;
    req.ownerId = appDoc.owner;
    req.tokenType = tokenDoc.type;
    req.tokenId = tokenDoc._id;
    if (cache.shouldWriteLastUsed(tokenDoc._id)) {
      ApiToken.updateOne({ _id: tokenDoc._id, owner: tokenDoc.owner }, { $set: { lastUsedAt: new Date() } })
        .catch((err) => logger.debug({ err, reqId: req.id, tokenId: String(tokenDoc._id) }, 'lastUsedAt write failed'));
    }
    return next();
  } catch (error) { return next(error); }
}
module.exports = requireToken;
