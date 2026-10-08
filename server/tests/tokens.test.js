const { generateToken, hashToken, prefixOf } = require('../lib/tokens');
const { tokenCache, badTokenCache, responseCache, bumpOwnerVersion, getOwnerVersion, shouldWriteLastUsed } = require('../lib/cache');

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
    responseCache.set('owner-response', { ownerId, body: [] });
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
});
