const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Profile = require('../models/Profile');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const EmailToken = require('../models/EmailToken');
const Invite = require('../models/Invite');
const { digest, inviteDigest, issueEmailToken } = require('../lib/emailTokens');
const { cascadeDeletedOwner } = require('../controllers/accountController');
const { loginAs, createApp, createToken, seedContent } = require('./helpers/factory');

describe('account export and deletion lifecycle', () => {
  it('exports only the account owner’s data and safe token metadata, then deletes idempotently', async () => {
    const passwordHash = await bcrypt.hash('a-long-secure-password', 4);
    const owner = await User.create({ email: 'export-owner@test.com', passwordHash, emailVerifiedAt: new Date(), acceptedTermsAt: new Date() });
    const other = await User.create({ email: 'other-owner@test.com', passwordHash, emailVerifiedAt: new Date() });
    const contentModels = {
      Profile,
      Resume: require('../models/Resume'),
      Project: require('../models/Project'),
      Skill: require('../models/Skill'),
      Social: require('../models/Social'),
      Experience: require('../models/Experience'),
      Education: require('../models/Education'),
      Certification: require('../models/Certification'),
    };
    await seedContent(contentModels, owner);
    await Profile.create({ owner: other._id, name: 'Other profile', email: other.email });
    const appDoc = await createApp(App, owner);
    const { rawToken } = await createToken(ApiToken, appDoc, 'sk');
    const emailToken = await issueEmailToken(owner._id, 'verify');
    await Invite.create({ codeHash: inviteDigest('123456'), usedBy: owner._id, expiresAt: new Date(Date.now() + 60_000) });

    const auth = loginAs(owner);
    const exported = await request(app).get('/api/account/export').set('Authorization', auth).expect(200);
    expect(exported.headers['content-disposition']).toContain('account-export.json');
    expect(exported.body.content.profile).toHaveLength(1);
    for (const collection of Object.values(exported.body.content)) expect(collection).toHaveLength(1);
    expect(exported.body.apps).toHaveLength(1);
    expect(exported.body.tokens).toHaveLength(1);
    expect(exported.body.tokens[0]).toHaveProperty('prefix');
    const json = JSON.stringify(exported.body);
    expect(json).not.toContain('passwordHash');
    expect(json).not.toContain(rawToken);
    expect(json).not.toContain(digest(emailToken));
    expect(json).not.toContain(inviteDigest('123456'));
    expect(json).not.toContain(other.email);

    await request(app).delete('/api/account').set('Authorization', auth).send({ password: 'wrong-password' })
      .expect(401, { success: false, error: 'credentials_invalid' });
    await request(app).delete('/api/account').set('Authorization', auth).send({ password: 'a-long-secure-password' })
      .expect(200, { success: true, deleted: true });

    expect(await User.exists({ _id: owner._id })).toBeFalsy();
    for (const Model of Object.values(contentModels)) expect(await Model.countDocuments({ owner: owner._id })).toBe(0);
    expect(await App.countDocuments({ owner: owner._id })).toBe(0);
    expect(await ApiToken.countDocuments({ owner: owner._id })).toBe(0);
    expect(await EmailToken.countDocuments({ user: owner._id })).toBe(0);
    expect(await Invite.exists({ usedBy: owner._id })).toBeFalsy();
    await cascadeDeletedOwner(owner._id);
  });

  it('refuses to delete the last superadmin and accounts without a password', async () => {
    const passwordHash = await bcrypt.hash('a-long-secure-password', 4);
    const admin = await User.create({ email: 'last-admin@test.com', passwordHash, emailVerifiedAt: new Date(), role: 'superadmin' });
    const refused = await request(app).delete('/api/account').set('Authorization', loginAs(admin)).send({ password: 'a-long-secure-password' });
    expect(refused.status).toBe(400);
    expect(refused.body.error).toBe('last_superadmin');
    expect(await User.exists({ _id: admin._id })).toBeTruthy();

    await User.create({ email: 'second-admin@test.com', passwordHash, emailVerifiedAt: new Date(), role: 'superadmin' });
    await request(app).delete('/api/account').set('Authorization', loginAs(admin)).send({ password: 'a-long-secure-password' }).expect(200);
    expect(await User.exists({ _id: admin._id })).toBeFalsy();

    const pending = await User.create({ email: 'no-password@test.com', passwordHash: null, emailVerifiedAt: new Date() });
    await request(app).delete('/api/account').set('Authorization', loginAs(pending)).send({ password: '' }).expect(401);
  });
});
