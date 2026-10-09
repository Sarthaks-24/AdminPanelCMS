const requireVerifiedSession = require('./requireVerifiedSession');

function requireSuperAdmin(req, res, next) {
  return requireVerifiedSession(req, res, () => {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'admin_required', message: 'Superadmin access required' });
    }
    return next();
  });
}

module.exports = requireSuperAdmin;
