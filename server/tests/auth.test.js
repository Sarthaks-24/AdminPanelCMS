const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Invite = require('../models/Invite');
const EmailToken = require('../models/EmailToken');
const { digest, inviteDigest, issueEmailToken } = require('../lib/emailTokens');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../lib/legal');
const mailer = require('../lib/mailer');
const { resetRecipientCooldowns } = require('../lib/mailBudget');
const { resetAuthRateLimiters } = require('../middleware/authRateLimiters');

const tokenFrom = (message) => new URL(message.url).searchParams.get('token');

describe('session compatibility', () => {
  it('uses the configured local client origin only and does not trust forwarded IPs by default', async () => {
    expect(app.get('trust proxy')).toBe(0);
    const allowed = await request(app).get('/api/auth/config').set('Origin', 'http://localhost:5173').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const rejected = await request(app).get('/api/auth/config').set('Origin', 'https://attacker.test').expect(200);
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
    expect(login.body.token).toBeUndefined();
    const cookie = login.headers['set-cookie'][0];
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const sessionToken = cookie.split(';')[0].slice('session='.length);
    const claims = jwt.verify(sessionToken, process.env.JWT_SECRET);
    expect(claims).toMatchObject({ sub: user._id.toString(), tv: 3 });
    expect(login.body.admin).toEqual(login.body.user);

    const verify = await request(app).get('/api/auth/verify').set('Cookie', `session=${sessionToken}`);
    expect(verify.status).toBe(200);
    expect(verify.body).toMatchObject({ success: true, valid: true, admin: { id: user._id.toString(), email: user.email } });
  });

  it('marks a SameSite=None session cookie Partitioned and expires the unpartitioned copy', async () => {
    const previous = process.env.SESSION_COOKIE_SAMESITE;
    process.env.SESSION_COOKIE_SAMESITE = 'none';
    try {
      const passwordHash = await bcrypt.hash('correct horse battery', 4);
      await User.create({ email: 'split@test.com', passwordHash, tokenVersion: 0, emailVerifiedAt: new Date() });
      const login = await request(app).post('/api/auth/login').send({ email: 'split@test.com', password: 'correct horse battery' });
      expect(login.status).toBe(200);
      const [session, legacy] = login.headers['set-cookie'];
      expect(session).toMatch(/^session=[^;]+;.*SameSite=None; Secure; Partitioned/);
      expect(legacy).toMatch(/^session=;.*Max-Age=0/);
      expect(legacy).not.toMatch(/Partitioned/);
    } finally {
      if (previous === undefined) delete process.env.SESSION_COOKIE_SAMESITE;
      else process.env.SESSION_COOKIE_SAMESITE = previous;
    }
  });

  it('only accepts HS256 session tokens', async () => {
    const user = await User.create({ email: 'alg@test.com', passwordHash: 'x', emailVerifiedAt: new Date(), tokenVersion: 0 });
    const forged = jwt.sign({ sub: user._id.toString(), tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS512' });
    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('invalid_session');
  });

  it('invalidates a session after its token version changes', async () => {
    const passwordHash = await bcrypt.hash('another secure password', 4);
    const user = await User.create({ email: 'revoked@test.com', passwordHash, tokenVersion: 0, emailVerifiedAt: new Date() });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'another secure password' });
    user.tokenVersion += 1;
    await user.save();
    const sessionToken = login.headers['set-cookie'][0].split(';')[0].slice('session='.length);
    const response = await request(app).get('/api/auth/verify').set('Cookie', `session=${sessionToken}`);
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('session_expired');
  });

  it('refuses login for accounts that have not verified their email, with a generic message', async () => {
    const passwordHash = await bcrypt.hash('legacy unverified password', 4);
    await User.create({ email: 'legacy@test.com', passwordHash, emailVerifiedAt: null });
    await User.create({ email: 'pending@test.com', passwordHash: null, emailVerifiedAt: null });
    const legacy = await request(app).post('/api/auth/login').send({ email: 'legacy@test.com', password: 'legacy unverified password' });
    expect(legacy.status).toBe(401);
    expect(legacy.body).toEqual({ success: false, error: 'credentials_invalid', message: 'Invalid credentials or unverified email' });
    const pending = await request(app).post('/api/auth/login').send({ email: 'pending@test.com', password: 'anything at all here' });
    expect(pending.status).toBe(401);
    expect(pending.body).toEqual(legacy.body);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'anything at all here' });
    expect(unknown.body).toEqual(legacy.body);
  });

  it('rate limits repeated failed logins per email and source IP', async () => {
    const attempts = [];
    for (let index = 0; index < 10; index += 1) {
      attempts.push(await request(app).post('/api/auth/login').send({ email: 'Unknown@Example.test', password: 'incorrect password' }));
    }
    expect(attempts.every((response) => response.status === 401)).toBe(true);

    const limited = await request(app).post('/api/auth/login').send({ email: 'unknown@example.test', password: 'incorrect password' });
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ success: false, error: 'rate_limited' });
    expect(limited.headers['ratelimit-limit']).toBe('10');
    // A different address from the same source is not locked.
    const other = await request(app).post('/api/auth/login').send({ email: 'someone-else@example.test', password: 'incorrect password' });
    expect(other.status).toBe(401);
  });

  it('keys the login limiter on email plus IP so one network cannot lock a victim out everywhere', async () => {
    const passwordHash = await bcrypt.hash('the real password', 4);
    const victim = await User.create({ email: 'victim@test.com', passwordHash, emailVerifiedAt: new Date() });
    // Vitest runs with TRUST_PROXY_HOPS=0, so X-Forwarded-For is ignored; trust one hop for this test only.
    app.set('trust proxy', 1);
    try {
      for (let index = 0; index < 10; index += 1) {
        await request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.10').send({ email: victim.email, password: 'wrong guess' }).expect(401);
      }
      await request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.10').send({ email: victim.email, password: 'the real password' }).expect(429);
      await request(app).post('/api/auth/login').set('X-Forwarded-For', '198.51.100.7').send({ email: victim.email, password: 'the real password' }).expect(200);
    } finally {
      app.set('trust proxy', 0);
    }
  });
});

