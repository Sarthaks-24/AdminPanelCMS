const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Social = require('../models/Social');
const App = require('../models/App');
const contentChanged = require('../lib/onContentChanged');
const { createUser, loginAs } = require('./helpers/factory');

describe('profile configured flag and email social (A13, A14, B11)', () => {
  it('returns an unsaved blank profile with configured:false and writes nothing on GET', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const spy = vi.spyOn(contentChanged, 'onContentChanged');
    try {
      const response = await request(app).get('/api/profile').set('Authorization', auth);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ configured: false, name: '', headline: '', shortBio: '', isAvailableForHire: false, metrics: [] });
      expect(response.body.location).toEqual({ city: '', country: '', isRemoteAvailable: false });
      expect(String(response.body.owner)).toBe(String(user._id));
      expect(await Profile.countDocuments({ owner: user._id })).toBe(0);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }

    const saved = await request(app).put('/api/profile').set('Authorization', auth).send({ name: 'Ada' });
    expect(saved.status).toBe(200);
    expect(saved.body.configured).toBe(true);
    expect((await Profile.findOne({ owner: user._id })).configured).toBe(true);
    const again = await request(app).get('/api/profile').set('Authorization', auth);
    expect(again.body.configured).toBe(true);
    expect(again.body.name).toBe('Ada');
  });

  it('marks the profile configured through the availability patch too', async () => {
    const user = await createUser(User);
    const response = await request(app).patch('/api/profile/availability').set('Authorization', loginAs(user)).send({ isAvailableForHire: true, statusText: 'Open' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ configured: true, isAvailableForHire: true, statusText: 'Open' });
  });

  it('rejects a malformed email before writing anything (B11)', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await request(app).put('/api/profile').set('Authorization', auth).send({ name: 'Ada', email: 'ada@example.test' }).expect(200);
    const bad = await request(app).put('/api/profile').set('Authorization', auth).send({ name: 'Changed', email: 'not-an-email' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('validation_failed');
    expect(bad.body.fields).toContain('email');
    const stored = await Profile.findOne({ owner: user._id });
    expect(stored.name).toBe('Ada');
    expect(stored.email).toBe('ada@example.test');
  });

  it('inserts the Email social as an unfeatured draft, never re-features it, and deletes it when the email is cleared', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await request(app).put('/api/profile').set('Authorization', auth).send({ email: 'ada@example.test' }).expect(200);
    const social = await Social.findOne({ owner: user._id, platform: 'Email' });
    expect(social).toMatchObject({ visibility: 'draft', featured: false, url: 'mailto:ada@example.test', icon: 'mail' });

    await Social.findOneAndUpdate({ _id: social._id, owner: user._id }, { $set: { visibility: 'published', featured: false } });
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Selected', type: 'protected', include: { socials: { enabled: true, mode: 'selected', ids: [social._id] } } });
    await request(app).put('/api/profile').set('Authorization', auth).send({ email: 'ada2@example.test' }).expect(200);
    const resaved = await Social.findOne({ _id: social._id, owner: user._id });
    expect(resaved).toMatchObject({ visibility: 'published', featured: false, url: 'mailto:ada2@example.test', label: 'ada2@example.test' });
    expect(await Social.countDocuments({ owner: user._id, platform: 'Email' })).toBe(1);

    const cleared = await request(app).put('/api/profile').set('Authorization', auth).send({ email: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.email).toBe('');
    expect(await Social.countDocuments({ owner: user._id, platform: 'Email' })).toBe(0);
    expect((await App.findOne({ _id: appDoc._id, owner: user._id })).include.socials.ids).toHaveLength(0);
  });
});
