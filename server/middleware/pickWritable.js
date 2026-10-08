module.exports = function pickWritable(allowedFields) {
  if (!Array.isArray(allowedFields) || allowedFields.length === 0) {
    throw new Error('[SECURITY FATAL] pickWritable requires a non-empty field allowlist');
  }
  return (req, res, next) => {
    const source = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const body = {};
    for (const field of allowedFields) if (source[field] !== undefined) body[field] = source[field];
    req.body = body;
    next();
  };
};