describe('email-first registration', () => {
  let messages;
  beforeEach(async () => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
    process.env.SIGNUP_MODE = 'invite';
    resetRecipientCooldowns();
    await resetAuthRateLimiters();
  });
  afterEach(() => { mailer.setMailTransport(null); delete process.env.SIGNUP_MODE; });

  async function createInvite(code = `invite-${Date.now()}-${Math.random()}`, extra = {}) {
    await Invite.create({ codeHash: digest(code), expiresAt: new Date(Date.now() + 60_000), ...extra });
    return code;
  }
  const signup = (body) => request(app).post('/api/auth/signup').send({ acceptedTerms: true, acceptedPrivacy: true, ...body });

  it('takes no password at signup, stores the consent versions, and sets the password on the verify page', async () => {
    const inviteCode = 'ABCDEFGHJKLM';
    await Invite.create({ codeHash: inviteDigest(inviteCode), expiresAt: new Date(Date.now() + 60_000) });
    const response = await signup({ email: ' New.User@Test.com ', inviteCode: 'abcd-efgh-jklm', password: 'ignored-at-signup' }).expect(200);
    expect(response.body).toEqual({ success: true, message: 'Check your email to complete registration' });
    const user = await User.findOne({ email: 'new.user@test.com' });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.acceptedTermsAt).toBeInstanceOf(Date);
    expect(user.acceptedPrivacyAt).toBeInstanceOf(Date);
    expect(user).toMatchObject({ acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyVersion: PRIVACY_VERSION });
    expect(await Invite.exists({ codeHash: inviteDigest(inviteCode), usedBy: user._id })).toBeTruthy();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ template: 'verification', to: user.email });
    const token = tokenFrom(messages[0]);
    expect(await EmailToken.exists({ hash: digest(token), type: 'verify' })).toBeTruthy();

    await request(app).post('/api/auth/verify-email').send({ token }).expect(400, { success: false, error: 'password_invalid', message: 'Choose a password of at least 10 characters' });
    await request(app).post('/api/auth/verify-email').send({ token, password: 'short' }).expect(400);
    // A rejected password must not burn the link.
    expect(await EmailToken.exists({ hash: digest(token), usedAt: null })).toBeTruthy();

    const verified = await request(app).post('/api/auth/verify-email').send({ token, password: 'chosen-by-the-inbox-owner' }).expect(200);
    expect(verified.body).toMatchObject({ success: true, verified: true, user: { id: user._id.toString(), email: user.email, emailVerified: true, role: 'user' } });
    expect(verified.headers['set-cookie'][0]).toMatch(/^session=ey/);
    await request(app).post('/api/auth/verify-email').send({ token, password: 'chosen-by-the-inbox-owner' }).expect(400);

    const after = await User.findById(user._id);
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
    expect(after.tokenVersion).toBe(1);
    expect(await bcrypt.compare('chosen-by-the-inbox-owner', after.passwordHash)).toBe(true);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'chosen-by-the-inbox-owner' }).expect(200);
    const me = await request(app).get('/api/auth/me').set('Cookie', verified.headers['set-cookie'][0].split(';')[0]).expect(200);
    expect(me.body.user).toMatchObject({ emailVerified: true, acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyVersion: PRIVACY_VERSION });
  });

  it('defeats the squatter: whoever proves the inbox chooses the password', async () => {
    process.env.SIGNUP_MODE = 'open';
    // Attacker registers the victim's address and guesses a password of their own.
    await signup({ email: 'victim@test.com' }).expect(200);
    await request(app).post('/api/auth/login').send({ email: 'victim@test.com', password: 'attacker-chosen-password' }).expect(401);
    // The victim opens the link that landed in their inbox and sets their own password.
    const token = tokenFrom(messages[0]);
    await request(app).post('/api/auth/verify-email').send({ token, password: 'victim-chosen-password' }).expect(200);
    const attacker = await request(app).post('/api/auth/login').send({ email: 'victim@test.com', password: 'attacker-chosen-password' });
    expect(attacker.status).toBe(401);
    expect(attacker.body.message).toBe('Invalid credentials or unverified email');
    await request(app).post('/api/auth/login').send({ email: 'victim@test.com', password: 'victim-chosen-password' }).expect(200);
    // Re-registering the address afterwards cannot reset anything: only the account-exists notice goes out, and only to the inbox.
    await signup({ email: 'victim@test.com' }).expect(200);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ template: 'account-exists', to: 'victim@test.com' });
    await request(app).post('/api/auth/login').send({ email: 'victim@test.com', password: 'victim-chosen-password' }).expect(200);
  });

  it('allows an invite code to be used up to its configured signup limit', async () => {
    const inviteCode = 'ZZZZZZZZZZZZ';
    const invite = await Invite.create({ codeHash: inviteDigest(inviteCode), maxUses: 2, expiresAt: new Date(Date.now() + 60_000) });
    await signup({ email: 'multi-one@test.com', inviteCode }).expect(200);
    await signup({ email: 'multi-two@test.com', inviteCode }).expect(200);
    const third = await signup({ email: 'multi-three@test.com', inviteCode }).expect(400);
    expect(third.body).toMatchObject({ success: false, error: 'invite_invalid' });
    const updated = await Invite.findById(invite._id).lean();
    expect(updated.usedCount).toBe(2);
    expect(updated.maxUses).toBe(2);
  });

  it('supports explicitly configured open signup without consuming an invite', async () => {
    process.env.SIGNUP_MODE = 'open';
    const config = await request(app).get('/api/auth/config').expect(200);
    expect(config.body).toEqual({ success: true, signupEnabled: true, signupMode: 'open', publicApiBase: null, turnstileSiteKey: null, mailDelivery: 'enabled' });
    await signup({ email: 'open-signup@test.com' }).expect(200, { success: true, message: 'Check your email to complete registration' });
    expect(await User.exists({ email: 'open-signup@test.com' })).toBeTruthy();
    expect(await Invite.countDocuments()).toBe(0);
  });

  it('reports the public API base from PUBLIC_API_URL without a trailing slash', async () => {
    process.env.PUBLIC_API_URL = 'https://api.example.com/';
    try {
      const config = await request(app).get('/api/auth/config').expect(200);
      expect(config.body.publicApiBase).toBe('https://api.example.com');
    } finally { delete process.env.PUBLIC_API_URL; }
  });

  it('requires both consent flags and does not consume an invite on rejection', async () => {
    const inviteCode = await createInvite();
    const response = await signup({ email: 'consent@test.com', inviteCode, acceptedPrivacy: false }).expect(400);
    expect(response.body).toMatchObject({ success: false, error: 'consent_required' });
    expect(await User.exists({ email: 'consent@test.com' })).toBeFalsy();
    expect(await Invite.exists({ codeHash: digest(inviteCode), usedBy: null })).toBeTruthy();
  });

  it('sends the account-exists notice to a verified address at most once a day and never changes the account', async () => {
    const inviteCode = await createInvite(undefined, { maxUses: 5 });
    const user = await User.create({ email: 'existing@test.com', passwordHash: await bcrypt.hash('old-secure-password', 4), emailVerifiedAt: new Date() });
    const first = await signup({ email: user.email, inviteCode }).expect(200);
    expect(first.body).toEqual({ success: true, message: 'Check your email to complete registration' });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ template: 'account-exists', to: user.email });
    await signup({ email: user.email, inviteCode }).expect(200);
    expect(messages).toHaveLength(1);
    expect(await User.countDocuments({ email: user.email })).toBe(1);
    expect((await User.findById(user._id)).accountExistsNoticeAt).toBeInstanceOf(Date);
    expect(await Invite.exists({ codeHash: digest(inviteCode), usedCount: 0 })).toBeTruthy();
  });

  it('re-sends the verification link to an unverified account and lets the public resend endpoint do the same', async () => {
    process.env.SIGNUP_MODE = 'open';
    await signup({ email: 'pending@test.com' }).expect(200);
    resetRecipientCooldowns();
    await signup({ email: 'pending@test.com' }).expect(200);
    expect(messages.map((message) => message.template)).toEqual(['verification', 'verification']);
    expect(await User.countDocuments({ email: 'pending@test.com' })).toBe(1);
    resetRecipientCooldowns();
    await request(app).post('/api/auth/resend-verification').send({ email: 'pending@test.com' }).expect(200);
    expect(messages).toHaveLength(3);
    // Unknown and verified addresses get the same answer and no mail.
    const unknown = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@test.com' }).expect(200);
    expect(unknown.body.success).toBe(true);
    expect(messages).toHaveLength(3);
    // The newest link still works even though older ones were issued (up to three stay live).
    const token = tokenFrom(messages[2]);
    await request(app).post('/api/auth/verify-email').send({ token, password: 'a-long-enough-password' }).expect(200);
    await request(app).post('/api/auth/resend-verification').send({ email: 'pending@test.com' }).expect(200);
    expect(messages).toHaveLength(3);
  });

  it('lets a deleted address register again', async () => {
    process.env.SIGNUP_MODE = 'open';
    const ghost = await User.create({ email: 'ghost@test.com', passwordHash: 'x', emailVerifiedAt: new Date(), status: 'deleted' });
    await signup({ email: 'ghost@test.com' }).expect(200);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ template: 'verification', to: 'ghost@test.com' });
    const fresh = await User.findOne({ email: 'ghost@test.com' });
    expect(String(fresh._id)).not.toBe(String(ghost._id));
    expect(fresh.status).toBe('active');
  });

  it('fails closed for an invalid signup mode', async () => {
    process.env.SIGNUP_MODE = 'anything-else';
    const response = await signup({}).expect(503);
    expect(response.body).toMatchObject({ success: false, error: 'signup_unavailable' });
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: false, signupMode: 'closed', publicApiBase: null, turnstileSiteKey: null, mailDelivery: 'enabled' });
  });

  it('defaults to closed when SIGNUP_MODE is unset', async () => {
    delete process.env.SIGNUP_MODE;
    await request(app).get('/api/auth/config').expect(200, { success: true, signupEnabled: false, signupMode: 'closed', publicApiBase: null, turnstileSiteKey: null, mailDelivery: 'enabled' });
  });
});

