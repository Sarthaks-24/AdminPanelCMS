const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');

const User = require('../models/User');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const Social = require('../models/Social');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const { createUser, loginAs, seedContent } = require('./helpers/factory');

const allModels = { Profile, Project, Resume, Skill, Social, Experience, Education, Certification };

const contentRoutes = [
  { name: 'projects', path: '/api/projects', model: Project, key: 'project', field: 'title', original: 'Alpha Trading Engine', changed: 'Changed Project' },
  { name: 'skills', path: '/api/skills', model: Skill, key: 'skill', field: 'featured', original: true, changed: false },
  { name: 'socials', path: '/api/socials', model: Social, key: 'social', field: 'label', original: 'github.com/testuser', changed: 'changed.example' },
  { name: 'experience', path: '/api/experience', model: Experience, key: 'experience', field: 'company', original: 'Cloud Corp', changed: 'Changed Corp' },
  { name: 'education', path: '/api/education', model: Education, key: 'education', field: 'institution', original: 'Tech University', changed: 'Changed University' },
  { name: 'certifications', path: '/api/certifications', model: Certification, key: 'certification', field: 'title', original: 'Certified Kubernetes Administrator', changed: 'Changed Certification' },
];

describe('Cross-tenant data isolation safety gate', () => {
  it.each(contentRoutes)('does not expose User A $name records in User B dashboard reads', async (route) => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const seeded = await seedContent(allModels, userA);

    const response = await request(app)
      .get(route.path)
      .set('Authorization', loginAs(userB));

    expect.soft(response.status).toBe(200);
    expect.soft(JSON.stringify(response.body)).not.toContain(seeded[route.key]._id.toString());
  });

  it.each(contentRoutes)('does not let User B update User A $name records', async (route) => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const seeded = await seedContent(allModels, userA);
    const doc = seeded[route.key];

    const response = await request(app)
      .put(`${route.path}/${doc._id}`)
      .set('Authorization', loginAs(userB))
      .send({ [route.field]: route.changed });

    expect.soft(response.status).toBe(404);
    expect.soft((await route.model.findOne({ _id: doc._id, owner: userA._id }))?.[route.field]).toBe(route.original);
  });

  it.each(contentRoutes)('does not let User B delete User A $name records', async (route) => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const seeded = await seedContent(allModels, userA);
    const doc = seeded[route.key];

    const response = await request(app)
      .delete(`${route.path}/${doc._id}`)
      .set('Authorization', loginAs(userB));

    expect.soft(response.status).toBe(404);
    expect.soft(await route.model.findOne({ _id: doc._id, owner: userA._id })).not.toBeNull();
  });

  it('does not expose User A project records to User B', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const { project } = await seedContent(allModels, userA);

    const response = await request(app)
      .get(`/api/projects/${project._id}`)
      .set('Authorization', loginAs(userB));

    expect.soft(response.status).toBe(404);
  });

  it('requires a session for legacy dashboard reads even when ADMIN_EMAIL is configured', async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const userA = await createUser(User);
    await seedContent(allModels, userA);
    process.env.ADMIN_EMAIL = userA.email;
    try {
      await request(app).get('/api/projects').expect(401);
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
    }
  });

  it('requires sessions for dashboard reads when ADMIN_EMAIL is unset', async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_EMAIL;
    try {
      const user = await createUser(User);
      await seedContent(allModels, user);
      const profile = await request(app).get('/api/profile');
      const projects = await request(app).get('/api/projects');
      expect(profile.status).toBe(401);
      expect(projects.status).toBe(401);
    } finally {
      if (previousEmail !== undefined) process.env.ADMIN_EMAIL = previousEmail;
    }
  });

  it('rejects an invalid JWT without falling back to ADMIN_EMAIL', async () => {
    const previousEmail = process.env.ADMIN_EMAIL;
    const user = await createUser(User);
    const { project } = await seedContent(allModels, user);
    process.env.ADMIN_EMAIL = user.email;
    try {
      const response = await request(app).get(`/api/projects/${project._id}`).set('Authorization', 'Bearer invalid.jwt.token');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('invalid_session');
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
    }
  });

  it('retires unauthenticated legacy GET routes after the /v1 cutover', async () => {
    const paths = [
      '/api/profile', '/api/projects', `/api/projects/${new mongoose.Types.ObjectId()}`,
      '/api/skills', '/api/socials', '/api/experience', '/api/education', '/api/certifications', '/api/resume',
    ];
    for (const path of paths) await request(app).get(path).expect(401);
    await request(app).get('/api/resume/download').expect(404);
    await request(app).get('/api/fs').expect(404);
  });

  it('keeps slug lookups working while malformed ObjectId writes fail validation', async () => {
    const user = await createUser(User);
    const { project } = await seedContent(allModels, user);
    const bySlug = await request(app).get(`/api/projects/${project.slug}`).set('Authorization', loginAs(user));
    expect(bySlug.status).toBe(200);
    expect(bySlug.body._id).toBe(project._id.toString());
    const invalidWrite = await request(app).put('/api/projects/not-an-id').set('Authorization', loginAs(user)).send({ title: 'ignored' });
    expect(invalidWrite.status).toBe(404);
  });

  it('does not let User B update User A project records', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const { project } = await seedContent(allModels, userA);

    const response = await request(app)
      .put(`/api/projects/${project._id}`)
      .set('Authorization', loginAs(userB))
      .send({ title: 'Hacked Title' });

    expect.soft(response.status).toBe(404);
    const freshA = await Project.findOne({ _id: project._id, owner: userA._id });
    expect.soft(freshA?.title).toBe('Alpha Trading Engine');
  });

  it('does not let User B delete User A project records', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const { project } = await seedContent(allModels, userA);

    const response = await request(app)
      .delete(`/api/projects/${project._id}`)
      .set('Authorization', loginAs(userB));

    expect.soft(response.status).toBe(404);
    expect.soft(await Project.findOne({ _id: project._id, owner: userA._id })).not.toBeNull();
  });

  it('keeps profile and resume upserts isolated by owner', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);

    await Profile.create({ owner: userA._id, name: 'Alice' });
    await Resume.create({ owner: userA._id, resumeUrl: 'https://test.com/alice.pdf' });

    const profileResponse = await request(app)
      .put('/api/profile')
      .set('Authorization', loginAs(userB))
      .send({ name: 'Bob' });
    const resumeResponse = await request(app)
      .put('/api/resume')
      .set('Authorization', loginAs(userB))
      .send({ resumeUrl: 'https://test.com/bob.pdf' });

    expect.soft([200, 201]).toContain(profileResponse.status);
    expect.soft([200, 201]).toContain(resumeResponse.status);
    expect.soft((await Profile.findOne({ owner: userA._id }))?.name).toBe('Alice');
    expect.soft((await Resume.findOne({ owner: userA._id }))?.resumeUrl).toBe('https://test.com/alice.pdf');
  });

  it('allows different users to use case-insensitively equal skill names', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    await Skill.create({ owner: userA._id, name: 'react', category: 'Frontend' });

    const response = await request(app)
      .post('/api/skills')
      .set('Authorization', loginAs(userB))
      .send({ name: 'React', category: 'Frontend' });

    expect(response.status).toBe(201);
    expect.soft(await Skill.findOne({ owner: userA._id, name: 'react' })).not.toBeNull();
    expect.soft(await Skill.findOne({ owner: userB._id, name: 'React' })).not.toBeNull();
  });

  it('does not let User B reorder User A project records', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const { project } = await seedContent(allModels, userA);

    const response = await request(app)
      .patch('/api/projects/reorder')
      .set('Authorization', loginAs(userB))
      .send({ items: [{ id: project._id, order: 99 }] });

    expect.soft(response.status).toBe(404);
    const freshA = await Project.findOne({ _id: project._id, owner: userA._id });
    expect.soft(freshA?.order).toBe(0);
  });

  it('ignores owner reassignment in an authenticated project PATCH body', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const { project } = await seedContent(allModels, userA);
    const response = await request(app).put(`/api/projects/${project._id}`)
      .set('Authorization', loginAs(userA)).send({ title: 'Still mine', owner: userB._id });
    expect(response.status).toBe(200);
    expect(String(response.body.owner)).toBe(String(userA._id));
    expect(await Project.findOne({ _id: project._id, owner: userB._id })).toBeNull();
  });

  it('keeps mixed-owner project reorder operations scoped to the authenticated owner', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const projectA = await Project.create({ owner: userA._id, title: 'A project', slug: 'a-project', mode: 'solo', role: 'Lead', shortDescription: 'A', caseStudyBody: 'A', order: 0 });
    const projectB = await Project.create({ owner: userB._id, title: 'B project', slug: 'b-project', mode: 'solo', role: 'Lead', shortDescription: 'B', caseStudyBody: 'B', order: 0 });
    const response = await request(app).patch('/api/projects/reorder').set('Authorization', loginAs(userA))
      .send({ items: [{ id: projectA._id, order: 7 }, { id: projectB._id, order: 99 }] });
    expect(response.status).toBe(404);
    expect((await Project.findOne({ _id: projectA._id, owner: userA._id })).order).toBe(7);
    expect((await Project.findOne({ _id: projectB._id, owner: userB._id })).order).toBe(0);
  });

  it('does not let User B bulk-update User A skills', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const skillA = await Skill.create({
      owner: userA._id,
      name: 'TypeScript',
      category: 'Languages',
      featured: false,
    });

    const response = await request(app)
      .patch('/api/skills/bulk')
      .set('Authorization', loginAs(userB))
      .send({ ids: [skillA._id], updates: { featured: true } });

    expect.soft(response.status).toBe(200);
    expect.soft((await Skill.findOne({ _id: skillA._id, owner: userA._id }))?.featured).toBe(false);
  });

  it('does not let a bulk update reassign a skill to another owner', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const skillB = await Skill.create({
      owner: userB._id,
      name: 'Go',
      category: 'Languages',
      featured: false,
    });

    const response = await request(app)
      .patch('/api/skills/bulk')
      .set('Authorization', loginAs(userB))
      .send({ ids: [skillB._id], updates: { owner: userA._id, featured: true } });

    expect.soft(response.status).toBe(200);
    expect.soft(await Skill.findOne({ _id: skillB._id, owner: userB._id })).not.toBeNull();
    expect.soft(await Skill.findOne({ _id: skillB._id, owner: userA._id })).toBeNull();
  });

  it('does not let User B bulk-delete User A skills', async () => {
    const userA = await createUser(User);
    const userB = await createUser(User);
    const skillA = await Skill.create({
      owner: userA._id,
      name: 'Rust',
      category: 'Languages',
    });

    const response = await request(app)
      .post('/api/skills/bulk-delete')
      .set('Authorization', loginAs(userB))
      .send({ ids: [skillA._id] });

    expect.soft(response.status).toBe(200);
    expect.soft(await Skill.findOne({ _id: skillA._id, owner: userA._id })).not.toBeNull();
  });
});
