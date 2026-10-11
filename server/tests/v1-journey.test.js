const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const ApiToken = require('../models/ApiToken');
const cache = require('../lib/cache');
const { resetV1Limiters } = require('../middleware/v1Limiters');
const { createUser, loginAs, seedContent } = require('./helpers/factory');

const models = {
  Profile: require('../models/Profile'), Project: require('../models/Project'), Resume: require('../models/Resume'),
  Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'),
  Education: require('../models/Education'), Certification: require('../models/Certification'),
};
const SITE = 'https://site-one.test';
const OTHER_SITE = 'https://site-two.test';

// Each journey drives the dashboard API the way the UI does, then proves the result with a real /v1
// call. Internals-only tests let an App edit silently kill every key (FX-10); these would not.
async function owner() {
  const user = await createUser(User);
  await seedContent(models, user);
  return { user, auth: loginAs(user) };
}
async function createStaticApp(auth, overrides = {}) {
  const created = await request(appServer).post('/api/apps').set('Authorization', auth).send({
    name: 'Portfolio', type: 'static', allowedOrigins: [SITE],
    include: { profile: { enabled: true, fields: ['name'] }, projects: { enabled: true, mode: 'all', fields: [] } },
    ...overrides,
  }).expect(201);
  return created.body;
}
async function issueKey(auth, appId) {
  const issued = await request(appServer).post(`/api/apps/${appId}/tokens`).set('Authorization', auth).send({ label: 'site' }).expect(201);
  return issued.body.token;
}
const v1 = (path, token, origin) => {
  const call = request(appServer).get(`/v1${path}`).set('Authorization', `Bearer ${token}`);
  return origin ? call.set('Origin', origin) : call;
};

describe('dashboard → /v1 journeys', () => {
  beforeEach(() => resetV1Limiters());

  it('keeps a key working across App edits and serves the edit at once (FX-10)', async () => {
    const { auth } = await owner();
    const created = await createStaticApp(auth);
    const key = await issueKey(auth, created._id);
    await v1('/app', key, SITE).expect(200).expect((res) => expect(res.body.data.name).toBe('Portfolio'));
    const [hash] = (await ApiToken.find({ app: created._id, owner: created.owner }).select('hash').lean()).map((token) => token.hash);

    await request(appServer).put(`/api/apps/${created._id}`).set('Authorization', auth)
      .send({ name: 'Portfolio v2', allowedOrigins: [OTHER_SITE] }).expect(200);
    expect(cache.isActiveToken(hash)).toBe(true);
    const renamed = await v1('/app', key, OTHER_SITE).expect(200);
    expect(renamed.body.data.name).toBe('Portfolio v2');
    expect(renamed.headers['access-control-allow-origin']).toBe(OTHER_SITE);
    await v1('/app', key, SITE).expect(403).expect((res) => expect(res.body.error).toBe('origin_not_allowed'));

    // A section toggle is an App edit too: the key survives and the grant changes.
    await request(appServer).put(`/api/apps/${created._id}`).set('Authorization', auth)
      .send({ include: { projects: { enabled: false } } }).expect(200);
    await v1('/projects', key, OTHER_SITE).expect(403).expect((res) => expect(res.body).toMatchObject({ error: 'section_disabled', section: 'projects' }));
    await v1('/profile', key, OTHER_SITE).expect(200);
  });

  it('rotates a key: the new key works, the old one stops at once', async () => {
    const { auth } = await owner();
    const created = await createStaticApp(auth);
    const oldKey = await issueKey(auth, created._id);
    await v1('/profile', oldKey, SITE).expect(200);
    const newKey = await issueKey(auth, created._id);
    await v1('/profile', newKey, SITE).expect(200);
    const tokens = await request(appServer).get(`/api/apps/${created._id}/tokens`).set('Authorization', auth).expect(200);
    const oldDoc = tokens.body.find((token) => token.value === oldKey);
    await request(appServer).delete(`/api/apps/${created._id}/tokens/${oldDoc._id}`).set('Authorization', auth).expect(200);
    await v1('/profile', oldKey, SITE).expect(401).expect((res) => expect(res.body.error).toBe('token_invalid'));
    await v1('/profile', newKey, SITE).expect(200);
  });

  it('flips an App from browsers to build: the pk is rejected, a new sk answers 200', async () => {
    const { auth } = await owner();
    const created = await createStaticApp(auth);
    const pk = await issueKey(auth, created._id);
    await v1('/profile', pk, SITE).expect(200);
    await request(appServer).put(`/api/apps/${created._id}`).set('Authorization', auth)
      .send({ type: 'protected', allowedOrigins: [] }).expect(200);
    await v1('/profile', pk, SITE).expect(401).expect((res) => expect(res.body.error).toBe('token_invalid'));
    const sk = await issueKey(auth, created._id);
    expect(sk).toMatch(/^sk_live_/);
    const served = await v1('/profile', sk).expect(200);
    expect(served.body.data).toHaveProperty('name');
    await v1('/app', sk).expect(200).expect((res) => expect(res.body.data.type).toBe('protected'));
  });

  it('suspends and unsuspends an owner: account_unavailable, then 200 again', async () => {
    const { user, auth } = await owner();
    const admin = await createUser(User, { role: 'superadmin', adminReauthAt: new Date() });
    const created = await createStaticApp(auth);
    const key = await issueKey(auth, created._id);
    await v1('/profile', key, SITE).expect(200);
    await request(appServer).post(`/api/admin/users/${user._id}/suspend`).set('Authorization', loginAs(admin)).send({}).expect(200);
    await v1('/profile', key, SITE).expect(401).expect((res) => expect(res.body.error).toBe('account_unavailable'));
    await request(appServer).post(`/api/admin/users/${user._id}/unsuspend`).set('Authorization', loginAs(admin)).send({}).expect(200);
    await v1('/profile', key, SITE).expect(200);
  });

  it('deletes an App: its key answers token_invalid', async () => {
    const { auth } = await owner();
    const created = await createStaticApp(auth);
    const key = await issueKey(auth, created._id);
    await v1('/app', key, SITE).expect(200);
    await request(appServer).delete(`/api/apps/${created._id}`).set('Authorization', auth).expect(200);
    await v1('/app', key, SITE).expect(401).expect((res) => expect(res.body.error).toBe('token_invalid'));
  });

  it('shows a content edit on the next /v1 call', async () => {
    const { auth } = await owner();
    const created = await createStaticApp(auth);
    const key = await issueKey(auth, created._id);
    const before = await v1('/projects', key, SITE).expect(200);
    const project = before.body.data[0];
    await request(appServer).put(`/api/projects/${project._id}`).set('Authorization', auth)
      .send({ shortDescription: 'Edited once, read everywhere' }).expect(200);
    const after = await v1('/projects', key, SITE).expect(200);
    expect(after.body.data[0].shortDescription).toBe('Edited once, read everywhere');
    expect(after.headers.etag).not.toBe(before.headers.etag);
  });
});