describe('password recovery', () => {
  let messages;
  beforeEach(async () => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
    resetRecipientCooldowns();
    await resetAuthRateLimiters();
  });
  afterEach(() => mailer.setMailTransport(null));

  it('uses a generic forgot-password result and revokes sessions on reset', async () => {
    const passwordHash = await bcrypt.hash('old-secure-password', 4);
    const user = await User.create({ email: 'reset@test.com', passwordHash, tokenVersion: 2, emailVerifiedAt: new Date() });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@test.com' }).expect(200);
    const known = await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    expect(known.body).toEqual(unknown.body);
    expect(messages).toHaveLength(1);
    const token = tokenFrom(messages[0]);
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'brand-new-secure-password' }).expect(200);
    const after = await User.findById(user._id);
    expect(after.tokenVersion).toBe(3);
    expect(after.emailVerifiedAt).toBeInstanceOf(Date);
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'reused-token-password' }).expect(400);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'brand-new-secure-password' }).expect(200);
  });

  it('keeps earlier reset links alive when a new one is requested, and revokes the rest once one is used', async () => {
    const user = await User.create({ email: 'links@test.com', passwordHash: await bcrypt.hash('old-secure-password', 4), emailVerifiedAt: new Date() });
    const tokens = [];
    for (let index = 0; index < 4; index += 1) tokens.push(await issueEmailToken(user._id, 'reset'));
    expect(await EmailToken.countDocuments({ user: user._id, type: 'reset', usedAt: null })).toBe(3);
    // The oldest was retired; the second-oldest still works.
    await request(app).post('/api/auth/reset-password').send({ token: tokens[0], newPassword: 'should-not-work-anymore' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: tokens[1], newPassword: 'second-link-password-ok' }).expect(200);
    await request(app).post('/api/auth/reset-password').send({ token: tokens[3], newPassword: 'sibling-link-now-dead' }).expect(400);
    expect(await EmailToken.countDocuments({ user: user._id, type: 'reset', usedAt: null })).toBe(0);
  });

  it('applies a per-recipient cooldown to reset mail without changing the response', async () => {
    const user = await User.create({ email: 'cooldown@test.com', passwordHash: 'x', emailVerifiedAt: new Date() });
    const first = await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    const second = await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    expect(second.body).toEqual(first.body);
    expect(messages).toHaveLength(1);
  });
});

