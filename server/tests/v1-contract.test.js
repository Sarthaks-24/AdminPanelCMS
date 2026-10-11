const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Profile = require('../models/Profile');
const Education = require('../models/Education');
const cache = require('../lib/cache');
const { resetV1Limiters } = require('../middleware/v1Limiters');
const { createUser, createApp, createToken, seedContent } = require('./helpers/factory');

const models = {
  Profile, Project: require('../models/Project'), Resume: require('../models/Resume'),
  Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'),
  Education, Certification: require('../models/Certification'),
};
const ALL_SECTIONS = {
  profile: { enabled: true, fields: [] }, resume: { enabled: true, fields: [] },
  socials: { enabled: true, mode: 'all', fields: [] }, skills: { enabled: true, mode: 'all', fields: [] },
  projects: { enabled: true, mode: 'all', fields: [] }, experience: { enabled: true, mode: 'all', fields: [] },
  education: { enabled: true, mode: 'all', fields: [] }, certifications: { enabled: true, mode: 'all', fields: [] },
  fs: { enabled: true },
};
const v1ErrorShape = { error: expect.any(String), message: expect.any(String), requestId: expect.any(String) };

async function setup({ seed = true, app = {}, token = 'pk' } = {}) {
  const user = await createUser(User);
  const content = seed ? await seedContent(models, user) : null;
  const cmsApp = await createApp(App, user, app);
  const { rawToken, tokenDoc } = await createToken(ApiToken, cmsApp, token);
  const headers = { Authorization: `Bearer ${rawToken}`, ...(token === 'pk' ? { Origin: 'https://portfolio.test' } : {}) };
  return { user, content, cmsApp, rawToken, tokenDoc, headers };
}

