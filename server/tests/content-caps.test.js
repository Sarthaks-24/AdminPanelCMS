const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Profile = require('../models/Profile');
const { PUBLIC_FIELDS } = require('../lib/modelConstants');
const { createUser, loginAs } = require('./helpers/factory');

const long = (n) => 'x'.repeat(n);

describe('content field caps (contract §4)', () => {
  let auth;
  beforeEach(async () => { auth = loginAs(await createUser(User)); });

  it.each([
    ['Profile', 'put', '/api/profile', { initials: long(5) }, 'initials'],
    ['Profile metrics', 'put', '/api/profile', { metrics: Array.from({ length: 9 }, (_, i) => ({ label: `m${i}`, value: '1' })) }, 'metrics'],
    ['Resume', 'put', '/api/resume', { resumeUrl: 'https://files.test/cv.pdf', fileName: long(121) }, 'fileName'],
    ['Project', 'post', '/api/projects', { title: 'Capped', shortDescription: 'ok', highlights: Array.from({ length: 16 }, () => 'h') }, 'highlights'],
    ['Project role', 'post', '/api/projects', { title: 'Capped role', shortDescription: 'ok', role: long(81) }, 'role'],
    ['Skill', 'post', '/api/skills', { name: 'Capped', category: long(61) }, 'category'],
    ['Social', 'post', '/api/socials', { platform: 'Site', label: 'site', url: 'https://site.test', username: long(81) }, 'username'],
    ['Experience', 'post', '/api/experience', { company: 'Co', role: 'Dev', period: long(61), description: 'd' }, 'period'],
    ['Experience technologies', 'post', '/api/experience', { company: 'Co', role: 'Dev', period: '2024', description: 'd', technologies: [long(41)] }, 'technologies'],
    ['Education', 'post', '/api/education', { institution: 'U', degree: 'BSc', period: '2020', grade: long(41) }, 'grade'],
    ['Certification', 'post', '/api/certifications', { title: 'Cert', issuer: 'Org', issueDate: long(33) }, 'issueDate'],
  ])('rejects an over-length %s write with 400 naming the field', async (_label, method, path, body, field) => {
    const response = await request(app)[method](path).set('Authorization', auth).send(body);
    expect(response.status).toBe(400);
    expect(response.body.fields).toContain(field);
  });

  it('accepts an experience description up to 2,000 characters and stores blank defaults', async () => {
    const response = await request(app).post('/api/experience').set('Authorization', auth)
      .send({ company: 'Co', role: 'Dev', period: '2024', description: long(2000) });
    expect(response.status).toBe(201);
    expect(response.body.location).toBe('');
    const tooLong = await request(app).post('/api/experience').set('Authorization', auth)
      .send({ company: 'Co', role: 'Dev', period: '2024', description: long(2001) });
    expect(tooLong.status).toBe(400);
  });

  it('ships blank profile defaults with configured:false and no operator placeholders', async () => {
    const blank = new Profile({ owner: '507f1f77bcf86cd799439011' }).toObject();
    expect(blank).toMatchObject({
      name: '', initials: '', headline: '', shortBio: '', aboutMarkdown: '', email: '', statusText: '', bootGreeting: '',
      terminalUser: '', terminalHost: '', isAvailableForHire: false, configured: false, metrics: [],
      location: { city: '', country: '', isRemoteAvailable: false },
    });
    const Resume = require('../models/Resume');
    expect(new Resume({ owner: '507f1f77bcf86cd799439011', resumeUrl: 'https://x.test/a.pdf' }).toObject()).toMatchObject({ fileName: '', version: '', summaryText: '' });
    const Project = require('../models/Project');
    const project = new Project({ owner: '507f1f77bcf86cd799439011', title: 'T', slug: 't', shortDescription: 's' });
    expect(project.role).toBe('');
    expect(project.caseStudyBody).toBe('');
    await expect(project.validate()).resolves.toBeUndefined();
  });

  it('rejects App include fields that exceed the model cap or repeat (33 duplicate fields)', async () => {
    const duplicates = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Dupes', type: 'protected', include: { projects: { enabled: true, fields: Array.from({ length: 33 }, () => 'title') } } });
    expect(duplicates.status).toBe(400);
    expect(duplicates.body.details.join(' ')).toMatch(/projects\.fields may contain at most/);
    const repeated = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Dupes', type: 'protected', include: { projects: { enabled: true, fields: ['title', 'title'] } } });
    expect(repeated.status).toBe(400);
    expect(repeated.body.details.join(' ')).toMatch(/duplicate fields/);
    const tooManyIds = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Ids', type: 'protected', include: { projects: { enabled: true, mode: 'selected', ids: Array.from({ length: 101 }, () => '507f1f77bcf86cd799439011') } } });
    expect(tooManyIds.status).toBe(400);
    expect(tooManyIds.body.details.join(' ')).toMatch(/at most 100 ids/);
    const tooManyCategories = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Cats', type: 'protected', include: { skills: { enabled: true, categories: Array.from({ length: 51 }, (_, i) => `c${i}`) } } });
    expect(tooManyCategories.status).toBe(400);
    expect(tooManyCategories.body.details.join(' ')).toMatch(/at most 50/);
    const full = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'All fields', type: 'protected', include: { projects: { enabled: true, fields: [...PUBLIC_FIELDS.Project] } } });
    expect(full.status).toBe(201);
  });
});
