const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Profile = require('../models/Profile');
const { createUser, loginAs } = require('./helpers/factory');
const pullContentFromApps = require('../lib/pullContentFromApps');

describe('Apps dashboard API', () => {
  it('validates origins, normalizes accepted origins, and rejects invalid field exposure', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const created = await request(app).post('/api/apps').set('Authorization', auth).send({
      name: 'Portfolio', type: 'static', allowedOrigins: ['https://EXAMPLE.test/path/'], include: {},
    });
    expect(created.status).toBe(201);
    expect(created.body.allowedOrigins).toEqual(['https://example.test']);
    expect(created.body).not.toHaveProperty('quotaSlot');

    const badOrigin = await request(app).post('/api/apps').set('Authorization', auth).send({ name: 'Bad', type: 'static', allowedOrigins: ['http://example.test'] });
    expect(badOrigin.status).toBe(400);
    const badField = await request(app).post('/api/apps').set('Authorization', auth).send({ name: 'Bad field', type: 'protected', include: { profile: { fields: ['phone'] } } });
    expect(badField.status).toBe(400);
  });

  it('rejects selected content owned by another account', async () => {
    const owner = await createUser(User);
    const other = await createUser(User);
    const project = await Project.create({ owner: other._id, title: 'Other project', slug: 'other-project', shortDescription: 'Other', caseStudyBody: 'Other project case study', visibility: 'published' });
    const response = await request(app).post('/api/apps').set('Authorization', loginAs(owner)).send({
      name: 'Invalid selection', type: 'protected', include: { projects: { enabled: true, mode: 'selected', ids: [String(project._id)] } },
    });
    expect(response.status).toBe(400);
    expect(response.body.details.join(' ')).toMatch(/unowned/);
  });

  it('enforces the ten-app quota under concurrent creation', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const create = (number) => request(app).post('/api/apps').set('Authorization', auth).send({ name: `App ${number}`, type: 'protected', include: {} });
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => create(index)));
    expect(results.filter((result) => result.status === 201)).toHaveLength(10);
    expect(results.filter((result) => result.status === 403 && result.body.error === 'quota_exceeded')).toHaveLength(2);
    expect(await App.countDocuments({ owner: user._id })).toBe(10);
  });

  it('returns the projected preview and deep-merges nested include updates', async () => {
    const user = await createUser(User);
    await Profile.create({ owner: user._id, name: 'Preview User', email: 'visible@example.test', phone: 'private', shortBio: 'Bio' });
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Preview', type: 'protected', include: { profile: { enabled: true, fields: ['shortBio'] }, fs: { enabled: true } } });
    const auth = loginAs(user);
    const updated = await request(app).put(`/api/apps/${appDoc._id}`).set('Authorization', auth).send({ include: { profile: { fields: ['email'] } } });
    expect(updated.status).toBe(200);
    expect(updated.body.include.profile.enabled).toBe(true);
    const preview = await request(app).get(`/api/apps/${appDoc._id}/preview`).set('Authorization', auth);
    expect(preview.status).toBe(200);
    expect(preview.body.profile.email).toBe('visible@example.test');
    expect(preview.body.profile).not.toHaveProperty('phone');
    expect(preview.body.fs.type).toBe('directory');
    expect(preview.body.fs.children.find((node) => node.name === 'about').children.find((node) => node.name === 'contact.json').content).not.toHaveProperty('phone');
  });

  it('returns not found for another owner and rejects malformed IDs', async () => {
    const owner = await createUser(User);
    const stranger = await createUser(User);
    const appDoc = await App.create({ owner: owner._id, quotaSlot: 0, name: 'Private', type: 'protected' });
    const hidden = await request(app).get(`/api/apps/${appDoc._id}/preview`).set('Authorization', loginAs(stranger));
    const invalid = await request(app).get('/api/apps/not-an-id/preview').set('Authorization', loginAs(stranger));
    expect(hidden.status).toBe(404);
    expect(invalid.status).toBe(404);
    expect(mongoose.isValidObjectId(appDoc._id)).toBe(true);
  });

  it('casts deleted content IDs and removes them from selected app views', async () => {
    const user = await createUser(User);
    const project = await Project.create({ owner: user._id, title: 'Selected project', slug: 'selected-project', shortDescription: 'Selected', caseStudyBody: 'Project body' });
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Selected', type: 'protected', include: { projects: { enabled: true, mode: 'selected', ids: [project._id] } } });
    await pullContentFromApps(user._id, 'Project', project._id.toString());
    const updated = await App.findOne({ owner: user._id, _id: appDoc._id });
    expect(updated.include.projects.ids).toHaveLength(0);
  });

  it('cleans selected App IDs when skills are removed through the bulk-delete route', async () => {
    const user = await createUser(User);
    const skill = await Skill.create({ owner: user._id, name: 'React', category: 'Frontend' });
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Skill view', type: 'protected', include: { skills: { enabled: true, mode: 'selected', ids: [skill._id] } } });
    const response = await request(app).post('/api/skills/bulk-delete').set('Authorization', loginAs(user)).send({ ids: [String(skill._id)] });
    expect(response.status).toBe(200);
    const updated = await App.findOne({ owner: user._id, _id: appDoc._id });
    expect(updated.include.skills.ids).toHaveLength(0);
  });
});
