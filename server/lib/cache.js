const qString = require('./qString');

class LruTtlCache {
  constructor(max, ttl) { this.max = max; this.ttl = ttl; this.items = new Map(); }
  get(key) {
    const item = this.items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) { this.items.delete(key); return undefined; }
    this.items.delete(key); this.items.set(key, item);
    return item.value;
  }
  has(key) { return this.get(key) !== undefined; }
  set(key, value) {
    this.items.delete(key); this.items.set(key, { value, expiresAt: Date.now() + this.ttl });
    while (this.items.size > this.max) this.items.delete(this.items.keys().next().value);
    return this;
  }
  delete(key) { return this.items.delete(key); }
  *entries() { for (const key of [...this.items.keys()]) { const value = this.get(key); if (value !== undefined) yield [key, value]; } }
}
const tokenCache = new LruTtlCache(1000, 60_000);
const badTokenCache = new LruTtlCache(5000, 60_000);
const responseCache = new LruTtlCache(2000, 60_000);
const ownerVersions = new Map();
const lastUsedWrites = new Map();
const ROUTE_PARAMS = { '/projects': ['stack', 'tag', 'featured'], '/skills': ['category'] };

function getOwnerVersion(id) { return ownerVersions.get(String(id)) || 0; }
function bumpOwnerVersion(id) {
  if (!id) return;
  const key = String(id);
  ownerVersions.set(key, getOwnerVersion(key) + 1);
  for (const [cacheKey, entry] of responseCache.entries()) if (entry.ownerId === key) responseCache.delete(cacheKey);
}
function evictTokensWhere(predicate) { for (const [hash, entry] of tokenCache.entries()) if (predicate(entry)) tokenCache.delete(hash); }
function evictTokenByHash(hash) { tokenCache.delete(hash); }
function evictApp(appId) { evictTokensWhere((entry) => String(entry.appDoc._id) === String(appId)); }
function evictOwner(ownerId) { evictTokensWhere((entry) => String(entry.appDoc.owner) === String(ownerId)); }
function shouldWriteLastUsed(tokenId) {
  const key = String(tokenId), now = Date.now(), previous = lastUsedWrites.get(key) || 0;
  if (now - previous < 60_000) return false;
  lastUsedWrites.set(key, now); return true;
}
function buildCacheKey(req) {
  const allowed = ROUTE_PARAMS[req.path] || [];
  const query = allowed.map((key) => [key, qString(req, key)]).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
  return `${req.ownerId}:${getOwnerVersion(req.ownerId)}:${req.cmsApp._id}:${req.path}:${query}`;
}

module.exports = { tokenCache, badTokenCache, responseCache, getOwnerVersion, bumpOwnerVersion, evictTokensWhere, evictTokenByHash, evictApp, evictOwner, shouldWriteLastUsed, buildCacheKey };
