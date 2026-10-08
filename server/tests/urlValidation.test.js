const request = require('supertest');
const app = require('../app');
const Project = require('../models/Project');
const Social = require('../models/Social');
const Resume = require('../models/Resume');
const Experience = require('../models/Experience');
const Certification = require('../models/Certification');
const { createUser, loginAs } = require('./helpers/factory');

describe('URL protocol validation', () => {
  it('accepts HTTPS links and mailto only for social links', async () => {
    const owner = '507f1f77bcf86cd799439011';
    const project = new Project({
      owner,
      title: 'Safe project',
      slug: 'safe-project',
      shortDescription: 'A valid project.',
      caseStudyBody: 'Details',
      thumbnail: 'https://images.example.test/preview.png',
      links: { github: 'https://github.com/example/project', live: '', demo: '' },
    });
    const social = new Social({ owner, platform: 'Email', label: 'Contact', url: 'mailto:person@example.test' });

    await expect(project.validate()).resolves.toBeUndefined();
    await expect(social.validate()).resolves.toBeUndefined();
  });

  it.each([
    ['project link', () => new Project({ owner: '507f1f77bcf86cd799439011', title: 'Unsafe', slug: 'unsafe', shortDescription: 'Details', caseStudyBody: 'Details', links: { github: 'javascript:alert(1)' } }), 'links.github'],
    ['project thumbnail', () => new Project({ owner: '507f1f77bcf86cd799439011', title: 'Unsafe', slug: 'unsafe', shortDescription: 'Details', caseStudyBody: 'Details', thumbnail: 'data:image/svg+xml,<svg onload=alert(1)>' }), 'thumbnail'],
    ['social URL', () => new Social({ owner: '507f1f77bcf86cd799439011', platform: 'Link', label: 'unsafe', url: 'http://example.test' }), 'url'],
    ['resume URL', () => new Resume({ owner: '507f1f77bcf86cd799439011', resumeUrl: 'javascript:alert(1)' }), 'resumeUrl'],
    ['experience URL', () => new Experience({ owner: '507f1f77bcf86cd799439011', company: 'Example', role: 'Engineer', period: '2025-present', description: 'Details', companyUrl: 'ftp://example.test' }), 'companyUrl'],
    ['certification URL', () => new Certification({ owner: '507f1f77bcf86cd799439011', title: 'Example', issuer: 'Example', issueDate: '2025', credentialUrl: 'http://example.test' }), 'credentialUrl'],
  ])('rejects unsafe %s values', async (_label, createDocument, path) => {
    let error;
    try { await createDocument().validate(); } catch (validationError) { error = validationError; }
    expect(error.errors[path]).toBeDefined();
  });

  it('returns a generic 400 validation response for an unsafe dashboard URL', async () => {
    const user = await createUser(require('../models/User'));
    const response = await request(app).post('/api/projects').set('Authorization', loginAs(user)).send({
      title: 'Unsafe project',
      slug: 'unsafe-project',
      shortDescription: 'A project with an unsafe link.',
      caseStudyBody: 'Details',
      thumbnail: 'data:image/svg+xml,<svg onload=alert(1)>',
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: 'validation_error' });
    expect(response.body.fields).toContain('thumbnail');
    expect(response.body.message).not.toContain('data:image');
  });
});
