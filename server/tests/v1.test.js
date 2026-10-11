const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const { generateToken, hashToken } = require('../lib/tokens');
const cache = require('../lib/cache');
const { tokenCache, badTokenCache, responseCache, getOwnerVersion } = cache;
const { preAuthLimiter, resetV1Limiters, globalMissBucket } = require('../middleware/v1Limiters');
const { createUser, createApp, createToken, loginAs, seedContent } = require('./helpers/factory');

const models = {
  Profile: require('../models/Profile'), Project: require('../models/Project'), Resume: require('../models/Resume'),
  Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'),
  Education: require('../models/Education'), Certification: require('../models/Certification'),
};
const v1ErrorShape = { error: expect.any(String), message: expect.any(String), requestId: expect.any(String) };

describe('versioned public API and dashboard token lifecycle', () => {
  beforeEach(() => resetV1Limiters());

  it('supports a localhost consumer cutover from app creation through profile and resume reads', async () => {
    const consumerOrigin = 'http://localhost:5174';
    const user = await createUser(User);
    const content = await seedContent(models, user);
    const createdApp = await request(appServer).post('/api/apps').set('Authorization', loginAs(user)).send({
      name: 'Local portfolio consumer',
      type: 'static',
      allowedOrigins: [consumerOrigin],
      include: {
        profile: { enabled: true, fields: ['name', 'shortBio'] },
        resume: { enabled: true, fields: ['resumeUrl', 'fileName'] },
      },
    }).expect(201);
    const { token } = await request(appServer).post(`/api/apps/${createdApp.body._id}/tokens`)
      .set('Authorization', loginAs(user)).send({ label: 'Local site' }).expect(201).then(({ body }) => body);

    const headers = { Authorization: `Bearer ${token}`, Origin: consumerOrigin };
    const profile = await request(appServer).get('/v1/profile').set(headers).expect(200);
    expect(Object.keys(profile.body)).toEqual(['data']);
    expect(profile.body.data).toMatchObject({ name: content.profile.name, shortBio: content.profile.shortBio });
    expect(profile.body.data).not.toHaveProperty('owner');
    expect(profile.body.data).not.toHaveProperty('configured');
    expect(profile.headers['access-control-allow-origin']).toBe(consumerOrigin);

    const resume = await request(appServer).get('/v1/resume').set(headers).expect(200);
    expect(resume.body.data).toMatchObject({ resumeUrl: content.resume.resumeUrl, fileName: content.resume.fileName });
    expect(resume.headers.location).toBeUndefined();

    const wrongOrigin = await request(appServer).get('/v1/profile')
      .set({ Authorization: `Bearer ${token}`, Origin: 'http://localhost:5173' }).expect(403);
    expect(wrongOrigin.body).toMatchObject({ ...v1ErrorShape, error: 'origin_not_allowed' });
    expect(wrongOrigin.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves app metadata with ETag caching, private Cache-Control and origin CORS headers', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };

    const response = await request(appServer).get('/v1/app').set(headers).expect(200);
    expect(response.body).toEqual({ data: { name: cmsApp.name, type: 'static', enabledSections: ['profile', 'projects'] } });
    expect(response.headers['access-control-allow-origin']).toBe('https://portfolio.test');
    expect(response.headers['cache-control']).toBe('private, max-age=60');
    expect(response.headers.etag).toBeTruthy();
    expect(response.headers['x-request-id']).toBeTruthy();
    await request(appServer).get('/v1/app').set({ ...headers, 'If-None-Match': response.headers.etag })
      .expect(304).expect('cache-control', 'private, max-age=60').expect('etag', response.headers.etag)
      .expect('vary', 'Authorization, Origin');
  });

  it('rejects a publishable key from an unapproved origin and handles preflight without auth', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const denied = await request(appServer).get('/v1/app').set('Authorization', `Bearer ${rawToken}`).set('Origin', 'https://attacker.test').expect(403);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await request(appServer).options('/v1/projects').set('Origin', 'https://portfolio.test')
      .expect(204).expect('access-control-allow-methods', 'GET, OPTIONS');
  });

  it('allows wildcard-origin publishable calls only with a valid bearer token', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user, { allowedOrigins: ['*'] });
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    await request(appServer).get('/v1/app').set({ Authorization: `Bearer ${rawToken}`, Origin: 'https://any-site.test' })
      .expect(200).expect('access-control-allow-origin', '*');
    await request(appServer).get('/v1/app').set('Authorization', `Bearer ${rawToken}`).expect(200);
    await request(appServer).get('/v1/app').set('Origin', 'https://any-site.test').expect(401);
  });

  it('groups skills through the public projection and returns the virtual filesystem', async () => {
    const user = await createUser(User);
    await seedContent(models, user);
    const cmsApp = await createApp(App, user, { include: {
      profile: { enabled: true, fields: ['name', 'shortBio'] },
      skills: { enabled: true, mode: 'all', fields: ['name', 'category'] },
      fs: { enabled: true },
    } });
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
    const categories = await request(appServer).get('/v1/skills/categories').set(headers).expect(200);
    expect(categories.body.data.Frontend[0]).toMatchObject({ name: 'react', category: 'Frontend' });
    const filesystem = await request(appServer).get('/v1/fs').set(headers).expect(200);
    expect(filesystem.body.data).toMatchObject({ type: 'directory', path: '/' });
    expect(filesystem.body.data.children.map((node) => node.path)).toEqual(expect.arrayContaining(['/about', '/skills']));
  });

  it('isolates identical /v1 routes between two owners', async () => {
    const firstOwner = await createUser(User);
    const secondOwner = await createUser(User);
    await seedContent(models, firstOwner);
    await seedContent(models, secondOwner);
    const include = { profile: { enabled: true, fields: ['name'] } };
    const firstApp = await createApp(App, firstOwner, { type: 'protected', allowedOrigins: [], include });
    const secondApp = await createApp(App, secondOwner, { type: 'protected', allowedOrigins: [], include });
    const firstToken = (await createToken(ApiToken, firstApp, 'sk')).rawToken;
    const secondToken = (await createToken(ApiToken, secondApp, 'sk')).rawToken;
    const firstProfile = await request(appServer).get('/v1/profile').set('Authorization', `Bearer ${firstToken}`).expect(200);
    const secondProfile = await request(appServer).get('/v1/profile').set('Authorization', `Bearer ${secondToken}`).expect(200);
    expect(firstProfile.body.data.name).toBe(`User ${firstOwner._id}`);
    expect(secondProfile.body.data.name).toBe(`User ${secondOwner._id}`);
    expect(firstProfile.body.data.name).not.toBe(secondProfile.body.data.name);
  });

  it('requires a bearer token and rejects query string tokens', async () => {
    await request(appServer).get('/v1/app').set('Origin', 'https://portfolio.test').expect(401).expect((res) => {
      expect(res.body).toMatchObject({ ...v1ErrorShape, error: 'token_missing' });
      expect(res.body).not.toHaveProperty('success');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
    await request(appServer).get('/v1/app?token=pk_live_nope').expect(400).expect((res) => expect(res.body.error).toBe('token_in_query'));
  });

  it('rejects unknown token hashes from the active set with no database lookup, and caches stale hashes negatively', async () => {
    const { token } = generateToken('pk');
    const querySpy = vi.spyOn(ApiToken, 'findOne');
    try {
      for (let index = 0; index < 2; index += 1) {
        const denied = await request(appServer).get('/v1/app').set({ Authorization: `Bearer ${token}`, Origin: 'https://portfolio.test' }).expect(401);
        expect(denied.body).toMatchObject({ ...v1ErrorShape, error: 'token_invalid' });
      }
      expect(querySpy).not.toHaveBeenCalled();
      // A hash that is in the set but no longer in the database costs exactly one lookup, then the negative cache answers.
      const stale = generateToken('pk');
      cache.addActiveToken(stale.hash, 'owner', 'app');
      for (let index = 0; index < 3; index += 1) {
        await request(appServer).get('/v1/app').set('Authorization', `Bearer ${stale.token}`).expect(401);
      }
      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(cache.isActiveToken(stale.hash)).toBe(false);
      expect(badTokenCache.has(hashToken(stale.token))).toBe(true);
    } finally { querySpy.mockRestore(); }
  });

  it('invalidates cached tokens and responses when an owner is deactivated', async () => {
    const user = await createUser(User);
    tokenCache.set(`deactivate-${user._id}`, { appDoc: { _id: 'app-id', owner: user._id } });
    responseCache.set(`deactivate-${user._id}`, { ownerId: String(user._id), serialized: '{}' });
    const version = getOwnerVersion(user._id);
    user.status = 'deleted';
    await user.save();
    expect(tokenCache.get(`deactivate-${user._id}`)).toBeUndefined();
    expect(responseCache.get(`deactivate-${user._id}`)).toBeUndefined();
    expect(getOwnerVersion(user._id)).toBe(version + 1);
  });

  it('rejects IP floods before attempting token lookup', async () => {
    await preAuthLimiter.resetKey('127.0.0.1');
    const querySpy = vi.spyOn(ApiToken, 'findOne');
    try {
      for (let index = 0; index < 300; index += 1) {
        await request(appServer).get('/v1/app').set('Authorization', 'Bearer malformed').expect(401);
      }
      const limited = await request(appServer).get('/v1/app').set('Origin', 'https://portfolio.test').set('Authorization', 'Bearer malformed').expect(429);
      expect(limited.body).toMatchObject({ ...v1ErrorShape, error: 'rate_limited' });
      expect(limited.headers['access-control-allow-origin']).toBeUndefined();
      expect(querySpy).not.toHaveBeenCalled();
    } finally {
      querySpy.mockRestore();
      await preAuthLimiter.resetKey('127.0.0.1');
    }
  });

  it('applies the publishable token rate limit (120/min per token and IP) after authentication', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
    for (let index = 0; index < 120; index += 1) {
      await request(appServer).get('/v1/app').set(headers).expect(200);
    }
    const limited = await request(appServer).get('/v1/app').set(headers).expect(429);
    expect(limited.body).toMatchObject({ ...v1ErrorShape, error: 'rate_limited' });
    expect(limited.headers['retry-after']).toBeTruthy();
    expect(limited.headers['ratelimit']).toBeTruthy();
    expect(limited.headers['access-control-allow-origin']).toBe('https://portfolio.test');
  });

  it('signals a drained global miss budget with 503 busy and CORS headers while cache hits keep flowing', async () => {
    const user = await createUser(User);
    await seedContent(models, user);
    const cmsApp = await createApp(App, user);
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
    await request(appServer).get('/v1/profile').set(headers).expect(200);
    globalMissBucket.hold();
    try {
      await request(appServer).get('/v1/profile').set(headers).expect(200);
      const busy = await request(appServer).get('/v1/projects').set(headers).expect(503);
      expect(busy.body).toMatchObject({ ...v1ErrorShape, error: 'busy' });
      expect(busy.headers['retry-after']).toBe('1');
      expect(busy.headers['access-control-allow-origin']).toBe('https://portfolio.test');
    } finally { globalMissBucket.refill(); }
    await request(appServer).get('/v1/projects').set(headers).expect(200);
  });

  it('lists and revokes tokens, with revocation taking effect immediately', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const { rawToken, tokenDoc } = await createToken(ApiToken, cmsApp, 'pk');
    const auth = loginAs(user);
    const list = await request(appServer).get(`/api/apps/${cmsApp._id}/tokens`).set('Authorization', auth).expect(200);
    expect(list.body[0].value).toBe(rawToken);
    await request(appServer).get('/v1/app').set({ Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' }).expect(200);
    await request(appServer).delete(`/api/apps/${cmsApp._id}/tokens/${tokenDoc._id}`).set('Authorization', auth).expect(200);
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(false);
    const revoked = await request(appServer).get('/v1/app').set({ Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' }).expect(401);
    expect(revoked.body.error).toBe('token_invalid');
  });

  it('returns only an owner’s app and hides stored secret-key values from token listings', async () => {
    const user = await createUser(User);
    const otherUser = await createUser(User);
    const cmsApp = await createApp(App, user, { type: 'protected', allowedOrigins: [] });
    const { rawToken } = await createToken(ApiToken, cmsApp, 'sk', { value: 'legacy-secret-value' });
    const own = await request(appServer).get(`/api/apps/${cmsApp._id}`).set('Authorization', loginAs(user)).expect(200);
    expect(own.body._id).toBe(String(cmsApp._id));
    await request(appServer).get(`/api/apps/${cmsApp._id}`).set('Authorization', loginAs(otherUser)).expect(404);
    const listed = await request(appServer).get(`/api/apps/${cmsApp._id}/tokens`).set('Authorization', loginAs(user)).expect(200);
    expect(listed.body[0].value).toBeUndefined();
    expect(listed.body[0].prefix).toBe(rawToken.slice(0, 12));
  });

  it('requires a verified dashboard account before issuing tokens', async () => {
    const user = await createUser(User, { emailVerifiedAt: null });
    const cmsApp = await createApp(App, user);
    const response = await request(appServer).post(`/api/apps/${cmsApp._id}/tokens`)
      .set('Authorization', loginAs(user)).send({}).expect(403);
    expect(response.body.error).toBe('email_unverified');
  });

  it('revokes app tokens when the app is deleted', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user);
    const { rawToken, tokenDoc } = await createToken(ApiToken, cmsApp, 'pk');
    await request(appServer).delete(`/api/apps/${cmsApp._id}`).set('Authorization', loginAs(user)).expect(200);
    expect(cache.isActiveToken(tokenDoc.hash)).toBe(false);
    await request(appServer).get('/v1/app').set({ Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' }).expect(401);
    const stored = await ApiToken.findOne({ owner: user._id, app: cmsApp._id });
    expect(stored.revokedAt).toBeInstanceOf(Date);
  });

  it('enforces a two-token quota and stores secret keys only as hashes', async () => {
    const user = await createUser(User);
    const cmsApp = await createApp(App, user, { type: 'protected', allowedOrigins: [] });
    const auth = loginAs(user);
    const [firstResponse, secondResponse] = await Promise.all([
      request(appServer).post(`/api/apps/${cmsApp._id}/tokens`).set('Authorization', auth).send({ label: 'Build server' }),
      request(appServer).post(`/api/apps/${cmsApp._id}/tokens`).set('Authorization', auth).send({ label: 'Preview builder' }),
    ]);
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    const first = firstResponse;
    const second = secondResponse;
    expect(first.body).toMatchObject({ type: 'sk', shownOnce: true });
    expect(second.body.type).toBe('sk');
    expect(first.body.token).not.toBe(second.body.token);
    await request(appServer).get('/v1/app').set('Authorization', `Bearer ${first.body.token}`).expect(200)
      .expect('cache-control', 'private, max-age=60').expect('vary', 'Authorization, Origin')
      .expect((response) => expect(response.headers['access-control-allow-origin']).toBeUndefined());
    const third = await request(appServer).post(`/api/apps/${cmsApp._id}/tokens`).set('Authorization', auth).send({}).expect(403);
    expect(third.body.error).toBe('quota_exceeded');
    const stored = await ApiToken.find({ app: cmsApp._id, owner: user._id }).select('+value').lean();
    expect(stored).toHaveLength(2);
    expect(stored.every((token) => token.value === null && token.hash !== first.body.token)).toBe(true);
  });
});
