const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const { DEFAULT_FIELDS } = require('../lib/modelConstants');
const { createUser, loginAs, createToken } = require('./helpers/factory');

const EVERYTHING_PUBLISHED = {
  profile: { enabled: true }, resume: { enabled: true }, socials: { enabled: true, mode: 'all' }, skills: { enabled: true, mode: 'all' },
  projects: { enabled: true, mode: 'all' }, experience: { enabled: true, mode: 'all' }, education: { enabled: true, mode: 'all' },
  certifications: { enabled: true, mode: 'all' }, fs: { enabled: false },
};
const SECTION_KEYS = ['profile', 'resume', 'socials', 'skills', 'projects', 'experience', 'education', 'certifications', 'fs'];

describe('POST /api/apps/:id/check (contract §2.5)', () => {
  it('reports counts, served fields, tokens and warnings for the "Everything published" preset', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await Profile.create({ owner: user._id, name: 'Ada', configured: true });
    await Resume.create({ owner: user._id, resumeUrl: 'https://files.test/cv.pdf' });
    await Project.create({ owner: user._id, title: 'P1', slug: 'p1', shortDescription: 's', visibility: 'published' });
    await Project.create({ owner: user._id, title: 'P2', slug: 'p2', shortDescription: 's', visibility: 'published' });
    await Project.create({ owner: user._id, title: 'P3', slug: 'p3', shortDescription: 's', visibility: 'draft' });
    await Skill.create({ owner: user._id, name: 'Go', category: 'Languages', visibility: 'draft' });
    const created = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'portfolio-site', type: 'protected', include: { ...EVERYTHING_PUBLISHED, projects: { enabled: true, mode: 'all', fields: ['title', 'slug'] } } });
    expect(created.status).toBe(201);
    const appDoc = await App.findOne({ _id: created.body._id, owner: user._id });
    const { tokenDoc } = await createToken(ApiToken, appDoc, 'sk');

    const response = await request(app).post(`/api/apps/${appDoc._id}/check`).set('Authorization', auth).send();
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.app).toEqual({ _id: String(appDoc._id), name: 'portfolio-site', type: 'protected', allowedOrigins: [] });
    expect(response.body.activeTokens).toEqual([{ _id: String(tokenDoc._id), prefix: tokenDoc.prefix, type: 'sk', lastUsedAt: null, expiresAt: null }]);
    expect(response.body.sections.map((section) => section.key)).toEqual(SECTION_KEYS);
    const byKey = Object.fromEntries(response.body.sections.map((section) => [section.key, section]));
    expect(byKey.profile).toEqual({ key: 'profile', enabled: true, published: 1, drafts: 0, servedFields: DEFAULT_FIELDS.Profile });
    expect(byKey.resume).toMatchObject({ enabled: true, published: 1, drafts: 0 });
    expect(byKey.projects).toEqual({ key: 'projects', enabled: true, published: 2, drafts: 1, servedFields: ['title', 'slug'] });
    expect(byKey.skills).toEqual({ key: 'skills', enabled: true, published: 0, drafts: 1, servedFields: DEFAULT_FIELDS.Skill });
    expect(byKey.fs).toEqual({ key: 'fs', enabled: false, published: 0, drafts: 0, servedFields: [] });
    expect(response.body.warnings).toEqual(['no_published:socials', 'all_drafts:skills', 'no_published:experience', 'no_published:education', 'no_published:certifications']);
    expect((await ApiToken.findOne({ _id: tokenDoc._id, owner: user._id })).lastUsedAt).toBeNull();
  });

  it('warns about an empty static App with a wildcard origin and no token, and hides other owners\' Apps', async () => {
    const user = await createUser(User);
    const stranger = await createUser(User);
    const auth = loginAs(user);
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'empty', type: 'static', allowedOrigins: ['*'], include: {} });
    const response = await request(app).post(`/api/apps/${appDoc._id}/check`).set('Authorization', auth);
    expect(response.status).toBe(200);
    expect(response.body.warnings).toEqual(['no_sections_enabled', 'origin_star', 'no_active_token']);
    expect(response.body.sections.every((section) => section.enabled === false)).toBe(true);
    expect(response.body.activeTokens).toEqual([]);
    const profileOnly = await App.create({ owner: user._id, quotaSlot: 1, name: 'profile', type: 'protected', include: { profile: { enabled: true }, resume: { enabled: true } } });
    const missing = await request(app).post(`/api/apps/${profileOnly._id}/check`).set('Authorization', auth);
    expect(missing.body.warnings).toEqual(['profile_missing', 'resume_missing', 'no_active_token']);
    await request(app).post(`/api/apps/${appDoc._id}/check`).set('Authorization', loginAs(stranger)).expect(404);
    await request(app).post('/api/apps/not-an-id/check').set('Authorization', auth).expect(404);
  });
});
