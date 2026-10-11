const requireVerifiedSession = require('./requireVerifiedSession');

// How long a superadmin password re-check stays valid for destructive platform actions.
const REAUTH_WINDOW_MS = 10 * 60 * 1000;

function requireSuperAdmin(req, res, next) {
  return requireVerifiedSession(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'admin_required', message: 'Superadmin access required' });
    }
    return next();
  });
}

// Destructive actions (suspend, delete) also need the password to have been re-entered within the window.
function requireRecentReauth(req, res, next) {
  const at = req.user?.adminReauthAt ? new Date(req.user.adminReauthAt).getTime() : 0;
  if (!at || Date.now() - at > REAUTH_WINDOW_MS) {
    return res.status(403).json({ success: false, error: 'reauth_required', message: 'Confirm your password to continue' });
  }
  return next();
}

module.exports = requireSuperAdmin;
module.exports.requireRecentReauth = requireRecentReauth;
module.exports.REAUTH_WINDOW_MS = REAUTH_WINDOW_MS;
