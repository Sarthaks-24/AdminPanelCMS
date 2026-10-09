const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const preAuthLimiter = rateLimit({
  windowMs: 60_000, limit: 300, keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: 'rate_limited', message: 'Too many requests' }),
});
const tokenLimiter = rateLimit({
  windowMs: 60_000, limit: (req) => req.tokenType === 'sk' ? 600 : 60,
  keyGenerator: (req) => String(req.tokenId), standardHeaders: 'draft-7', legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ success: false, error: 'rate_limited', message: 'Token request limit exceeded' }),
});

// Process-wide token bucket bounds aggregate cache misses and request work.
const capacity = 25, refillPerMs = 25 / 1000;
let tokens = capacity, updatedAt = Date.now();
// Per-owner cap so one tenant cannot drain the shared bucket and 503 everyone else.
const ownerBuckets = new Map();
const OWNER_LIMIT_PER_SEC = 12;
setInterval(() => {
  const second = Math.floor(Date.now() / 1000);
  for (const [k, v] of ownerBuckets) if (v.second !== second) ownerBuckets.delete(k);
}, 60_000).unref();
function ownerV1Limiter(req, res, next) {
  const key = String(req.ownerId);
  const second = Math.floor(Date.now() / 1000);
  let bucket = ownerBuckets.get(key);
  if (!bucket || bucket.second !== second) {
    bucket = { second, count: 0 };
    ownerBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > OWNER_LIMIT_PER_SEC) {
    res.setHeader('Retry-After', '1');
    return res.status(429).json({ success: false, error: 'rate_limited', message: 'Account request limit exceeded' });
  }
  return next();
}
function globalV1Limiter(req, res, next) {
  const now = Date.now();
  tokens = Math.min(capacity, tokens + (now - updatedAt) * refillPerMs);
  updatedAt = now;
  if (tokens < 1) {
    res.setHeader('Retry-After', '1');
    return res.status(503).json({ success: false, error: 'busy', message: 'API is busy; retry shortly' });
  }
  tokens -= 1;
  return next();
}
module.exports = { preAuthLimiter, tokenLimiter, ownerV1Limiter, globalV1Limiter };