describe('/v1 contract freeze', () => {
  beforeEach(() => resetV1Limiters());

  it('wraps every successful route in a {data} envelope with lists as arrays', async () => {
    const { headers, content } = await setup({ app: { include: ALL_SECTIONS } });
    const objects = ['/app', '/profile', '/resume', '/skills/categories', `/projects/${content.project.slug}`, '/fs'];
    const lists = ['/socials', '/skills', '/projects', '/experience', '/education', '/certifications'];
    for (const path of [...objects, ...lists]) {
      await resetV1Limiters(); // every route is a cold miss here; the owner miss budget is 10 units/s
      const response = await request(appServer).get(`/v1${path}`).set(headers).expect(200);
      expect(Object.keys(response.body)).toEqual(['data']);
      expect(response.headers.etag).toBeTruthy();
      expect(response.headers['cache-control']).toBe('private, max-age=60');
      expect(response.headers.vary).toBe('Authorization, Origin');
      expect(response.headers['x-request-id']).toBeTruthy();
      if (lists.includes(path)) expect(Array.isArray(response.body.data)).toBe(true);
      else expect(response.body.data && typeof response.body.data).toBe('object');
    }
    expect((await request(appServer).get('/v1/skills/categories').set(headers)).body.data).toMatchObject({ Frontend: expect.any(Array) });
    expect((await request(appServer).get('/v1/app').set(headers)).body.data).toEqual({ name: 'Test App', type: 'static', enabledSections: Object.keys(ALL_SECTIONS) });
  });

  it('uses one error shape {error, message, requestId} for token, section, missing-route and limiter failures', async () => {
    const { headers } = await setup({ app: { include: { profile: { enabled: true, fields: [] } } } });
    const missing = await request(appServer).get('/v1/app').expect(401);
    expect(missing.body).toEqual({ ...v1ErrorShape, error: 'token_missing' });
    expect(missing.body.requestId).toBe(missing.headers['x-request-id']);
    expect(missing.body).not.toHaveProperty('success');

    const disabled = await request(appServer).get('/v1/projects').set(headers).expect(403);
    expect(disabled.body).toEqual({ ...v1ErrorShape, error: 'section_disabled', section: 'projects' });
    const fsDisabled = await request(appServer).get('/v1/fs').set(headers).expect(403);
    expect(fsDisabled.body).toMatchObject({ error: 'section_disabled', section: 'fs' });

    const unknown = await request(appServer).get('/v1/nope?x=1').set(headers).expect(404);
    expect(unknown.body).toEqual({ ...v1ErrorShape, error: 'not_found' });
    expect(unknown.headers['access-control-allow-origin']).toBe('https://portfolio.test');
    expect(unknown.headers['x-request-id']).toBe(unknown.body.requestId);
    await request(appServer).get('/v1/app/extra').set(headers).expect(404).expect((res) => expect(res.body.error).toBe('not_found'));

    const malformed = await request(appServer).get('/v1/app').set('Authorization', 'Bearer nope').expect(401);
    expect(malformed.body).toEqual({ ...v1ErrorShape, error: 'token_invalid' });
  });

  it('echoes a sane X-Request-Id and generates one otherwise, on every response including preflight', async () => {
    const { headers } = await setup({ seed: false });
    const echoed = await request(appServer).get('/v1/app').set(headers).set('X-Request-Id', 'trace-1.a_b').expect(200);
    expect(echoed.headers['x-request-id']).toBe('trace-1.a_b');
    const replaced = await request(appServer).get('/v1/app').set(headers).set('X-Request-Id', 'bad id!').expect(200);
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const tooLong = await request(appServer).get('/v1/app').set(headers).set('X-Request-Id', 'a'.repeat(65)).expect(200);
    expect(tooLong.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const generated = await request(appServer).get('/v1/app').set(headers).expect(200);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.headers['x-request-id']).not.toBe(replaced.headers['x-request-id']);
    const preflight = await request(appServer).options('/v1/app').set('Origin', 'https://portfolio.test').set('X-Request-Id', 'pre-1').expect(204);
    expect(preflight.headers['x-request-id']).toBe('pre-1');
    const denied = await request(appServer).get('/v1/app').set('X-Request-Id', 'denied-1').expect(401);
    expect(denied.body.requestId).toBe('denied-1');
    const dashboard = await request(appServer).get('/api/nope').set('X-Request-Id', 'dash-1').expect(404);
    expect(dashboard.headers['x-request-id']).toBe('dash-1');
    expect(dashboard.body.requestId).toBe('dash-1');
  });

  it('answers 404 not_configured for an unconfigured profile and a missing resume, never 200 null', async () => {
    const { user, headers } = await setup({ seed: false, app: { include: { profile: { enabled: true, fields: [] }, resume: { enabled: true, fields: [] } } } });
    await Profile.create({ owner: user._id, name: 'Placeholder', configured: false });
    const profile = await request(appServer).get('/v1/profile').set(headers).expect(404);
    expect(profile.body).toEqual({ ...v1ErrorShape, error: 'not_configured' });
    const resume = await request(appServer).get('/v1/resume').set(headers).expect(404);
    expect(resume.body).toEqual({ ...v1ErrorShape, error: 'not_configured' });

    await Profile.updateOne({ owner: user._id }, { $set: { configured: true, name: 'Real Name' } }, { strict: false });
    cache.bumpOwnerVersion(user._id);
    const configured = await request(appServer).get('/v1/profile').set(headers).expect(200);
    expect(configured.body.data.name).toBe('Real Name');
    expect(configured.body.data).not.toHaveProperty('configured');
  });

  it('omits an unconfigured profile from /v1/fs but keeps the other sections', async () => {
    const { user, headers } = await setup({ app: { include: ALL_SECTIONS } });
    await Profile.updateOne({ owner: user._id }, { $set: { configured: false } }, { strict: false });
    cache.bumpOwnerVersion(user._id);
    const tree = await request(appServer).get('/v1/fs').set(headers).expect(200);
    const paths = tree.body.data.children.map((node) => node.path);
    expect(paths).not.toContain('/about');
    expect(paths).toEqual(expect.arrayContaining(['/projects', '/skills', '/socials.json', '/resume.pdf']));
  });

  it('rejects a pk on a protected app and an sk on a static app with 403 token_type_mismatch', async () => {
    const protectedCase = await setup({ seed: false, app: { type: 'protected', allowedOrigins: [] }, token: 'pk' });
    const pkOnProtected = await request(appServer).get('/v1/app').set('Authorization', `Bearer ${protectedCase.rawToken}`).expect(403);
    expect(pkOnProtected.body).toEqual({ ...v1ErrorShape, error: 'token_type_mismatch' });
    expect(pkOnProtected.headers['access-control-allow-origin']).toBeUndefined();
    const staticCase = await setup({ seed: false, app: { type: 'static' }, token: 'sk' });
    const skOnStatic = await request(appServer).get('/v1/app').set('Authorization', `Bearer ${staticCase.rawToken}`).expect(403);
    expect(skOnStatic.body.error).toBe('token_type_mismatch');
  });

  it('answers 401 account_unavailable for a suspended owner, from cache, and recovers on unsuspend', async () => {
    const { user, headers } = await setup({ seed: false });
    await request(appServer).get('/v1/app').set(headers).expect(200);
    user.status = 'suspended';
    await user.save();
    const querySpy = vi.spyOn(ApiToken, 'findOne');
    try {
      const suspended = await request(appServer).get('/v1/app').set(headers).expect(401);
      expect(suspended.body).toEqual({ ...v1ErrorShape, error: 'account_unavailable' });
      expect(querySpy).toHaveBeenCalledTimes(1);
      await request(appServer).get('/v1/app').set(headers).expect(401);
      expect(querySpy).toHaveBeenCalledTimes(1);
    } finally { querySpy.mockRestore(); }
    user.status = 'active';
    await user.save();
    cache.evictOwner(user._id);
    await request(appServer).get('/v1/app').set(headers).expect(200);
  });

  it('serves a deterministic, de-duplicated /v1/fs tree that includes socials.json', async () => {
    const { user, headers } = await setup({ app: { include: ALL_SECTIONS } });
    await Education.create({ owner: user._id, institution: 'Tech University', degree: 'M.S.', period: '2023 - 2025', order: 1, visibility: 'published' });
    await Education.create({ owner: user._id, institution: 'Tech University', degree: 'Ph.D.', period: '2025 - 2028', order: 2, visibility: 'published' });
    const tree = await request(appServer).get('/v1/fs').set(headers).expect(200);
    const byPath = Object.fromEntries(tree.body.data.children.map((node) => [node.path, node]));
    expect(byPath['/education'].children.map((node) => node.path)).toEqual([
      '/education/tech-university.txt', '/education/tech-university-2.txt', '/education/tech-university-3.txt',
    ]);
    expect(byPath['/socials.json']).toMatchObject({ type: 'file', mimeType: 'application/json' });
    expect(byPath['/socials.json'].content[0]).toMatchObject({ platform: 'GitHub', url: 'https://github.com/testuser' });
    expect(byPath['/socials.json'].content[0]).not.toHaveProperty('owner');
    const paths = new Set(JSON.stringify(tree.body.data).match(/"path":"[^"]+"/g));
    expect(paths.size).toBe(JSON.stringify(tree.body.data).match(/"path":"[^"]+"/g).length);
  });

  it('records lastUsedAt through an owner-scoped write', async () => {
    const { user, tokenDoc, headers } = await setup({ seed: false });
    cache.lastUsedWrites.delete(String(tokenDoc._id));
    await request(appServer).get('/v1/app').set(headers).expect(200);
    let stored = null;
    for (let attempt = 0; attempt < 40 && !stored?.lastUsedAt; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      stored = await ApiToken.findOne({ _id: tokenDoc._id, owner: user._id }).lean();
    }
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });

  it('strips operator and dotted keys from the query string and still rejects ?token=', async () => {
    const { headers } = await setup({ app: { include: { projects: { enabled: true, mode: 'all', fields: [] } } } });
    const response = await request(appServer).get('/v1/projects?$where=1&a.b=2&__proto__=3&stack=node.js').set(headers).expect(200);
    expect(response.body.data).toHaveLength(1);
    await request(appServer).get('/v1/projects?token=x').set(headers).expect(400).expect((res) => expect(res.body.error).toBe('token_in_query'));
  });
});
