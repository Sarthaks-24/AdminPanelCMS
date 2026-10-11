// Query-string counterpart of sanitizeMongoInput for the body-less /v1 router: drops keys that
// could be read as Mongo operators or prototype paths. Values are left alone (qString only ever
// hands strings to the projection layer). Express 5 exposes req.query through a prototype getter,
// so the cleaned copy is pinned as an own property.
const BANNED = new Set(['__proto__', 'prototype', 'constructor']);

function sanitizeValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    const clean = Object.create(null);
    for (const [key, child] of Object.entries(value)) if (!key.startsWith('$') && !key.includes('.') && !BANNED.has(key)) clean[key] = sanitizeValue(child);
    return clean;
  }
  return value;
}

function sanitizeQuery(req, res, next) {
  const clean = sanitizeValue(req.query && typeof req.query === 'object' ? req.query : {});
  Object.defineProperty(req, 'query', { value: clean, writable: true, configurable: true, enumerable: true });
  next();
}

module.exports = sanitizeQuery;
