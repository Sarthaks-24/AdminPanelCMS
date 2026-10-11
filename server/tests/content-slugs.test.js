const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Project = require('../models/Project');
const { slugify } = require('../controllers/projectController');
const { createUser, loginAs } = require('./helpers/factory');

describe('project slugs (A11)', () => {
  it('slugifies cleanly: "Hello!" -> hello, no leading/trailing or doubled hyphens, capped at 80', () => {
    expect(slugify('Hello!')).toBe('hello');
    expect(slugify('  Hello, World!  ')).toBe('hello-world');
    expect(slugify('--a--b--')).toBe('a-b');
    expect(slugify('x'.repeat(100))).toHaveLength(80);
    expect(slugify('日本語')).toMatch(/^project-[a-z0-9]+$/);
  });

  it('keeps the stored slug on a title-only PUT and changes it only when sent explicitly', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const created = await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'First Title!', shortDescription: 'ok' });
    expect(created.status).toBe(201);
    expect(created.body.slug).toBe('first-title');
    const renamed = await request(app).put(`/api/projects/${created.body._id}`).set('Authorization', auth).send({ title: 'Completely New Title' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.slug).toBe('first-title');
    expect(renamed.body.title).toBe('Completely New Title');
    const explicit = await request(app).put(`/api/projects/${created.body._id}`).set('Authorization', auth).send({ slug: 'custom-slug' });
    expect(explicit.status).toBe(200);
    expect(explicit.body.slug).toBe('custom-slug');
    const invalid = await request(app).put(`/api/projects/${created.body._id}`).set('Authorization', auth).send({ slug: 'Not A Slug/' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.fields).toContain('slug');
    expect((await Project.findOne({ _id: created.body._id, owner: user._id })).slug).toBe('custom-slug');
  });

  it('answers a same-title create with 409 conflict that names the slug', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'Twin', shortDescription: 'one' }).expect(201);
    const second = await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'Twin', shortDescription: 'two' });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('conflict');
    expect(second.body.message).toContain('"twin"');
    expect(await Project.countDocuments({ owner: user._id })).toBe(1);
    const other = await createUser(User);
    const otherOwner = await request(app).post('/api/projects').set('Authorization', loginAs(other)).send({ title: 'Twin', shortDescription: 'theirs' });
    expect(otherOwner.status).toBe(201);
  });
});
