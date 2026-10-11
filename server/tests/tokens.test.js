const { generateToken, hashToken, prefixOf } = require('../lib/tokens');
const cache = require('../lib/cache');
const {
  LruTtlCache, BoundedMap, tokenCache, badTokenCache, responseCache,
  bumpOwnerVersion, getOwnerVersion, shouldWriteLastUsed, normalizedFilters, filterError, buildCacheKey,
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
    expect(responseCache.maxItemBytes).toBe(1024 * 1024);
    expect(responseCache.ttl).toBe(15 * 60_000);
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
    // An App edit only drops the resolved entries: the App's keys stay live (FX-10).
    cache.addActiveToken(hash, 'owner-1', 'app-1');
    tokenCache.set(hash, { appDoc: { _id: 'app-1', owner: 'owner-1' } });
    cache.evictApp('app-2');
    expect(tokenCache.get(hash)).toBeDefined();
    cache.evictApp('app-1');
    expect(tokenCache.get(hash)).toBeUndefined();
    expect(cache.isActiveToken(hash)).toBe(true);
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
    expect(normalizedFilters(req('/projects', { featured: 'false' }))).toEqual({ featured: false });
    expect(normalizedFilters(req('/skills', { category: 'FRONTEND' }))).toEqual({ category: 'frontend' });
    expect(normalizedFilters(req('/socials', { category: 'x' }))).toEqual({});
    // Filters never reach the cache key: a section is cached once and filtered in memory (FX-17).
    expect(buildCacheKey(req('/projects', { stack: 'a' }))).toBe(buildCacheKey(req('/projects', { stack: 'b' })));
    expect(buildCacheKey(req('/projects/x', {}), '/projects')).toBe(buildCacheKey(req('/projects', {})));
  });

  it('rejects repeated and malformed filter values with the parameter name', () => {
    const req = (path, query) => ({ path, query });
    expect(filterError(req('/projects', { featured: 'true', stack: 'go' }))).toBeNull();
    expect(filterError(req('/projects', { featured: 'false' }))).toBeNull();
    expect(filterError(req('/projects', { featured: 'yes' }))).toMatchObject({ param: 'featured' });
    expect(filterError(req('/projects', { stack: ['a', 'b'] }))).toMatchObject({ param: 'stack' });
    expect(filterError(req('/projects', { tag: { x: '1' } }))).toMatchObject({ param: 'tag' });
    expect(filterError(req('/skills', { category: ['a', 'b'] }))).toMatchObject({ param: 'category' });
    expect(filterError(req('/socials', { featured: 'yes' }))).toBeNull(); // unknown parameters stay ignored
  });

  it('drops indexed entries without a scan and keeps expired entries for stale-if-busy', () => {
    const indexed = new LruTtlCache(10, 60_000, { indexBy: (entry) => [entry.owner] });
    indexed.set('a1', { owner: 'a' }); indexed.set('a2', { owner: 'a' }); indexed.set('b1', { owner: 'b' });
    expect(indexed.deleteIndexed('a')).toBe(2);
    expect(indexed.size).toBe(1);
    expect(indexed.index.has('a')).toBe(false);
    indexed.delete('b1');
    expect(indexed.index.size).toBe(0);

    const stale = new LruTtlCache(10, 60_000, { keepStale: true });
    stale.set('k', { v: 1 }, -1); // already expired
    expect(stale.get('k')).toBeUndefined();
    expect(stale.peek('k')).toEqual({ v: 1 });
    const strict = new LruTtlCache(10, 60_000);
    strict.set('k', { v: 1 }, -1);
    expect(strict.get('k')).toBeUndefined();
    expect(strict.peek('k')).toBeUndefined();
  });
});
