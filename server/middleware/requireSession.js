const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { readSessionCookie } = require('../lib/sessionCookie');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

async function requireSession(req, res, next) {
  const header = req.headers.authorization;
  let token;
  if (header?.startsWith('Bearer ')) {
    token = header.slice(7);
  } else {
    token = readSessionCookie(req);
    if (!token) return res.status(401).json({ success: false, error: 'auth_required', message: 'Sign in required' });
    // Cookie sessions are ambient credentials, so state changes need a header a cross-site form cannot send.
    // The custom header forces a CORS preflight, which only the configured dashboard origin passes.
    if (!SAFE_METHODS.has(req.method) && req.get('x-requested-with') !== 'XMLHttpRequest') {
      return res.status(403).json({ success: false, error: 'csrf_rejected', message: 'Missing request header' });
    }
  }
  if (token.startsWith('pk_') || token.startsWith('sk_')) {
    return res.status(401).json({ success: false, error: 'invalid_token_type', message: 'API tokens cannot access dashboard sessions' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub || typeof payload.tv !== 'number') {
      return res.status(401).json({ success: false, error: 'invalid_session', message: 'Please log in again' });
    }
    // ownerGuard-exemption: User is an identity lookup, not tenant content
    const user = await User.findById(payload.sub).select('_id email tokenVersion status emailVerifiedAt acceptedTermsAt role');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, error: 'account_inactive', message: 'Account is invalid or deactivated' });
    }
    if (payload.tv !== user.tokenVersion) {
      return res.status(401).json({ success: false, error: 'session_expired', message: 'Session expired due to password change' });
    }
    req.userId = user._id;
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'invalid_session', message: 'Session expired or invalid signature' });
  }
}

module.exports = requireSession;
