const { hashToken } = require('../lib/tokens');
const { tokenCache, badTokenCache, shouldWriteLastUsed } = require('../lib/cache');
const ApiToken = require('../models/ApiToken');
const App = require('../models/App');
const User = require('../models/User');

async function requireToken(req, res, next) {
  const fail = (status, error, message) => res.status(status).json({ success: false, error, message });
  if (req.query.token !== undefined) return fail(400, 'token_in_query', 'API tokens must be sent via Authorization header');
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) return fail(401, 'token_missing', 'Authorization Bearer token required');
  const rawToken = match[1].trim();
  if (!/^(pk|sk)_live_[0-9A-Za-z]{43}$/.test(rawToken)) return fail(401, 'token_invalid', 'Malformed API token');
  const tokenHash = hashToken(rawToken);
  if (badTokenCache.has(tokenHash)) return fail(401, 'token_invalid', 'Invalid, expired, or revoked API token');
  try {
    let cached = tokenCache.get(tokenHash);
    if (!cached) {
      const tokenDoc = await ApiToken.findOne({ hash: tokenHash, revokedAt: null, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).lean();
      if (!tokenDoc) { badTokenCache.set(tokenHash, true); return fail(401, 'token_invalid', 'Invalid, expired, or revoked API token'); }
      const [appDoc, ownerUser] = await Promise.all([
        App.findOne({ _id: tokenDoc.app, owner: tokenDoc.owner }).lean(),
        User.findOne({ _id: tokenDoc.owner, status: 'active' }).select('_id status').lean(),
      ]);
      if (!appDoc || !ownerUser) { badTokenCache.set(tokenHash, true); return fail(401, 'token_invalid', 'Token app or account is unavailable'); }
      cached = { tokenDoc, appDoc, ownerUser };
      tokenCache.set(tokenHash, cached);
    }
    const { tokenDoc, appDoc, ownerUser } = cached;
    if (tokenDoc.revokedAt || (tokenDoc.expiresAt && new Date(tokenDoc.expiresAt) <= new Date())) {
      tokenCache.delete(tokenHash); badTokenCache.set(tokenHash, true);
      return fail(401, 'token_invalid', 'Invalid, expired, or revoked API token');
    }
    if (!ownerUser || ownerUser.status !== 'active') return fail(401, 'account_inactive', 'Account is suspended or deactivated');
    if (tokenDoc.type === 'pk') {
      const origin = req.get('origin');
      if (!origin) return fail(403, 'origin_required', 'Origin header is required for publishable tokens');
      if (!(appDoc.allowedOrigins || []).includes(origin)) return fail(403, 'origin_not_allowed', 'This origin is not allowed for this app');
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Expose-Headers', 'ETag, Retry-After, RateLimit, RateLimit-Policy');
      res.setHeader('Vary', 'Authorization, Origin');
    }
    req.cmsApp = appDoc;
    req.ownerId = appDoc.owner;
    req.tokenType = tokenDoc.type;
    req.tokenId = tokenDoc._id;
    if (shouldWriteLastUsed(tokenDoc._id)) ApiToken.updateOne({ _id: tokenDoc._id }, { $set: { lastUsedAt: new Date() } }).catch(() => {});
    return next();
  } catch (error) { return next(error); }
}
module.exports = requireToken;
