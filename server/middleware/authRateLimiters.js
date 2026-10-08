const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

function rateLimitResponse(_req, res) {
  return res.status(429).json({
    success: false,
    error: 'rate_limited',
    message: 'Too many login attempts. Try again later.',
  });
}

const loginByIp = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_LOGIN_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

const loginByEmail = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_LOGIN_ATTEMPTS,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) return `missing:${ipKeyGenerator(req.ip)}`;
    const digest = crypto.createHash('sha256').update(email).digest('hex');
    return `email:${digest}`;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

module.exports = { loginRateLimiters: [loginByIp, loginByEmail] };
