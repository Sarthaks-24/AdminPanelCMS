const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const Invite = require('../models/Invite');
const { inviteDigest } = require('../lib/emailTokens');
const { createUser, loginAs } = require('./helpers/factory');

describe('superadmin controls', () => {
  it('denies platform controls to regular or unverified accounts', async () => {
    const regular = await createUser(User);
    const unverifiedAdmin = await createUser(User, { role: 'superadmin', emailVerifiedAt: null });
    await request(app).get('/api/admin/invites').set('Authorization', loginAs(regular)).expect(403, { success: false, error: 'admin_required', message: 'Superadmin access required' });
    await request(app).get('/api/admin/invites').set('Authorization', loginAs(unverifiedAdmin)).expect(403, { success: false, error: 'email_unverified', message: 'Verify your email before changing content' });
  });

  it('creates, lists, and revokes hashed invite codes without returning stored hashes', async () => {
    const admin = await createUser(User, { role: 'superadmin' });
    const auth = loginAs(admin);
    const created = await request(app).post('/api/admin/invites').set('Authorization', auth).send({ expiresInDays: 14, maxUses: 3 }).expect(201);
    const code = created.body.invite.code;
    expect(code).toMatch(/^\d{6}$/);
    expect(created.body.invite.maxUses).toBe(3);
    expect(await Invite.exists({ codeHash: inviteDigest(code), usedBy: null })).toBeTruthy();
    const listed = await request(app).get('/api/admin/invites').set('Authorization', auth).expect(200);
    expect(listed.body.invites[0]).not.toHaveProperty('codeHash');
    expect(listed.body.invites[0]).not.toHaveProperty('code');
    expect(listed.body.invites[0]).not.toHaveProperty('createdBy');
    expect(listed.body.invites[0]).not.toHaveProperty('usedBy');
    expect(listed.body.invites[0]).toMatchObject({ usedCount: 0, maxUses: 3, remainingUses: 3 });
    await request(app).delete(`/api/admin/invites/${created.body.invite.id}`).set('Authorization', auth).expect(200, { success: true, revoked: true });
    expect(await Invite.countDocuments()).toBe(0);
  });

  it('returns aggregate performance metrics without exposing individual API app details', async () => {
    const admin = await createUser(User, { role: 'superadmin' });
    const owner = await createUser(User, { email: 'private-owner@test.com' });
    const appDoc = await App.create({ owner: owner._id, quotaSlot: 0, name: 'Owner App', type: 'protected', allowedOrigins: ['https://portfolio.test'], include: {} });
    const dashboard = await request(app).get('/api/admin/overview').set('Authorization', loginAs(admin)).expect(200);
    expect(dashboard.body.totals.apps).toBe(1);
    expect(dashboard.body.performance).toMatchObject({ database: 'connected' });
    expect(dashboard.body.performance.memory.rssMb).toEqual(expect.any(Number));
    expect(JSON.stringify(dashboard.body)).not.toContain('Owner App');
    expect(JSON.stringify(dashboard.body)).not.toContain(owner.email);
    await request(app).get('/api/admin/apps').set('Authorization', loginAs(admin)).expect(404);
    await request(app).put(`/api/admin/apps/${appDoc._id}`).set('Authorization', loginAs(admin)).send({ name: 'Renamed App' }).expect(404);
    await request(app).delete(`/api/admin/apps/${appDoc._id}`).set('Authorization', loginAs(admin)).expect(404);
    expect((await App.findOne({ owner: owner._id, _id: appDoc._id })).name).toBe('Owner App');
  });
});

describe('signup mode setting', () => {
  afterEach(() => { delete process.env.SIGNUP_MODE; delete process.env.LEGAL_POLICIES_APPROVED; process.env.NODE_ENV = 'test'; });

  it('is superadmin-only and rejects unknown modes', async () => {
    const regular = await createUser(User);
    const admin = await createUser(User, { role: 'superadmin' });
    await request(app).get('/api/admin/settings').set('Authorization', loginAs(regular)).expect(403);
    await request(app).put('/api/admin/settings').set('Authorization', loginAs(regular)).send({ signupMode: 'open' }).expect(403);
    await request(app).put('/api/admin/settings').set('Authorization', loginAs(admin)).send({ signupMode: 'anyone' }).expect(400);
    await request(app).put('/api/admin/settings').set('Authorization', loginAs(admin)).send({}).expect(400);
  });

  it('defaults to the environment value and lets the dashboard override it for signup', async () => {
    const admin = await createUser(User, { role: 'superadmin' });
    const auth = loginAs(admin);
    process.env.SIGNUP_MODE = 'invite';
    const initial = await request(app).get('/api/admin/settings').set('Authorization', auth).expect(200);
    expect(initial.body.settings).toMatchObject({ signupMode: 'invite', source: 'environment' });
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: true, signupMode: 'invite' });

    const updated = await request(app).put('/api/admin/settings').set('Authorization', auth).send({ signupMode: 'open' }).expect(200);
    expect(updated.body.settings).toMatchObject({ signupMode: 'open', source: 'dashboard' });
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: true, signupMode: 'open' });

    await request(app).put('/api/admin/settings').set('Authorization', auth).send({ signupMode: 'invite' }).expect(200);
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: true, signupMode: 'invite' });
  });

  it('stays closed in production until legal policies are approved, even when set to open', async () => {
    const admin = await createUser(User, { role: 'superadmin' });
    await request(app).put('/api/admin/settings').set('Authorization', loginAs(admin)).send({ signupMode: 'open' }).expect(200);
    process.env.NODE_ENV = 'production';
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: false, signupMode: 'closed' });
    process.env.LEGAL_POLICIES_APPROVED = 'true';
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: true, signupMode: 'open' });
  });
});
