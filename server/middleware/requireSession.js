const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireSession(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'auth_required', message: 'Bearer token required' });
  }
  const token = header.slice(7);
  if (token.startsWith('pk_') || token.startsWith('sk_')) {
    return res.status(401).json({ success: false, error: 'invalid_token_type', message: 'API tokens cannot access dashboard sessions' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.sub || typeof payload.tv !== 'number') {
      return res.status(401).json({ success: false, error: 'invalid_session', message: 'Please log in again' });
    }
    // ownerGuard-exemption: User is an identity lookup, not tenant content
    const user = await User.findById(payload.sub).select('_id email tokenVersion status emailVerifiedAt');
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
