const { rateLimit, ipKeyGenerator, MemoryStore } = require('express-rate-limit');
const { v1Error } = require('../lib/v1Errors');

// /v1 rate limits (contract §1). Numbers here are the ones the docs and the UI quote.
const PRE_AUTH_PER_MIN = 300;      // per IP (IPv6 /48), before any token work
const PK_PER_MIN = 120;            // per token + IP
const PK_CEILING_PER_MIN = 3000;   // per token, every IP combined
const SK_PER_MIN = 600;            // per token
const OWNER_MISS_UNITS_PER_SEC = 10;
const GLOBAL_MISS_UNITS_PER_SEC = 40;
const PRE_DB_LOOKUPS_PER_SEC = 20;

const limited = (message) => (req, res) => v1Error(res, 429, 'rate_limited', message);
const stores = { preAuth: new MemoryStore(), token: new MemoryStore(), ceiling: new MemoryStore() };

const preAuthLimiter = rateLimit({
  windowMs: 60_000, limit: PRE_AUTH_PER_MIN, store: stores.preAuth,
  keyGenerator: (req) => ipKeyGenerator(req.ip, 48),
  standardHeaders: 'draft-7', legacyHeaders: false, handler: limited('Too many requests'),
});
// pk keys are public by nature, so a scraped key is limited per IP and cannot take a whole site down.
const tokenLimiter = rateLimit({
  windowMs: 60_000, store: stores.token,
  limit: (req) => (req.tokenType === 'sk' ? SK_PER_MIN : PK_PER_MIN),
  keyGenerator: (req) => (req.tokenType === 'sk' ? String(req.tokenId) : `${req.tokenId}:${ipKeyGenerator(req.ip, 48)}`),
  standardHeaders: 'draft-7', legacyHeaders: false, handler: limited('Token request limit exceeded'),
});
const tokenCeilingLimiter = rateLimit({
  windowMs: 60_000, limit: PK_CEILING_PER_MIN, store: stores.ceiling,
  skip: (req) => req.tokenType !== 'pk',
  keyGenerator: (req) => `ceiling:${req.tokenId}`,
  standardHeaders: 'draft-7', legacyHeaders: false, handler: limited('Token request ceiling exceeded'),
});

class TokenBucket {
  constructor(capacity, refillPerSec) { this.capacity = capacity; this.refillPerSec = refillPerSec; this.refillPerMs = refillPerSec / 1000; this.tokens = capacity; this.updatedAt = Date.now(); }
  sync() { const now = Date.now(); this.tokens = Math.min(this.capacity, this.tokens + (now - this.updatedAt) * this.refillPerMs); this.updatedAt = now; }
  take(units = 1) { this.sync(); if (this.tokens < units) return false; this.tokens -= units; return true; }
  drain() { this.sync(); this.tokens = 0; }
  refill() { this.refillPerMs = this.refillPerSec / 1000; this.tokens = this.capacity; this.updatedAt = Date.now(); }
  // Test hook: empty the bucket and stop it refilling until refill() is called.
  hold() { this.drain(); this.refillPerMs = 0; }
}
// Bounds the token lookups a flood of unknown-but-well-formed tokens can push to Mongo.
const preDbBucket = new TokenBucket(PRE_DB_LOOKUPS_PER_SEC, PRE_DB_LOOKUPS_PER_SEC);
// Bounds aggregate cache-miss work process-wide. Charged in query units, never on a hit or a 304.
const globalMissBucket = new TokenBucket(GLOBAL_MISS_UNITS_PER_SEC, GLOBAL_MISS_UNITS_PER_SEC);

// Per-owner miss budget (fixed one-second window) so one tenant cannot drain the shared bucket.
const ownerMissBuckets = new Map();
setInterval(() => {
  const second = Math.floor(Date.now() / 1000);
  for (const [key, bucket] of ownerMissBuckets) if (bucket.second !== second) ownerMissBuckets.delete(key);
}, 60_000).unref();
function chargeOwnerMiss(ownerId, units) {
  const key = String(ownerId), second = Math.floor(Date.now() / 1000);
  let bucket = ownerMissBuckets.get(key);
  if (!bucket || bucket.second !== second) { bucket = { second, count: 0 }; ownerMissBuckets.set(key, bucket); }
  if (bucket.count + units > OWNER_MISS_UNITS_PER_SEC) return false;
  bucket.count += units;
  return true;
}

// Called by the /v1 router once per cache miss that actually loads data (single-flight leaders only).
function chargeMiss(ownerId, units = 1) {
  const cost = Math.max(1, Math.ceil(units));
  if (!chargeOwnerMiss(ownerId, cost)) return { ok: false, status: 429, code: 'rate_limited', message: 'Account request budget exceeded; cached responses are not charged' };
  if (!globalMissBucket.take(cost)) return { ok: false, status: 503, code: 'busy', message: 'API is busy; retry shortly' };
  return { ok: true };
}
function takePreDbSlot() { return preDbBucket.take(1); }

// Test hooks: reset every /v1 limiter and bucket to a fresh state.
async function resetV1Limiters() {
  await Promise.all(Object.values(stores).map((store) => store.resetAll()));
  ownerMissBuckets.clear();
  preDbBucket.refill();
  globalMissBucket.refill();
}

module.exports = {
  preAuthLimiter, tokenLimiter, tokenCeilingLimiter,
  chargeMiss, takePreDbSlot, resetV1Limiters,
  globalMissBucket, preDbBucket, ownerMissBuckets,
  LIMITS: { PRE_AUTH_PER_MIN, PK_PER_MIN, PK_CEILING_PER_MIN, SK_PER_MIN, OWNER_MISS_UNITS_PER_SEC, GLOBAL_MISS_UNITS_PER_SEC, PRE_DB_LOOKUPS_PER_SEC },
};
