const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const { createUser, loginAs, seedContent } = require('./helpers/factory');
const contentChanged = require('../lib/onContentChanged');
const Social = require('../models/Social');
const Profile = require('../models/Profile');

describe('onContentChanged write hook', () => {
  it('runs after dashboard content writes across generic and specialized routes', async () => {
    const user = await createUser(User);
    const seeded = await seedContent({
      Profile: require('../models/Profile'), Project: require('../models/Project'), Resume: require('../models/Resume'),
      Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'),
      Education: require('../models/Education'), Certification: require('../models/Certification'),
    }, user);
    const spy = vi.spyOn(contentChanged, 'onContentChanged');
      const auth = loginAs(user);
    try {
      const created = await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'Hook create', mode: 'solo', role: 'Lead', shortDescription: 'test', caseStudyBody: 'test' }).expect(201);
      await request(app).delete(`/api/projects/${created.body._id}`).set('Authorization', auth).expect(200);
      await request(app).put('/api/profile').set('Authorization', auth).send({ name: 'Updated name' }).expect(200);
      await request(app).patch('/api/profile/availability').set('Authorization', auth).send({ isAvailableForHire: false }).expect(200);
      await request(app).put('/api/profile').set('Authorization', auth).send({ email: 'new-email@test.com' }).expect(200);
      const emailSocial = await Social.findOne({ owner: user._id, platform: 'Email' });
      expect(emailSocial.visibility).toBe('published');
      await Social.findOneAndUpdate({ _id: emailSocial._id, owner: user._id }, { $set: { visibility: 'draft' } });
      await request(app).put('/api/profile').set('Authorization', auth).send({ email: 'changed-email@test.com' }).expect(200);
      expect((await Social.findOne({ _id: emailSocial._id, owner: user._id })).visibility).toBe('draft');
      await request(app).put('/api/resume').set('Authorization', auth).send({ resumeUrl: 'https://test.com/updated.pdf' }).expect(200);
      await request(app).put(`/api/projects/${seeded.project._id}`).set('Authorization', auth).send({ title: 'Updated project' }).expect(200);
      await request(app).put(`/api/socials/${seeded.social._id}`).set('Authorization', auth).send({ label: 'updated' }).expect(200);
      await request(app).patch('/api/skills/bulk').set('Authorization', auth)
        .send({ ids: [seeded.skill._id], updates: { visibility: 'published' } }).expect(200);
      await request(app).patch('/api/projects/reorder').set('Authorization', auth)
        .send({ items: [{ id: seeded.project._id, order: 3 }] }).expect(200);
      await request(app).patch('/api/socials/reorder').set('Authorization', auth)
        .send({ items: [{ id: seeded.social._id, order: 2 }] }).expect(200);
      await request(app).post('/api/skills/bulk-delete').set('Authorization', auth)
        .send({ ids: [seeded.skill._id] }).expect(200);
      expect(spy).toHaveBeenCalledTimes(13);
      expect(spy).toHaveBeenCalledWith(user._id);
    } finally {
      spy.mockRestore();
    }
  });
});
