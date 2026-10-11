const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Project = require('../models/Project');
const LIMITS = require('../config/limits');
const { responseCache, RESPONSE_CACHE_MAX_ITEM_BYTES } = require('../lib/cache');
const { ownerPublishedBytes } = require('../lib/contentBytes');
const { resetV1Limiters } = require('../middleware/v1Limiters');
const { createUser, loginAs, createApp, createToken } = require('./helpers/factory');

const CASE_STUDY = 'x'.repeat(20_000);
const project = (owner, index, overrides = {}) => ({
  owner, title: `Project ${index}`, slug: `project-${index}`, shortDescription: 'Summary',
  caseStudyBody: CASE_STUDY, order: index, visibility: 'published', ...overrides,
});

describe('published-content byte budget', () => {
  beforeEach(() => resetV1Limiters());

  it('refuses a publish that would grow an account past the budget with 403 quota_exceeded content_bytes', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    // Fill the budget to within one case study of the limit.
    await Project.create(project(user._id, 0));
    const count = Math.floor(LIMITS.publishedContentBytes / (await ownerPublishedBytes(user._id)));
    await Project.insertMany(Array.from({ length: count - 1 }, (_, index) => project(user._id, index + 1)));
    const used = await ownerPublishedBytes(user._id);
    expect(used).toBeLessThan(LIMITS.publishedContentBytes);

    const over = await request(appServer).post('/api/projects').set('Authorization', auth)
      .send({ title: 'One too many', shortDescription: 'Summary', caseStudyBody: CASE_STUDY, visibility: 'published' }).expect(403);
    expect(over.body).toMatchObject({ success: false, error: 'quota_exceeded', resource: 'content_bytes', limit: LIMITS.publishedContentBytes });
    expect(over.body.used).toBeGreaterThan(LIMITS.publishedContentBytes);

    // Drafts cost nothing, shrinking is always allowed, and publishing a big draft is checked like a create.
    const draft = await request(appServer).post('/api/projects').set('Authorization', auth)
      .send({ title: 'Draft', shortDescription: 'Summary', caseStudyBody: CASE_STUDY }).expect(201);
    await request(appServer).put(`/api/projects/${draft.body._id}`).set('Authorization', auth).send({ visibility: 'published' }).expect(403)
      .expect((res) => expect(res.body.resource).toBe('content_bytes'));
    const first = await Project.findOne({ owner: user._id, slug: 'project-0' }).lean();
    await request(appServer).put(`/api/projects/${first._id}`).set('Authorization', auth).send({ caseStudyBody: 'short now' }).expect(200);
    await request(appServer).put(`/api/projects/${draft.body._id}`).set('Authorization', auth).send({ visibility: 'published' }).expect(200);
  }, 30_000);

  it('keeps a full account under the cacheable size, so /v1/fs and /v1/projects are served and cached', async () => {
    const user = await createUser(User);
    await Project.create(project(user._id, 0));
    const count = Math.floor(LIMITS.publishedContentBytes / (await ownerPublishedBytes(user._id)));
    await Project.insertMany(Array.from({ length: count - 1 }, (_, index) => project(user._id, index + 1)));
    const cmsApp = await createApp(App, user, { include: { projects: { enabled: true, mode: 'all', fields: [] }, fs: { enabled: true } } });
    const { rawToken } = await createToken(ApiToken, cmsApp, 'pk');
    const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
    for (const path of ['/v1/projects', '/v1/fs']) {
      const response = await request(appServer).get(path).set(headers).expect(200);
      expect(Buffer.byteLength(response.text)).toBeLessThan(RESPONSE_CACHE_MAX_ITEM_BYTES);
    }
    const size = responseCache.size;
    await request(appServer).get('/v1/fs').set(headers).expect(200);
    expect(responseCache.size).toBe(size); // a hit, not a reload
  }, 30_000);
});
