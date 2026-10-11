const crypto = require('node:crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator, MemoryStore } = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;
const MAX_LOGIN_PER_IP = 30;
const MAX_LOGIN_PER_EMAIL = 50;
const MAX_ACCOUNT_ATTEMPTS = 5;

// Every limiter keeps its own memory store so tests (and nothing else) can clear them all at once. Limits live in
// process memory and reset on restart; that is the documented single-replica tradeoff (docs/OPERATIONS.md).
const stores = [];
function limiter(options) {
  const store = new MemoryStore();
  stores.push(store);
  return rateLimit({ standardHeaders: true, legacyHeaders: false, store, ...options });
}

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

// IPv6 clients are grouped by /56 (one home or office allocation) unless a caller asks for a wider prefix.
const ipKey = (req, subnet = 56) => ipKeyGenerator(req.ip, subnet);

// Keyed on the pair, not the email alone: ten wrong guesses at a victim's address from one network
// must not lock the victim out from their own.
const emailIpKey = (req) => `${ipKey(req)}|${emailDigest(req) || 'missing'}`;

const loginByEmailAndIp = limiter({
  windowMs: WINDOW_MS,
  limit: MAX_LOGIN_ATTEMPTS,
  keyGenerator: emailIpKey,
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

// SEC4: one source rotating through many addresses. Every failed login costs a bcrypt compare, so the per-source
// budget is what keeps a single network from saturating the CPU.
const loginByIp = limiter({
  windowMs: WINDOW_MS,
  limit: MAX_LOGIN_PER_IP,
  keyGenerator: (req) => ipKey(req),
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

// Soft cap for one address across every source (credential spraying from a botnet). It is deliberately loose
// (50 failures an hour) so a griefer needs real volume to delay the victim, and a success does not count.
const loginByEmail = limiter({
  windowMs: HOUR_MS,
  limit: MAX_LOGIN_PER_EMAIL,
  keyGenerator: (req) => `email:${emailDigest(req) || `missing:${ipKey(req)}`}`,
  skipSuccessfulRequests: true,
  handler: rateLimitResponse,
});

function createAccountLimiter(windowMs = HOUR_MS, limit = MAX_ACCOUNT_ATTEMPTS, keyGenerator = (req) => ipKeyGenerator(req.ip)) {
  return limiter({
    windowMs,
    limit,
    keyGenerator,
    handler: (_req, res) => res.status(429).json({ success: false, error: 'rate_limited', message: 'Too many requests. Try again later.' }),
  });
}

const userKey = (req) => req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip);

// Clears every auth limiter. Test hook only.
async function resetAuthRateLimiters() {
  await Promise.all(stores.map((store) => store.resetAll()));
}

module.exports = {
  loginRateLimiters: [loginByIp, loginByEmail, loginByEmailAndIp],
  // SEC7: the second signup limiter is keyed on (IP, email) like login, so nobody can lock a victim's address
  // out of registration by signing it up from elsewhere; the per-recipient mail cooldown protects the inbox.
  signupRateLimiters: [createAccountLimiter(HOUR_MS, MAX_ACCOUNT_ATTEMPTS), createAccountLimiter(HOUR_MS, MAX_ACCOUNT_ATTEMPTS, emailIpKey)],
  // SEC19: verify-email and reset-password have separate budgets so one cannot starve the other behind a NAT.
  verifyEmailRateLimiter: createAccountLimiter(HOUR_MS, 5),
  resetPasswordRateLimiter: createAccountLimiter(HOUR_MS, 5),
  resendVerificationRateLimiters: [createAccountLimiter(HOUR_MS, 5), createAccountLimiter(HOUR_MS, 5, emailIpKey)],
  // Per-recipient cooldowns live in lib/mailBudget.js (recipientAllowed); this is only the per-source cap, keyed
  // at /48 (SEC6) so rotating through one IPv6 allocation cannot drain the reset reserve.
  recoveryRateLimiters: [createAccountLimiter(HOUR_MS, 5, (req) => ipKey(req, 48))],
  changePasswordRateLimiter: createAccountLimiter(HOUR_MS, 5, userKey),
  accountDestructiveRateLimiter: createAccountLimiter(HOUR_MS, 5, userKey),
  adminReauthRateLimiter: createAccountLimiter(15 * 60 * 1000, 10, userKey),
  resetAuthRateLimiters,
  LIMITS: { MAX_LOGIN_ATTEMPTS, MAX_LOGIN_PER_IP, MAX_LOGIN_PER_EMAIL, MAX_ACCOUNT_ATTEMPTS },
};
