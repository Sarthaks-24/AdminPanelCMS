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
module.exports = { preAuthLimiter, tokenLimiter, globalV1Limiter };
