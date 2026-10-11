const qString = require('./qString');

// LRU + TTL cache, optionally bounded by bytes. `sizeOf(value)` reports an entry's weight;
// an entry heavier than `maxItemBytes` is never stored (the caller still serves it uncached).
class LruTtlCache {
  constructor(max, ttl, { maxBytes = Infinity, maxItemBytes = Infinity, sizeOf = () => 0 } = {}) {
    this.max = max; this.ttl = ttl; this.maxBytes = maxBytes; this.maxItemBytes = maxItemBytes; this.sizeOf = sizeOf;
    this.items = new Map(); this.bytes = 0;
  }
  get size() { return this.items.size; }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) { this.delete(key); return undefined; }
    this.items.delete(key); this.items.set(key, item);
    return item.value;
  }
  has(key) { return this.get(key) !== undefined; }
  set(key, value) {
    const bytes = this.sizeOf(value);
    if (bytes > this.maxItemBytes) { this.delete(key); return this; }
    this.delete(key);
    this.items.set(key, { value, bytes, expiresAt: Date.now() + this.ttl });
    this.bytes += bytes;
    while (this.items.size > this.max || this.bytes > this.maxBytes) this.delete(this.items.keys().next().value);
    return this;
  }
  delete(key) {
    const item = this.items.get(key);
    if (!item) return false;
    this.bytes -= item.bytes;
    return this.items.delete(key);
  }
  clear() { this.items.clear(); this.bytes = 0; }
  *entries() { for (const key of [...this.items.keys()]) { const value = this.get(key); if (value !== undefined) yield [key, value]; } }
}

// Insertion-ordered Map with a size cap; the oldest key is dropped (with a callback) when full.
class BoundedMap extends Map {
  constructor(max, onEvict) { super(); this.max = max; this.onEvict = onEvict; }
  set(key, value) {
    if (super.has(key)) super.delete(key);
    super.set(key, value);
    while (this.size > this.max) {
      const oldest = this.keys().next().value;
      const evicted = super.get(oldest);
      super.delete(oldest);
      if (this.onEvict) this.onEvict(oldest, evicted);
    }
    return this;
  }
}

const RESPONSE_CACHE_MAX_BYTES = 64 * 1024 * 1024; // serialized bytes across every tenant
const RESPONSE_CACHE_MAX_ITEM_BYTES = 256 * 1024;  // larger bodies are served but never cached
const tokenCache = new LruTtlCache(20_000, 60_000);
const badTokenCache = new LruTtlCache(5000, 60_000);
const responseCache = new LruTtlCache(20_000, 60_000, {
  maxBytes: RESPONSE_CACHE_MAX_BYTES,
  maxItemBytes: RESPONSE_CACHE_MAX_ITEM_BYTES,
  // Entries hold the serialized body; the constant covers the key, ETag and bookkeeping.
  sizeOf: (entry) => (typeof entry?.serialized === 'string' ? Buffer.byteLength(entry.serialized) : 0) + 256,
});
// Bumping an owner's version already purges their response entries, so an evicted version
// can safely restart at 0; purge again on eviction so the pre-load key race cannot resurrect a body.
const ownerVersions = new BoundedMap(50_000, (ownerKey) => purgeOwnerResponses(ownerKey));
const lastUsedWrites = new BoundedMap(20_000);

// Active-token hash set: sha256(token) -> { owner, app } for every unrevoked token.
// Loaded at boot (server.js) or lazily on the first /v1 request (lib/activeTokens.js) and kept
// current by ApiToken's post-save hook plus the evict* helpers below. A hash outside the set is
// rejected with zero database work, which is what defeats a forged-token flood.
const activeTokens = new Map();
let activeTokensReady = false;
function addActiveToken(hash, owner, app) { if (hash) activeTokens.set(String(hash), { owner: String(owner), app: String(app) }); }
function removeActiveToken(hash) { return activeTokens.delete(String(hash)); }
function isActiveToken(hash) { return activeTokens.has(String(hash)); }
function markActiveTokensReady(ready = true) { activeTokensReady = Boolean(ready); }
function activeTokensLoaded() { return activeTokensReady; }

function purgeOwnerResponses(ownerKey) {
  for (const [cacheKey, entry] of responseCache.entries()) if (entry.ownerId === ownerKey) responseCache.delete(cacheKey);
}
function getOwnerVersion(id) { return ownerVersions.get(String(id)) || 0; }
function bumpOwnerVersion(id) {
  if (!id) return;
  const key = String(id);
  ownerVersions.set(key, getOwnerVersion(key) + 1);
  purgeOwnerResponses(key);
}
function evictTokensWhere(predicate) { for (const [hash, entry] of tokenCache.entries()) if (predicate(entry)) tokenCache.delete(hash); }
function evictTokenByHash(hash) { tokenCache.delete(hash); removeActiveToken(hash); }
function evictApp(appId) {
  const key = String(appId);
  evictTokensWhere((entry) => String(entry.appDoc?._id) === key);
  for (const [hash, entry] of activeTokens) if (entry.app === key) activeTokens.delete(hash);
}
// Owner-level eviction drops the resolved token entries so the next request re-reads the account's
// status, but deliberately keeps the hashes in the active set: a hash outside the set answers
// `token_invalid`, and a suspended or deleted owner must answer `account_unavailable` (contract §2.4).
// The next lookup (bounded by the pre-DB bucket) caches that status for 60 s and prunes hashes whose
// tokens the account cascade has already deleted.
function evictOwner(ownerId) {
  const key = String(ownerId);
  evictTokensWhere((entry) => String(entry.appDoc?.owner) === key);
}
function shouldWriteLastUsed(tokenId) {
  const key = String(tokenId), now = Date.now(), previous = lastUsedWrites.get(key) || 0;
  if (now - previous < 60_000) return false;
  lastUsedWrites.set(key, now); return true;
}

// The filters a route honours, normalised the same way applyInclude compares them (lower-case,
// trimmed, empty means "no filter") so case variants of ?stack= share one cache entry.
function normalizedFilters(req) {
  const text = (key) => { const value = qString(req, key); return typeof value === 'string' ? value.trim().toLowerCase() : ''; };
  if (req.path === '/projects') {
    const filters = {};
    const stack = text('stack') || text('tag');
    if (stack) filters.stack = stack;
    if (qString(req, 'featured') === 'true') filters.featured = true;
    return filters;
  }
  if (req.path === '/skills') { const category = text('category'); return category ? { category } : {}; }
  return {};
}
function buildCacheKey(req) {
  const query = Object.entries(normalizedFilters(req)).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `${req.ownerId}:${getOwnerVersion(req.ownerId)}:${req.cmsApp._id}:${req.path}:${query}`;
}

module.exports = {
  LruTtlCache, BoundedMap,
  tokenCache, badTokenCache, responseCache, ownerVersions, lastUsedWrites,
  RESPONSE_CACHE_MAX_BYTES, RESPONSE_CACHE_MAX_ITEM_BYTES,
  activeTokens, addActiveToken, removeActiveToken, isActiveToken, markActiveTokensReady, activeTokensLoaded,
  getOwnerVersion, bumpOwnerVersion, evictTokensWhere, evictTokenByHash, evictApp, evictOwner,
  shouldWriteLastUsed, normalizedFilters, buildCacheKey,
};
