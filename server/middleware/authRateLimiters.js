const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_ACCOUNT_ATTEMPTS = 5;

function rateLimitResponse(_req, res) {
  return res.status(429).json({
    success: false,
    error: 'rate_limited',
    message: 'Too many login attempts. Try again later.',
  });
}

const emailDigest = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email ? crypto.createHash('sha256').update(email).digest('hex') : '';
};

// Keyed on the pair, not the email alone: ten wrong guesses at a victim's address from one network
// must not lock the victim out from their own.
const emailIpKey = (req) => `${ipKeyGenerator(req.ip)}|${emailDigest(req) || 'missing'}`;

const loginByEmailAndIp = rateLimit({
  windowMs: WINDOW_MS,
  limit: MAX_LOGIN_ATTEMPTS,
  keyGenerator: emailIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

function createAccountLimiter(windowMs = 60 * 60 * 1000, limit = MAX_ACCOUNT_ATTEMPTS, keyGenerator = (req) => ipKeyGenerator(req.ip)) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (_req, res) => res.status(429).json({ success: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }),
  });
}

const emailKey = (req) => {
  const digest = emailDigest(req);
  return digest ? `email:${digest}` : `missing:${ipKeyGenerator(req.ip)}`;
};
const userKey = (req) => req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip);

module.exports = {
  loginRateLimiters: [loginByEmailAndIp],
  signupRateLimiters: [createAccountLimiter(60 * 60 * 1000, MAX_ACCOUNT_ATTEMPTS), createAccountLimiter(60 * 60 * 1000, MAX_ACCOUNT_ATTEMPTS, emailKey)],
  verificationRateLimiter: createAccountLimiter(60 * 60 * 1000, 5),
  resendVerificationRateLimiters: [createAccountLimiter(60 * 60 * 1000, 5), createAccountLimiter(60 * 60 * 1000, 5, emailIpKey)],
  // Per-recipient cooldowns live in lib/mailBudget.js (recipientAllowed); this is only the per-source cap.
  recoveryRateLimiters: [createAccountLimiter(60 * 60 * 1000, 5)],
  changePasswordRateLimiter: createAccountLimiter(60 * 60 * 1000, 5, userKey),
  accountDestructiveRateLimiter: createAccountLimiter(60 * 60 * 1000, 5, userKey),
  adminReauthRateLimiter: createAccountLimiter(15 * 60 * 1000, 10, userKey),
};
