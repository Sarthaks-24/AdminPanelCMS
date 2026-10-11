const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Profile = require('../models/Profile');
const Project = require('../models/Project');
const { generateToken } = require('../lib/tokens');
const cache = require('../lib/cache');
const { responseCache } = cache;
const { resetV1Limiters, globalMissBucket, preDbBucket, ownerMissBuckets, LIMITS } = require('../middleware/v1Limiters');
const { loadActiveTokens } = require('../lib/activeTokens');
const { createUser, createApp, createToken, seedContent } = require('./helpers/factory');

const models = {
  Profile, Project, Resume: require('../models/Resume'),
  Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'),
  Education: require('../models/Education'), Certification: require('../models/Certification'),
};

async function setup(include = { profile: { enabled: true, fields: [] }, projects: { enabled: true, mode: 'all', fields: [] } }) {
  const user = await createUser(User);
  await seedContent(models, user);
  const cmsApp = await createApp(App, user, { include });
  const { rawToken, tokenDoc } = await createToken(ApiToken, cmsApp, 'pk');
  return { user, cmsApp, rawToken, tokenDoc, headers: { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' } };
}

describe('/v1 capacity controls', () => {
  beforeEach(() => resetV1Limiters());

  it('rejects 1,000 random well-formed tokens with zero ApiToken queries', async () => {
    const querySpy = vi.spyOn(ApiToken, 'findOne');
    try {
      for (let index = 0; index < 1000; index += 1) {
        if (index % 250 === 0) await resetV1Limiters();
        const { token } = generateToken(index % 2 ? 'pk' : 'sk');
        const denied = await request(appServer).get('/v1/app').set('Authorization', `Bearer ${token}`).expect(401);
        expect(denied.body.error).toBe('token_invalid');
      }
      expect(querySpy).not.toHaveBeenCalled();
      expect(cache.activeTokensLoaded()).toBe(true);
    } finally { querySpy.mockRestore(); }
  }, 60_000);

  it('serves warm cache hits and 304s for free when the global miss bucket is drained', async () => {
    const { headers } = await setup();
    const first = await request(appServer).get('/v1/profile').set(headers).expect(200);
    globalMissBucket.hold();
    try {
      await request(appServer).get('/v1/profile').set(headers).expect(200).expect('etag', first.headers.etag);
      await request(appServer).get('/v1/profile').set({ ...headers, 'If-None-Match': first.headers.etag }).expect(304);
      expect(globalMissBucket.tokens).toBe(0);
      const busy = await request(appServer).get('/v1/projects').set(headers).expect(503);
      expect(busy.body).toMatchObject({ error: 'busy', requestId: expect.any(String) });
      expect(busy.headers['retry-after']).toBe('1');
    } finally { globalMissBucket.refill(); }
    await request(appServer).get('/v1/projects').set(headers).expect(200);
  });

  it('weights /fs misses by the enabled section count', async () => {
    const { headers } = await setup({
      profile: { enabled: true, fields: [] }, projects: { enabled: true, mode: 'all', fields: [] },
      skills: { enabled: true, mode: 'all', fields: [] }, fs: { enabled: true },
    });
    globalMissBucket.refill();
    const before = globalMissBucket.tokens;
    await request(appServer).get('/v1/fs').set(headers).expect(200);
    expect(before - globalMissBucket.tokens).toBeGreaterThanOrEqual(3 - 0.5);
    await request(appServer).get('/v1/fs').set(headers).expect(200); // hit: not charged
    expect(before - globalMissBucket.tokens).toBeLessThan(4);
  });

  it('limits a publishable key per token and IP so one scraper cannot exhaust a site', async () => {
    const { headers } = await setup();
    appServer.set('trust proxy', 1);
    try {
      const fromA = { ...headers, 'X-Forwarded-For': '203.0.113.10' };
      for (let index = 0; index < LIMITS.PK_PER_MIN; index += 1) {
        await request(appServer).get('/v1/app').set(fromA).expect(200);
      }
      const limited = await request(appServer).get('/v1/app').set(fromA).expect(429);
      expect(limited.body).toMatchObject({ error: 'rate_limited', requestId: expect.any(String) });
      await request(appServer).get('/v1/app').set({ ...headers, 'X-Forwarded-For': '203.0.113.20' }).expect(200);
    } finally { appServer.set('trust proxy', 0); }
  }, 30_000);

  it('bounds the response cache by bytes and collapses filter case variants into one entry', async () => {
    const { headers } = await setup();
    const previousMax = responseCache.maxBytes;
    responseCache.maxBytes = 20_000;
    try {
      const size = responseCache.size;
      for (let index = 0; index < 100; index += 1) {
        await request(appServer).get(`/v1/projects?stack=variant-${index}`).set(headers).expect(200);
        expect(responseCache.bytes).toBeLessThanOrEqual(responseCache.maxBytes);
      }
      expect(responseCache.size - size).toBeLessThanOrEqual(1); // one projects section; empty views are not stored
    } finally { responseCache.maxBytes = previousMax; }

    const lower = await request(appServer).get('/v1/projects?stack=node.js').set(headers).expect(200);
    const upper = await request(appServer).get('/v1/projects?tag=%20NODE.JS%20').set(headers).expect(200);
    expect(upper.headers.etag).toBe(lower.headers.etag);
    expect(lower.body.data).toHaveLength(1);
  }, 30_000);

  it('charges one miss for 50 distinct ?stack= values and 50 random slugs (filters run after the cache)', async () => {
    const { user, headers } = await setup();
    const findSpy = vi.spyOn(Project, 'find');
    try {
      const globalBefore = globalMissBucket.tokens;
      for (let index = 0; index < 50; index += 1) {
        const response = await request(appServer).get(`/v1/projects?stack=random-${index}`).set(headers).expect(200);
        expect(response.body).toEqual({ data: [] });
      }
      for (let index = 0; index < 50; index += 1) {
        const missing = await request(appServer).get(`/v1/projects/nope-${index}`).set(headers).expect(404);
        expect(missing.body.error).toBe('not_found');
      }
      expect(findSpy).toHaveBeenCalledTimes(1);
      expect(ownerMissBuckets.get(String(user._id))?.count ?? 0).toBeLessThanOrEqual(1);
      expect(globalBefore - globalMissBucket.tokens).toBeLessThan(2);
      // Real values are still answered from the same section, with their own body and ETag.
      const match = await request(appServer).get('/v1/projects?stack=REDIS').set(headers).expect(200);
      expect(match.body.data).toHaveLength(1);
      const all = await request(appServer).get('/v1/projects').set(headers).expect(200);
      expect(match.headers.etag).toBe(all.headers.etag); // every project matches, so it is the same body
      const featuredOff = await request(appServer).get('/v1/projects?featured=false').set(headers).expect(200);
      expect(featuredOff.body.data).toEqual([]);
      const bySlug = await request(appServer).get(`/v1/projects/alpha-engine-${user._id}`).set(headers).expect(200);
      expect(bySlug.body.data.slug).toBe(`alpha-engine-${user._id}`);
      expect(findSpy).toHaveBeenCalledTimes(1);
    } finally { findSpy.mockRestore(); }
  }, 30_000);

  it('applies stack, slug and category filters even when the App does not serve those fields', async () => {
    const { user, headers } = await setup({
      projects: { enabled: true, mode: 'all', fields: ['title'] }, skills: { enabled: true, mode: 'all', fields: ['name'] },
    });
    const filtered = await request(appServer).get('/v1/projects?stack=redis').set(headers).expect(200);
    expect(filtered.body.data).toEqual([{ _id: expect.any(String), title: 'Alpha Trading Engine' }]);
    const none = await request(appServer).get('/v1/projects?stack=go').set(headers).expect(200);
    expect(none.body.data).toEqual([]);
    const bySlug = await request(appServer).get(`/v1/projects/alpha-engine-${user._id}`).set(headers).expect(200);
    expect(bySlug.body.data).toEqual({ _id: expect.any(String), title: 'Alpha Trading Engine' });
    const skills = await request(appServer).get('/v1/skills?category=FRONTEND').set(headers).expect(200);
    expect(skills.body.data).toEqual([{ _id: expect.any(String), name: 'react' }]);
    const grouped = await request(appServer).get('/v1/skills/categories').set(headers).expect(200);
    expect(Object.keys(grouped.body.data)).toEqual(['Frontend']);
  });

  it('answers 400 bad_request naming the parameter for a malformed or repeated filter', async () => {
    const { headers } = await setup({ projects: { enabled: true, mode: 'all', fields: [] }, skills: { enabled: true, mode: 'all', fields: [] } });
    const featured = await request(appServer).get('/v1/projects?featured=yes').set(headers).expect(400);
    expect(featured.body).toEqual({ error: 'bad_request', message: expect.any(String), requestId: expect.any(String), param: 'featured' });
    expect(featured.headers['access-control-allow-origin']).toBe('https://portfolio.test');
    const repeated = await request(appServer).get('/v1/projects?stack=a&stack=b').set(headers).expect(400);
    expect(repeated.body).toMatchObject({ error: 'bad_request', param: 'stack' });
    const category = await request(appServer).get('/v1/skills?category=a&category=b').set(headers).expect(400);
    expect(category.body).toMatchObject({ error: 'bad_request', param: 'category' });
    await request(appServer).get('/v1/projects?featured=true').set(headers).expect(200);
  });

  it('caches a not_configured 404 so repeated calls cost one load', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user, { include: { profile: { enabled: true, fields: [] } } });
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
    const findSpy = vi.spyOn(Profile, 'findOne');
    try {
      for (let index = 0; index < 5; index += 1) await request(appServer).get('/v1/profile').set(headers).expect(404);
      expect(findSpy).toHaveBeenCalledTimes(1);
    } finally { findSpy.mockRestore(); }
    // A content edit bumps the owner version, so the cached 404 never outlives the profile's creation.
    await Profile.create({ owner: user._id, name: 'Now Real', configured: true });
    cache.bumpOwnerVersion(user._id);
    await request(appServer).get('/v1/profile').set(headers).expect(200);
  });

  it('serves an expired entry when the miss budget refuses a reload (stale-if-busy)', async () => {
    const { user, cmsApp, headers } = await setup();
    const first = await request(appServer).get('/v1/profile').set(headers).expect(200);
    const key = cache.buildCacheKey({ ownerId: user._id, cmsApp, path: '/profile' });
    responseCache.set(key, responseCache.peek(key), -1); // expire it in place
    expect(responseCache.get(key)).toBeUndefined();
    globalMissBucket.hold();
    try {
      const stale = await request(appServer).get('/v1/profile').set(headers).expect(200);
      expect(stale.headers.etag).toBe(first.headers.etag);
    } finally { globalMissBucket.refill(); }
    await request(appServer).get('/v1/profile').set(headers).expect(200); // budget back: reloaded
    expect(responseCache.get(key)).toBeDefined();
  });

  it('serves bodies above the per-item cap without caching them', async () => {
    const { headers } = await setup();
    const previous = responseCache.maxItemBytes;
    responseCache.maxItemBytes = 10;
    try {
      const size = responseCache.size;
      await request(appServer).get('/v1/profile').set(headers).expect(200);
      expect(responseCache.size).toBe(size);
    } finally { responseCache.maxItemBytes = previous; }
  });

  it('coalesces 50 concurrent misses for one key into a single load', async () => {
    const { headers } = await setup();
    await request(appServer).get('/v1/app').set(headers).expect(200);
    const findSpy = vi.spyOn(Profile, 'findOne');
    try {
      const responses = await Promise.all(Array.from({ length: 50 }, () => request(appServer).get('/v1/profile').set(headers)));
      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(new Set(responses.map((response) => response.headers.etag)).size).toBe(1);
      expect(findSpy).toHaveBeenCalledTimes(1);
    } finally { findSpy.mockRestore(); }
  });

  it('coalesces concurrent first-time token lookups and guards them with the pre-DB bucket', async () => {
    const { headers } = await setup();
    const querySpy = vi.spyOn(ApiToken, 'findOne');
    try {
      const responses = await Promise.all(Array.from({ length: 20 }, () => request(appServer).get('/v1/app').set(headers)));
      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(querySpy).toHaveBeenCalledTimes(1);
    } finally { querySpy.mockRestore(); }

    const cold = await setup();
    preDbBucket.hold();
    try {
      const busy = await request(appServer).get('/v1/app').set(cold.headers).expect(503);
      expect(busy.body).toMatchObject({ error: 'busy', requestId: expect.any(String) });
      expect(busy.headers['retry-after']).toBe('1');
    } finally { preDbBucket.refill(); }
    await request(appServer).get('/v1/app').set(cold.headers).expect(200);
  });

  it('keeps the active-token set current through creation, app eviction and owner eviction', async () => {
    const { user, cmsApp, tokenDoc } = await setup();
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(true);
    expect(cache.activeTokens.get(tokenDoc.hash)).toEqual({ owner: String(user._id), app: String(cmsApp._id) });
    cache.evictOwner(user._id);
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(true); // owner eviction keeps hashes so account_unavailable stays reachable
    cache.evictApp(cmsApp._id);
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(true); // an App edit must never drop its live keys (FX-10)
  });

  it('re-syncs the active-token set with keys written or revoked without the model hooks', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const generated = generateToken('pk');
    // A restore, a script or a second process writes straight to the collection: no save hook runs.
    await ApiToken.collection.insertOne({
      owner: user._id, app: cmsApp._id, quotaSlot: 0, type: 'pk', prefix: generated.prefix, hash: generated.hash,
      value: generated.token, label: '', expiresAt: null, lastUsedAt: null, revokedAt: null, createdAt: new Date(),
    });
    const headers = { Authorization: `Bearer ${generated.token}`, Origin: 'https://portfolio.test' };
    await request(appServer).get('/v1/app').set(headers).expect(401);
    const synced = await loadActiveTokens();
    expect(synced.count).toBeGreaterThan(0);
    await request(appServer).get('/v1/app').set(headers).expect(200);

    await ApiToken.collection.updateOne({ hash: generated.hash }, { $set: { revokedAt: new Date() } });
    const resynced = await loadActiveTokens();
    expect(resynced.removed).toBeGreaterThanOrEqual(1);
    expect(cache.isActiveToken(generated.hash)).toBe(false);
    await request(appServer).get('/v1/app').set(headers).expect(401);
  });
});
