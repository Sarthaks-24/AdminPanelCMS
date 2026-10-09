const pickFields = require('../lib/pickFields');

// Allowlist entries may be dotted paths (e.g. 'links.github'); pickFields resolves them against nested bodies.
module.exports = function pickWritable(allowedFields) {
  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('[SECURITY FATAL] pickWritable requires a non-empty field allowlist');
  }
  return (req, res, next) => {
    req.body = pickFields(req.body, allowedFields);
    next();
  };
};
