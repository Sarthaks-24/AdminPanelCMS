const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Setting = require('../models/Setting');
const { createUser, loginAs, createApp, createToken, seedContent } = require('./helpers/factory');

const contentModels = () => ({ Profile: require('../models/Profile'), Project: require('../models/Project'), Resume: require('../models/Resume'), Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'), Education: require('../models/Education'), Certification: require('../models/Certification') });
const freshAdmin = (overrides = {}) => createUser(User, { role: 'superadmin', adminReauthAt: new Date(), ...overrides });

describe('superadmin user management', () => {
  it('lists users with search, status filter and cursor paging, without hashes', async () => {
    const admin = await freshAdmin();
    const auth = loginAs(admin);
    const owner = await createUser(User, { email: 'alpha-owner@test.com' });
    await createUser(User, { email: 'beta-pending@test.com', emailVerifiedAt: null, passwordHash: null });
    await createUser(User, { email: 'gamma-suspended@test.com', status: 'suspended' });
    const appDoc = await createApp(App, owner);
    await createToken(ApiToken, appDoc, 'pk', { lastUsedAt: new Date('2026-10-01T00:00:00Z') });

    const all = await request(app).get('/api/admin/users').set('Authorization', auth).expect(200);
    expect(all.body.users).toHaveLength(4);
    expect(all.body.nextCursor).toBeNull();
    expect(JSON.stringify(all.body)).not.toContain('passwordHash');
    const row = all.body.users.find((user) => user.email === owner.email);
    expect(row).toMatchObject({ status: 'active', role: 'user', appCount: 1, lastTokenUseAt: '2026-10-01T00:00:00.000Z' });
    expect(row.emailVerifiedAt).toBeTruthy();

    const searched = await request(app).get('/api/admin/users?q=ALPHA').set('Authorization', auth).expect(200);
    expect(searched.body.users.map((user) => user.email)).toEqual([owner.email]);
    const suspended = await request(app).get('/api/admin/users?status=suspended').set('Authorization', auth).expect(200);
    expect(suspended.body.users.map((user) => user.email)).toEqual(['gamma-suspended@test.com']);
    const unverified = await request(app).get('/api/admin/users?status=unverified').set('Authorization', auth).expect(200);
    expect(unverified.body.users.map((user) => user.email)).toEqual(['beta-pending@test.com']);
    await request(app).get('/api/admin/users?cursor=nope').set('Authorization', auth).expect(400);
    const paged = await request(app).get(`/api/admin/users?cursor=${all.body.users[0]._id}`).set('Authorization', auth).expect(200);
    expect(paged.body.users).toHaveLength(3);
    await request(app).get('/api/admin/users').set('Authorization', loginAs(owner)).expect(403);
  });

  it('suspends a tenant: their session and API key stop working, other tenants are unaffected, unsuspend restores access', async () => {
    const admin = await freshAdmin();
    const auth = loginAs(admin);
    const target = await createUser(User, { passwordHash: await bcrypt.hash('target-password-1', 4) });
    const bystander = await createUser(User);
    await seedContent(contentModels(), target);
    await seedContent(contentModels(), bystander);
    const targetApp = await createApp(App, target, { type: 'protected', allowedOrigins: [] });
    const bystanderApp = await createApp(App, bystander, { type: 'protected', allowedOrigins: [] });
    const { rawToken: targetKey } = await createToken(ApiToken, targetApp, 'sk');
    const { rawToken: bystanderKey } = await createToken(ApiToken, bystanderApp, 'sk');
    const login = await request(app).post('/api/auth/login').send({ email: target.email, password: 'target-password-1' }).expect(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${targetKey}`)).status).toBe(200);

    const suspended = await request(app).post(`/api/admin/users/${target._id}/suspend`).set('Authorization', auth).expect(200);
    expect(suspended.body.user).toMatchObject({ status: 'suspended' });
    expect((await User.findById(target._id)).status).toBe('suspended');
    const blocked = await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    expect(['account_inactive', 'session_expired']).toContain(blocked.body.error);
    const refusedLogin = await request(app).post('/api/auth/login').send({ email: target.email, password: 'target-password-1' }).expect(401);
    expect(refusedLogin.body.error).toBe('account_suspended');
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${targetKey}`)).status).toBe(401);
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${bystanderKey}`)).status).toBe(200);
    await request(app).get('/api/auth/me').set('Authorization', loginAs(bystander)).expect(200);
    await request(app).post(`/api/admin/users/${target._id}/suspend`).set('Authorization', auth).expect(409);

    await request(app).post(`/api/admin/users/${target._id}/unsuspend`).set('Authorization', auth).expect(200);
    await request(app).post('/api/auth/login').send({ email: target.email, password: 'target-password-1' }).expect(200);
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${targetKey}`)).status).toBe(200);
  });

  it('never targets the caller or the last superadmin, and force delete runs the full cascade', async () => {
    const admin = await freshAdmin();
    const auth = loginAs(admin);
    const self = await request(app).post(`/api/admin/users/${admin._id}/suspend`).set('Authorization', auth).expect(400);
    expect(self.body.error).toBe('cannot_target_self');
    await request(app).delete(`/api/admin/users/${admin._id}`).set('Authorization', auth).expect(400);

    const otherAdmin = await freshAdmin();
    // Two superadmins exist, so either may be suspended; once one is gone the other is protected.
    await request(app).post(`/api/admin/users/${otherAdmin._id}/suspend`).set('Authorization', auth).expect(200);
    const last = await request(app).post(`/api/admin/users/${admin._id}/suspend`).set('Authorization', loginAs(await User.findById(otherAdmin._id))).expect(401);
    expect(last.body.error).toBe('account_inactive');
    await request(app).post(`/api/admin/users/${otherAdmin._id}/unsuspend`).set('Authorization', auth).expect(200);
    const refreshedOther = await User.findById(otherAdmin._id);
    await request(app).delete(`/api/admin/users/${otherAdmin._id}`).set('Authorization', auth).expect(200);
    expect(await User.exists({ _id: refreshedOther._id })).toBeFalsy();
    const protectedAdmin = await request(app).delete(`/api/admin/users/${admin._id}`).set('Authorization', loginAs(await User.findById(admin._id))).expect(400);
    expect(['cannot_target_self', 'last_superadmin']).toContain(protectedAdmin.body.error);

    const tenant = await createUser(User);
    await seedContent(contentModels(), tenant);
    const tenantApp = await createApp(App, tenant);
    await createToken(ApiToken, tenantApp, 'pk');
    await request(app).delete(`/api/admin/users/${tenant._id}`).set('Authorization', auth).expect(200, { success: true, deleted: true });
    expect(await User.exists({ _id: tenant._id })).toBeFalsy();
    expect(await App.countDocuments({ owner: tenant._id })).toBe(0);
    expect(await ApiToken.countDocuments({ owner: tenant._id })).toBe(0);
    await request(app).delete(`/api/admin/users/${tenant._id}`).set('Authorization', auth).expect(404);
  });

  it('requires a recent password re-check for destructive actions', async () => {
    const admin = await createUser(User, { role: 'superadmin', passwordHash: await bcrypt.hash('admin-password-ok', 4) });
    const auth = loginAs(admin);
    const tenant = await createUser(User);
    const stale = await request(app).post(`/api/admin/users/${tenant._id}/suspend`).set('Authorization', auth).expect(403);
    expect(stale.body.error).toBe('reauth_required');
    await request(app).post('/api/admin/reauth').set('Authorization', auth).send({ password: 'wrong' }).expect(401);
    await request(app).post('/api/admin/reauth').set('Authorization', auth).send({ password: 'admin-password-ok' }).expect(200);
    await request(app).post(`/api/admin/users/${tenant._id}/suspend`).set('Authorization', auth).expect(200);
    await User.updateOne({ _id: admin._id }, { $set: { adminReauthAt: new Date(Date.now() - 11 * 60_000) } });
    await request(app).post(`/api/admin/users/${tenant._id}/unsuspend`).set('Authorization', auth).expect(403);
  });

  it('shows the mail budget', async () => {
    const admin = await freshAdmin();
    await Setting.create({ key: `mail:${new Date().toISOString().slice(0, 10)}`, value: 7 });
    const budget = await request(app).get('/api/admin/mail-budget').set('Authorization', loginAs(admin)).expect(200);
    expect(budget.body).toMatchObject({ success: true, sent: 7, cap: 500, reserve: 50 });
    expect(budget.body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
