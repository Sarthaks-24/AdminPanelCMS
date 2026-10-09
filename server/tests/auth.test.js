const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Invite = require('../models/Invite');
const EmailToken = require('../models/EmailToken');
const { digest, inviteDigest, issueEmailToken } = require('../lib/emailTokens');
const mailer = require('../lib/mailer');
const { signupRateLimiters } = require('../middleware/authRateLimiters');

describe('session compatibility', () => {
  it('uses the configured local client origin only and does not trust forwarded IPs by default', async () => {
    expect(app.get('trust proxy')).toBe(0);
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const rejected = await request(app).get('/api/health').set('Origin', 'https://attacker.test').expect(200);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requires a session for dashboard writes', async () => {
    const response = await request(app).post('/api/projects').send({ title: 'Unauthenticated' });
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('auth_required');
  });

  it('returns a distinct forbidden error for an authenticated but unverified writer', async () => {
    const user = await User.create({ email: 'unverified@test.com', passwordHash: 'test', status: 'active', tokenVersion: 0 });
    const response = await request(app).post('/api/projects').set('Authorization', `Bearer ${jwt.sign({ sub: user._id.toString(), tv: 0 }, process.env.JWT_SECRET)}`).send({ title: 'Draft' });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('email_unverified');
  });

  it('signs {sub,tv} claims and keeps the dashboard admin response shape', async () => {
    const passwordHash = await bcrypt.hash('correct horse battery', 4);
    const user = await User.create({ email: 'owner@test.com', passwordHash, tokenVersion: 3, emailVerifiedAt: new Date() });
    const login = await request(app).post('/api/auth/login').send({ email: 'OWNER@test.com', password: 'correct horse battery' });
    expect(login.status).toBe(200);
    const claims = jwt.verify(login.body.token, process.env.JWT_SECRET);
    expect(claims).toMatchObject({ sub: user._id.toString(), tv: 3 });
    expect(login.body.admin).toEqual(login.body.user);

    const verify = await request(app).get('/api/auth/verify').set('Authorization', `Bearer ${login.body.token}`);
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ success: true, valid: true, admin: { id: user._id.toString(), email: user.email } });
  });

  it('invalidates a session after its token version changes', async () => {
    const passwordHash = await bcrypt.hash('another secure password', 4);
    const user = await User.create({ email: 'revoked@test.com', passwordHash, tokenVersion: 0 });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'another secure password' });
    user.tokenVersion += 1;
    await user.save();
    const response = await request(app).get('/api/auth/verify').set('Authorization', `Bearer ${login.body.token}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('session_expired');
  });

  it('rate limits repeated failed logins by source IP and normalized email', async () => {
    const attempts = [];
    for (let index = 0; index < 10; index += 1) {
      attempts.push(await request(app).post('/api/auth/login').send({ email: 'Unknown@Example.test', password: 'incorrect password' }));
    }
    expect(attempts.every((response) => response.status === 401)).toBe(true);

    const limited = await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password: 'incorrect password' });
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ success: false, error: 'rate_limited' });
    expect(limited.headers['ratelimit-limit']).toBe('10');
  });
});

describe('account registration and email flows', () => {
  let messages;
  beforeEach(async () => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
    process.env.SIGNUP_MODE = 'invite';
    await Promise.all(signupRateLimiters.map((limiter) => limiter.resetKey('127.0.0.1')));
  });
  afterEach(() => { mailer.setMailTransport(null); delete process.env.SIGNUP_MODE; });

  async function createInvite(code = `invite-${Date.now()}-${Math.random()}`) {
    await Invite.create({ codeHash: digest(code), expiresAt: new Date(Date.now() + 60_000) });
    return code;
  }

  it('creates an invite account with consent and verifies its single-use email token', async () => {
    const inviteCode = '012345';
    await Invite.create({ codeHash: inviteDigest(inviteCode), expiresAt: new Date(Date.now() + 60_000) });
    const response = await request(app).post('/api/auth/signup').send({
      email: ' New.User@Test.com ', password: 'a-long-secure-password', inviteCode,
      acceptedTerms: true, acceptedPrivacy: true,
    }).expect(200);
    expect(response.body).toEqual({ success: true, message: 'Check your email to complete registration' });
    const user = await User.findOne({ email: 'new.user@test.com' });
    expect(user.acceptedTermsAt).toBeInstanceOf(Date);
    expect(user.emailVerifiedAt).toBeNull();
    expect(await Invite.exists({ codeHash: inviteDigest(inviteCode), usedBy: user._id })).toBeTruthy();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ template: 'verification', to: user.email });
    const token = new URL(messages[0].url).searchParams.get('token');
    expect(await EmailToken.exists({ hash: digest(token), type: 'verify' })).toBeTruthy();
    await request(app).post('/api/auth/verify-email').send({ token }).expect(200, { success: true, verified: true });
    await request(app).post('/api/auth/verify-email').send({ token }).expect(400);
    expect((await User.findById(user._id)).emailVerifiedAt).toBeInstanceOf(Date);
  });

  it('allows an invite code to be used up to its configured signup limit', async () => {
    const inviteCode = '654321';
    const invite = await Invite.create({ codeHash: inviteDigest(inviteCode), maxUses: 2, expiresAt: new Date(Date.now() + 60_000) });
    const signup = (email) => request(app).post('/api/auth/signup').send({
      email, password: 'a-long-secure-password', inviteCode, acceptedTerms: true, acceptedPrivacy: true,
    });
    await signup('multi-one@test.com').expect(200);
    await signup('multi-two@test.com').expect(200);
    await signup('multi-three@test.com').expect(400, { success: false, error: 'invite_invalid' });
    const updated = await Invite.findById(invite._id).lean();
    expect(updated.usedCount).toBe(2);
    expect(updated.maxUses).toBe(2);
  });

  it('supports explicitly configured open signup without consuming an invite', async () => {
    process.env.SIGNUP_MODE = 'open';
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: true, signupMode: 'open' });
    await request(app).post('/api/auth/signup').send({
      email: 'open-signup@test.com', password: 'a-long-secure-password', acceptedTerms: true, acceptedPrivacy: true,
    }).expect(200, { success: true, message: 'Check your email to complete registration' });
    expect(await User.exists({ email: 'open-signup@test.com' })).toBeTruthy();
    expect(await Invite.countDocuments()).toBe(0);
  });

  it('requires both consent flags and does not consume an invite on rejection', async () => {
    const inviteCode = await createInvite();
    await request(app).post('/api/auth/signup').send({ email: 'consent@test.com', password: 'a-long-secure-password', inviteCode, acceptedTerms: true }).expect(400, { success: false, error: 'consent_required' });
    expect(await User.exists({ email: 'consent@test.com' })).toBeFalsy();
    expect(await Invite.exists({ codeHash: digest(inviteCode), usedBy: null })).toBeTruthy();
  });

  it('returns the same signup response for an existing email and sends a reset notice', async () => {
    const inviteCode = await createInvite();
    const user = await User.create({ email: 'existing@test.com', passwordHash: await bcrypt.hash('old-secure-password', 4) });
    const response = await request(app).post('/api/auth/signup').send({ email: user.email, password: 'another-secure-password', inviteCode, acceptedTerms: true, acceptedPrivacy: true }).expect(200);
    expect(response.body).toEqual({ success: true, message: 'Check your email to complete registration' });
    expect(messages[0]).toMatchObject({ template: 'account-exists', to: user.email });
    expect(await User.countDocuments({ email: user.email })).toBe(1);
  });

  it('uses a generic forgot-password result and lets a reset token invalidate old sessions', async () => {
    const passwordHash = await bcrypt.hash('old-secure-password', 4);
    const user = await User.create({ email: 'reset@test.com', passwordHash, tokenVersion: 2 });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@test.com' }).expect(200);
    const known = await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    expect(known.body).toEqual(unknown.body);
    const token = new URL(messages[0].url).searchParams.get('token');
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'brand-new-secure-password' }).expect(200);
    expect((await User.findById(user._id)).tokenVersion).toBe(3);
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'reused-token-password' }).expect(400);
  });

  it('fails closed for an invalid signup mode', async () => {
    process.env.SIGNUP_MODE = 'anything-else';
    await request(app).post('/api/auth/signup').send({}).expect(503, { success: false, error: 'signup_unavailable' });
  });
});
