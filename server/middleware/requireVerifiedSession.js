const requireSession = require('./requireSession');

function requireVerifiedSession(req, res, next) {
  return requireSession(req, res, () => {
    if (!req.user.emailVerifiedAt) {
      return res.status(403).json({
        success: false,
        error: 'email_unverified',
        message: 'Verify your email before changing content',
      });
    }
    return next();
  });
}

module.exports = requireVerifiedSession;
