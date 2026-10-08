const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { createUser } = require('./helpers/factory');

describe('public resume download redirect', () => {
  it('redirects to the primary owner resume URL', async () => {
    const user = await createUser(User, { email: 'resume-owner@test.com' });
    await Resume.create({ owner: user._id, resumeUrl: 'https://files.test/resume.pdf' });
    const previousEmail = process.env.ADMIN_EMAIL;
    process.env.ADMIN_EMAIL = user.email;
    try {
      const response = await request(app).get('/api/resume/download').expect(302);
      expect(response.headers.location).toBe('https://files.test/resume.pdf');
    } finally {
      if (previousEmail === undefined) delete process.env.ADMIN_EMAIL;
      else process.env.ADMIN_EMAIL = previousEmail;
    }
  });
});
