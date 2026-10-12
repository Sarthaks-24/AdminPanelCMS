const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { loginAs, seedContent } = require('./helpers/factory');

const contentModels = {
  Profile: require('../models/Profile'),
  Resume: require('../models/Resume'),
  Project: require('../models/Project'),
  Skill: require('../models/Skill'),
  Social: require('../models/Social'),
  Experience: require('../models/Experience'),
  Education: require('../models/Education'),
  Certification: require('../models/Certification'),
};

describe('GET /api/account/summary', () => {
  it('counts only the signed-in owner’s content', async () => {
    const passwordHash = await bcrypt.hash('a-long-secure-password', 4);
    const owner = await User.create({ email: 'summary-owner@test.com', passwordHash, emailVerifiedAt: new Date() });
    const other = await User.create({ email: 'summary-other@test.com', passwordHash, emailVerifiedAt: new Date() });
    await seedContent(contentModels, owner);
    await seedContent(contentModels, other);

    const { body } = await request(app).get('/api/account/summary').set('Authorization', loginAs(owner)).expect(200);
    expect(body).toEqual({ projects: 1, skills: 1, socials: 1, experience: 1, education: 1, certifications: 1, profile: true, resume: true });
  });

  it('reports an empty account as zeros and false', async () => {
    const owner = await User.create({ email: 'summary-empty@test.com', passwordHash: await bcrypt.hash('a-long-secure-password', 4), emailVerifiedAt: new Date() });
    const { body } = await request(app).get('/api/account/summary').set('Authorization', loginAs(owner)).expect(200);
    expect(body).toEqual({ projects: 0, skills: 0, socials: 0, experience: 0, education: 0, certifications: 0, profile: false, resume: false });
  });

  it('requires a session', async () => {
    await request(app).get('/api/account/summary').expect(401);
  });
});
