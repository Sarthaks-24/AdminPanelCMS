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
const { resetV1Limiters, globalMissBucket, preDbBucket, LIMITS } = require('../middleware/v1Limiters');
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
      for (let index = 0; index < 100; index += 1) {
        await resetV1Limiters();
        await request(appServer).get(`/v1/projects?stack=variant-${index}`).set(headers).expect(200);
        expect(responseCache.bytes).toBeLessThanOrEqual(responseCache.maxBytes);
      }
      expect(responseCache.size).toBeLessThan(100);
    } finally { responseCache.maxBytes = previousMax; }

    const findSpy = vi.spyOn(Project, 'find');
    try {
      const lower = await request(appServer).get('/v1/projects?stack=node.js').set(headers).expect(200);
      const upper = await request(appServer).get('/v1/projects?tag=%20NODE.JS%20').set(headers).expect(200);
      expect(upper.headers.etag).toBe(lower.headers.etag);
      expect(lower.body.data).toHaveLength(1);
      expect(findSpy).toHaveBeenCalledTimes(1);
    } finally { findSpy.mockRestore(); }
  }, 30_000);

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
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(false);
  });
});
