const { generateToken, hashToken, prefixOf } = require('../lib/tokens');
const cache = require('../lib/cache');
const {
  LruTtlCache, BoundedMap, tokenCache, badTokenCache, responseCache,
  bumpOwnerVersion, getOwnerVersion, shouldWriteLastUsed, normalizedFilters, buildCacheKey,
} = cache;

describe('API token primitives and cache versioning', () => {
  it('generates high-entropy base62 keys with the documented prefix and SHA-256 digest', () => {
    const first = generateToken('pk');
    const second = generateToken('sk');
    expect(first.token).toMatch(/^pk_live_[0-9A-Za-z]{43}$/);
    expect(second.token).toMatch(/^sk_live_[0-9A-Za-z]{43}$/);
    expect(first.prefix).toBe(first.token.slice(0, 12));
    expect(prefixOf(first.token)).toBe(first.prefix);
    expect(first.hash).toBe(hashToken(first.token));
    expect(first.hash).not.toBe(first.token);
    expect(first.token).not.toBe(second.token);
    expect(() => generateToken('admin')).toThrow(TypeError);
  });

  it('bumps the owner version and evicts that owner response entries', () => {
    const ownerId = `cache-test-${Date.now()}`;
    responseCache.set('owner-response', { ownerId, serialized: '{"data":[]}' });
    const before = getOwnerVersion(ownerId);
    bumpOwnerVersion(ownerId);
    expect(getOwnerVersion(ownerId)).toBe(before + 1);
    expect(responseCache.get('owner-response')).toBeUndefined();
  });

  it('throttles last-used writes to one per minute', () => {
    const tokenId = `last-used-${Date.now()}`;
    expect(shouldWriteLastUsed(tokenId)).toBe(true);
    expect(shouldWriteLastUsed(tokenId)).toBe(false);
  });

  it('keeps token caches available for immediate eviction', () => {
    const key = `cache-${Date.now()}`;
    tokenCache.set(key, { appDoc: { _id: 'app', owner: 'owner' } });
    badTokenCache.set(key, true);
    expect(tokenCache.get(key)).toBeDefined();
    expect(badTokenCache.has(key)).toBe(true);
    tokenCache.delete(key);
    expect(tokenCache.get(key)).toBeUndefined();
  });

  it('bounds a cache by serialized bytes, skips oversized bodies and evicts least recently used entries', () => {
    const sizeOf = (entry) => Buffer.byteLength(entry.serialized);
    const bounded = new LruTtlCache(100, 60_000, { maxBytes: 100, maxItemBytes: 40, sizeOf });
    bounded.set('a', { serialized: 'x'.repeat(40) });
    bounded.set('b', { serialized: 'y'.repeat(40) });
    expect(bounded.bytes).toBe(80);
    bounded.set('huge', { serialized: 'z'.repeat(41) });
    expect(bounded.get('huge')).toBeUndefined();
    expect(bounded.bytes).toBe(80);
    bounded.get('a'); // a becomes most recently used, so b is the next eviction
    bounded.set('c', { serialized: 'w'.repeat(40) });
    expect(bounded.bytes).toBeLessThanOrEqual(100);
    expect(bounded.get('b')).toBeUndefined();
    expect(bounded.get('a')).toBeDefined();
    expect(bounded.get('c')).toBeDefined();
    bounded.delete('a');
    expect(bounded.bytes).toBe(40);
    expect(responseCache.maxBytes).toBe(64 * 1024 * 1024);
    expect(responseCache.maxItemBytes).toBe(256 * 1024);
    expect(tokenCache.max).toBe(20_000);
  });

  it('caps the owner version and last-used maps and purges responses for an evicted owner', () => {
    const evicted = [];
    const map = new BoundedMap(2, (key) => evicted.push(key));
    map.set('a', 1); map.set('b', 2); map.set('a', 3); map.set('c', 4);
    expect([...map.keys()]).toEqual(['a', 'c']);
    expect(evicted).toEqual(['b']);
    expect(cache.ownerVersions.max).toBe(50_000);
    expect(cache.lastUsedWrites.max).toBe(20_000);
    const ownerId = `evicted-owner-${Date.now()}`;
    responseCache.set('evicted-owner-response', { ownerId, serialized: '{}' });
    cache.ownerVersions.onEvict(ownerId);
    expect(responseCache.get('evicted-owner-response')).toBeUndefined();
  });

  it('keeps the active-token set in step with the eviction helpers', () => {
    const { hash } = generateToken('pk');
    cache.addActiveToken(hash, 'owner-1', 'app-1');
    expect(cache.isActiveToken(hash)).toBe(true);
    cache.evictTokenByHash(hash);
    expect(cache.isActiveToken(hash)).toBe(false);
    cache.addActiveToken(hash, 'owner-1', 'app-1');
    cache.evictApp('app-2');
    expect(cache.isActiveToken(hash)).toBe(true);
    cache.evictApp('app-1');
    expect(cache.isActiveToken(hash)).toBe(false);
    cache.addActiveToken(hash, 'owner-1', 'app-1');
    tokenCache.set(hash, { appDoc: { _id: 'app-1', owner: 'owner-1' } });
    cache.evictOwner('owner-1');
    expect(tokenCache.get(hash)).toBeUndefined();
    expect(cache.isActiveToken(hash)).toBe(true);
    cache.removeActiveToken(hash);
  });

  it('normalises filter keys so case and alias variants share one cache entry', () => {
    const req = (path, query) => ({ path, query, ownerId: 'o', cmsApp: { _id: 'a' } });
    expect(normalizedFilters(req('/projects', { stack: ' Node.JS ' }))).toEqual({ stack: 'node.js' });
    expect(normalizedFilters(req('/projects', { tag: 'Redis', featured: 'true' }))).toEqual({ stack: 'redis', featured: true });
    expect(normalizedFilters(req('/projects', { stack: '', featured: 'yes' }))).toEqual({});
    expect(normalizedFilters(req('/skills', { category: 'FRONTEND' }))).toEqual({ category: 'frontend' });
    expect(normalizedFilters(req('/socials', { category: 'x' }))).toEqual({});
    expect(buildCacheKey(req('/projects', { stack: 'Node.js' }))).toBe(buildCacheKey(req('/projects', { tag: 'node.js' })));
    expect(buildCacheKey(req('/projects', { stack: 'a' }))).not.toBe(buildCacheKey(req('/projects', { stack: 'b' })));
  });
});