describe('cookie sessions', () => {
  const sessionFor = async (email, password) => {
    const login = await request(app).post('/api/auth/login').send({ email, password });
    return login.headers['set-cookie'][0].split(';')[0];
  };

  it('requires the CSRF header on cookie-authenticated writes but not reads', async () => {
    const passwordHash = await bcrypt.hash('cookie session password', 4);
    const user = await User.create({ email: 'cookie@test.com', passwordHash, emailVerifiedAt: new Date() });
    const cookie = await sessionFor(user.email, 'cookie session password');
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(200);
    const blocked = await request(app).post('/api/projects').set('Cookie', cookie).send({ title: 'x' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('csrf_rejected');
    const allowed = await request(app).post('/api/projects').set('Cookie', cookie).set('X-Requested-With', 'XMLHttpRequest').send({ title: 'x' });
    expect(allowed.status).not.toBe(403);
  });

  it('clears the cookie on logout and rotates it on password change', async () => {
    const passwordHash = await bcrypt.hash('cookie session password', 4);
    const user = await User.create({ email: 'rotate@test.com', passwordHash, emailVerifiedAt: new Date() });
    const cookie = await sessionFor(user.email, 'cookie session password');
    const changed = await request(app).post('/api/auth/change-password').set('Cookie', cookie).set('X-Requested-With', 'XMLHttpRequest')
      .send({ currentPassword: 'cookie session password', newPassword: 'a different long password' });
    expect(changed.status).toBe(200);
    expect(changed.body.token).toBeUndefined();
    expect(changed.headers['set-cookie'][0]).toMatch(/^session=ey/);
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    const fresh = await sessionFor(user.email, 'a different long password');
    await request(app).post('/api/auth/logout').set('Cookie', fresh).expect(403);
    const out = await request(app).post('/api/auth/logout').set('Cookie', fresh).set('X-Requested-With', 'XMLHttpRequest').expect(200);
    expect(out.headers['set-cookie'][0]).toMatch(/Max-Age=0/);
    await request(app).get('/api/auth/me').set('Cookie', fresh).expect(401); // the copied cookie is revoked too
  });
});

describe('invite guessing protection', () => {
  const inviteGuard = require('../lib/inviteGuard');
  beforeEach(async () => {
    inviteGuard.reset();
    process.env.SIGNUP_MODE = 'invite';
    mailer.setMailTransport({ send: async () => {} });
    await resetAuthRateLimiters();
  });
  afterEach(() => { inviteGuard.reset(); mailer.setMailTransport(null); delete process.env.SIGNUP_MODE; delete process.env.INVITE_FAILURE_LIMIT; delete process.env.INVITE_IP_FAILURE_LIMIT; app.set('trust proxy', 0); });

  const body = (email, inviteCode) => ({ email, inviteCode, acceptedTerms: true, acceptedPrivacy: true });

  it('accepts a 12-character code pasted with spaces, dashes or lower case, and no longer accepts six digits', async () => {
    await Invite.create({ codeHash: inviteDigest('ABCDEFGHJKLM'), expiresAt: new Date(Date.now() + 86400000), maxUses: 1 });
    await request(app).post('/api/auth/signup').send(body('spaces@test.com', 'abcd-efgh jklm')).expect(200);
    expect(await User.countDocuments({ email: 'spaces@test.com' })).toBe(1);
    await Invite.create({ codeHash: inviteDigest('123456'), expiresAt: new Date(Date.now() + 86400000), maxUses: 1 });
    const legacy = await request(app).post('/api/auth/signup').send(body('digits@test.com', '123 456')).expect(400);
    expect(legacy.body.error).toBe('invite_invalid');
  });

  it('rejects an invalid code before touching accounts or mail', async () => {
    const sent = [];
    mailer.setMailTransport({ send: async (message) => { sent.push(message); } });
    await User.create({ email: 'probe@test.com', passwordHash: 'x', emailVerifiedAt: new Date() });
    const response = await request(app).post('/api/auth/signup').send(body('probe@test.com', 'WRONGWRONGWR')).expect(400);
    expect(response.body.error).toBe('invite_invalid');
    expect(sent).toHaveLength(0);
    expect((await User.findOne({ email: 'probe@test.com' })).accountExistsNoticeAt).toBeNull();
  });

  it('locks a guessing IP after ten wrong codes while another IP with a valid code still registers', async () => {
    // TRUST_PROXY_HOPS=0 in vitest makes every request 127.0.0.1; trust one hop so X-Forwarded-For distinguishes the sources.
    app.set('trust proxy', 1);
    const from = (ip) => request(app).post('/api/auth/signup').set('X-Forwarded-For', ip);
    for (let i = 0; i < 100; i += 1) {
      // The signup limiter (5/h per IP) sits in front of the invite guard; clear it so the guard itself is what trips.
      await resetAuthRateLimiters();
      const response = await from('203.0.113.50').send(body(`guess${i}@test.com`, 'WRONGWRONGWR'));
      expect(response.status).toBe(i < 10 ? 400 : 429);
      expect(response.body.error).toBe(i < 10 ? 'invite_invalid' : 'invite_locked');
    }
    await Invite.create({ codeHash: inviteDigest('ABCDEFGHJKLM'), expiresAt: new Date(Date.now() + 86400000), maxUses: 1 });
    const other = await from('198.51.100.9').send(body('late@test.com', 'ABCDEFGHJKLM'));
    expect(other.status).toBe(200);
    expect(await User.countDocuments({ email: 'late@test.com' })).toBe(1);
  });

  it('groups IPv6 guessers by /48, so rotating addresses inside one allocation does not reset the lock', async () => {
    app.set('trust proxy', 1);
    const from = (ip) => request(app).post('/api/auth/signup').set('X-Forwarded-For', ip);
    for (let i = 0; i < 10; i += 1) {
      await resetAuthRateLimiters();
      // Each guess comes from a different /64 (and a different /56) inside 2001:db8:abcd::/48.
      await from(`2001:db8:abcd:${(i * 256).toString(16)}::${i + 1}`).send(body(`v6-${i}@test.com`, 'WRONGWRONGWR')).expect(400);
    }
    await resetAuthRateLimiters();
    const locked = await from('2001:db8:abcd:ff00::99').send(body('v6-late@test.com', 'WRONGWRONGWR'));
    expect(locked.status).toBe(429);
    expect(locked.body.error).toBe('invite_locked');
    await resetAuthRateLimiters();
    await from('2001:db8:abce::1').send(body('v6-other@test.com', 'WRONGWRONGWR')).expect(400);
  });

  it('never locks invites for everyone: distributed failures raise an alert instead', async () => {
    const logger = require('../lib/logger');
    const warn = vi.spyOn(logger, 'warn');
    app.set('trust proxy', 1);
    try {
      // Wrong codes from many sources, past INVITE_FAILURE_LIMIT: the old global lock would trip here.
      process.env.INVITE_FAILURE_LIMIT = '3';
      for (let i = 0; i < 5; i += 1) {
        await resetAuthRateLimiters();
        await request(app).post('/api/auth/signup').set('X-Forwarded-For', `198.18.0.${i + 1}`).send(body(`spray${i}@test.com`, 'WRONGWRONGWR')).expect(400);
      }
      expect(warn.mock.calls.some(([fields]) => fields?.alert === 'invite_failures_high')).toBe(true);
      await Invite.create({ codeHash: inviteDigest('ABCDEFGHJKMN'), expiresAt: new Date(Date.now() + 86400000), maxUses: 1 });
      await resetAuthRateLimiters();
      await request(app).post('/api/auth/signup').set('X-Forwarded-For', '192.0.2.200').send(body('late@test.com', 'ABCDEFGHJKMN')).expect(200);
    } finally { warn.mockRestore(); }
  });
});
