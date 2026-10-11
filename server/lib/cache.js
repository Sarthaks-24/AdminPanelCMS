const qString = require('./qString');

// LRU + TTL cache, optionally bounded by bytes. `sizeOf(value)` reports an entry's weight;
// an entry heavier than `maxItemBytes` is never stored (the caller still serves it uncached).
// `indexBy(value)` returns the index keys an entry is filed under, so deleteIndexed() drops one
// App's or one owner's entries without scanning the whole cache. With `keepStale`, an expired
// entry stays until LRU pressure drops it, so peek() can still serve it when a reload is refused.
class LruTtlCache {
  constructor(max, ttl, { maxBytes = Infinity, maxItemBytes = Infinity, sizeOf = () => 0, indexBy = null, keepStale = false } = {}) {
    this.max = max; this.ttl = ttl; this.maxBytes = maxBytes; this.maxItemBytes = maxItemBytes; this.sizeOf = sizeOf;
    this.indexBy = indexBy; this.keepStale = keepStale;
    this.items = new Map(); this.index = new Map(); this.bytes = 0;
  }
  get size() { return this.items.size; }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) { if (!this.keepStale) this.delete(key); return undefined; }
    this.items.delete(key); this.items.set(key, item);
    return item.value;
  }
  // The entry even when it has expired (stale-if-busy); its LRU position is left alone.
  peek(key) { return this.items.get(key)?.value; }
  has(key) { return this.get(key) !== undefined; }
  set(key, value, ttl = this.ttl) {
    const bytes = this.sizeOf(value);
    if (bytes > this.maxItemBytes) { this.delete(key); return this; }
    this.delete(key);
    const indexKeys = this.indexBy ? this.indexBy(value).filter(Boolean).map(String) : [];
    this.items.set(key, { value, bytes, expiresAt: Date.now() + ttl, indexKeys });
    for (const indexKey of indexKeys) {
      if (!this.index.has(indexKey)) this.index.set(indexKey, new Set());
      this.index.get(indexKey).add(key);
    }
    this.bytes += bytes;
    while (this.items.size > this.max || this.bytes > this.maxBytes) this.delete(this.items.keys().next().value);
    return this;
  }
  delete(key) {
    const item = this.items.get(key);
    if (!item) return false;
    this.bytes -= item.bytes;
    for (const indexKey of item.indexKeys) {
      const keys = this.index.get(indexKey);
      if (keys) { keys.delete(key); if (!keys.size) this.index.delete(indexKey); }
    }
    return this.items.delete(key);
  }
  deleteIndexed(indexKey) {
    const keys = this.index.get(String(indexKey));
    if (!keys) return 0;
    let count = 0;
    for (const key of [...keys]) if (this.delete(key)) count += 1;
    return count;
  }
  clear() { this.items.clear(); this.index.clear(); this.bytes = 0; }
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
// Matches the /v1 response ceiling: the per-owner published-content budget (config/limits.js)
// keeps every legitimate body below it, so every legitimate body can be cached.
const RESPONSE_CACHE_MAX_ITEM_BYTES = 1024 * 1024;
// Responses are invalidated explicitly (owner-version bump on every content or App edit), so the TTL
// is only a backstop for a change that skipped the hooks. Expired entries are kept for stale-if-busy.
const RESPONSE_TTL_MS = 15 * 60_000;
// 404s (unknown slug, not_configured) are cached for a minute so a random path costs one load.
const NEGATIVE_TTL_MS = 60_000;
const tokenCache = new LruTtlCache(20_000, 60_000, {
  indexBy: (entry) => [entry?.appDoc?._id && `app:${entry.appDoc._id}`, entry?.appDoc?.owner && `owner:${entry.appDoc.owner}`],
});
const badTokenCache = new LruTtlCache(5000, 60_000);
const responseCache = new LruTtlCache(20_000, RESPONSE_TTL_MS, {
  maxBytes: RESPONSE_CACHE_MAX_BYTES,
  maxItemBytes: RESPONSE_CACHE_MAX_ITEM_BYTES,
  keepStale: true,
  // Entries hold the serialized body (plus small filter facets); the constant covers the key, ETag and bookkeeping.
  sizeOf: (entry) => (typeof entry?.serialized === 'string' ? Buffer.byteLength(entry.serialized) : 0) + (entry?.extraBytes || 0) + 256,
  indexBy: (entry) => [entry?.ownerId],
});
// Bumping an owner's version already purges their response entries, so an evicted version
// can safely restart at 0; purge again on eviction so the pre-load key race cannot resurrect a body.
const ownerVersions = new BoundedMap(50_000, (ownerKey) => purgeOwnerResponses(ownerKey));
const lastUsedWrites = new BoundedMap(20_000);

// Active-token hash set: sha256(token) -> { owner, app } for every unrevoked token.
// Loaded at boot (server.js) or lazily on the first /v1 request, re-synced from the database every
// minute (lib/activeTokens.js), and kept current in between by ApiToken's post-save hook plus the
// evict* helpers below. A hash outside the set is rejected with zero database work, which is what
// defeats a forged-token flood.
const activeTokens = new Map();
let activeTokensReady = false;
function addActiveToken(hash, owner, app) { if (hash) activeTokens.set(String(hash), { owner: String(owner), app: String(app) }); }
function removeActiveToken(hash) { return activeTokens.delete(String(hash)); }
function isActiveToken(hash) { return activeTokens.has(String(hash)); }
function markActiveTokensReady(ready = true) { activeTokensReady = Boolean(ready); }
function activeTokensLoaded() { return activeTokensReady; }

