const mongoose = require('mongoose');

function sanitizeObject(value) {
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || value instanceof mongoose.Types.ObjectId) return value;
  if (Array.isArray(value)) return value.map(sanitizeObject);
  const result = Object.create(null);
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || ['__proto__', 'prototype', 'constructor'].includes(key)) continue;
    result[key] = sanitizeObject(child);
  }
  return result;
}

module.exports = function sanitizeMongoInput(req, res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeObject(req.body);
  next();
};