function purgeOwnerResponses(ownerKey) { responseCache.deleteIndexed(ownerKey); }
function getOwnerVersion(id) { return ownerVersions.get(String(id)) || 0; }
function bumpOwnerVersion(id) {
  if (!id) return;
  const key = String(id);
  ownerVersions.set(key, getOwnerVersion(key) + 1);
  purgeOwnerResponses(key);
}
// Bumped by every token eviction. A resolve that started before an eviction may have read the old
// token, App or owner, so requireToken does not cache its result when the generation moved (BE-01).
let tokenGeneration = 0;
function tokenGen() { return tokenGeneration; }
function evictTokensWhere(predicate) { tokenGeneration += 1; for (const [hash, entry] of tokenCache.entries()) if (predicate(entry)) tokenCache.delete(hash); }
function evictTokenByHash(hash) { tokenGeneration += 1; tokenCache.delete(hash); removeActiveToken(hash); }
// An App edit drops the resolved token entries so the next request re-reads the App (name, origins,
// sections, type). The hashes stay in the active set: the keys are still live. Revoking a key or
// deleting the App removes its hashes through evictTokenByHash.
function evictApp(appId) { tokenGeneration += 1; tokenCache.deleteIndexed(`app:${appId}`); }
// Owner-level eviction drops the resolved token entries so the next request re-reads the account's
// status, but deliberately keeps the hashes in the active set: a hash outside the set answers
// `token_invalid`, and a suspended or deleted owner must answer `account_unavailable` (contract §2.4).
// The next lookup (bounded by the pre-DB bucket) caches that status for 60 s and prunes hashes whose
// tokens the account cascade has already deleted.
function evictOwner(ownerId) { tokenGeneration += 1; tokenCache.deleteIndexed(`owner:${ownerId}`); }
function shouldWriteLastUsed(tokenId) {
  const key = String(tokenId), now = Date.now(), previous = lastUsedWrites.get(key) || 0;
  if (now - previous < 60_000) return false;
  lastUsedWrites.set(key, now); return true;
}

// The query parameters each /v1 path accepts. A repeated or malformed value is a 400 (contract §1);
// unknown parameters are ignored so new optional ones stay additive.
const FILTER_PARAMS = { '/projects': ['stack', 'tag', 'featured'], '/skills': ['category'] };
function filterError(req) {
  for (const key of FILTER_PARAMS[req.path] || []) {
    const value = req.query[key];
    if (value === undefined) continue;
    if (typeof value !== 'string') return { param: key, message: `Query parameter "${key}" must be given once, as a plain value` };
    if (key === 'featured' && value !== 'true' && value !== 'false') return { param: key, message: 'Query parameter "featured" must be true or false' };
  }
  return null;
}
// The filters a route honours, normalised the same way applyInclude compares them (lower-case,
// trimmed, empty means "no filter") so case variants of ?stack= share one cached view.
function normalizedFilters(req) {
  const text = (key) => { const value = qString(req, key); return typeof value === 'string' ? value.trim().toLowerCase() : ''; };
  if (req.path === '/projects') {
    const filters = {};
    const stack = text('stack') || text('tag');
    if (stack) filters.stack = stack;
    const featured = qString(req, 'featured');
    if (featured === 'true' || featured === 'false') filters.featured = featured === 'true';
    return filters;
  }
  if (req.path === '/skills') { const category = text('category'); return category ? { category } : {}; }
  return {};
}
function filterQuery(filters) {
  return Object.entries(filters).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
}
// One entry per owner + version + App + section. Filters never reach the key: a section is loaded
// (and charged) once and stack/featured/category/slug are applied in memory, so random filter
// values cannot turn into charged misses or fill the cache (SEC3). The App's updatedAt is part of the key, so
// a request holding an App read from before an edit can never file its view under the current key (BE-01).
function buildCacheKey(req, name = req.path) {
  const appStamp = req.cmsApp.updatedAt ? new Date(req.cmsApp.updatedAt).getTime() : 0;
  return `${req.ownerId}:${getOwnerVersion(req.ownerId)}:${req.cmsApp._id}:${appStamp}:${name}`;
}

module.exports = {
  LruTtlCache, BoundedMap,
  tokenCache, badTokenCache, responseCache, ownerVersions, lastUsedWrites,
  RESPONSE_CACHE_MAX_BYTES, RESPONSE_CACHE_MAX_ITEM_BYTES, RESPONSE_TTL_MS, NEGATIVE_TTL_MS,
  activeTokens, addActiveToken, removeActiveToken, isActiveToken, markActiveTokensReady, activeTokensLoaded,
  getOwnerVersion, bumpOwnerVersion, tokenGen, evictTokensWhere, evictTokenByHash, evictApp, evictOwner,
  shouldWriteLastUsed, filterError, normalizedFilters, filterQuery, buildCacheKey,
};
