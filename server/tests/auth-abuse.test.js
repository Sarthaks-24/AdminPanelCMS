const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Project = require('../models/Project');
const Setting = require('../models/Setting');
const EmailToken = require('../models/EmailToken');
const mailer = require('../lib/mailer');
const logger = require('../lib/logger');
const bcryptGate = require('../lib/bcryptGate');
const storageGuard = require('../lib/storageGuard');
const { resetRecipientCooldowns } = require('../lib/mailBudget');
const { resetSignupDomainCounts } = require('../lib/signupDomainCap');
const { resetAlerts } = require('../lib/alerts');
const { notifyExpiringTokens } = require('../lib/tokenExpiryNotice');
const { resetAuthRateLimiters } = require('../middleware/authRateLimiters');
const { createUser, loginAs, createApp, createToken } = require('./helpers/factory');

const DAY_MS = 24 * 60 * 60 * 1000;
const today = () => `mail:${new Date().toISOString().slice(0, 10)}`;
const alerts = (spy, name) => spy.mock.calls.filter(([fields]) => fields?.alert === name);
const ENV_KEYS = ['SIGNUP_MODE', 'MAIL_DAILY_CAP', 'MAIL_RESET_RESERVE', 'SIGNUP_DOMAIN_DAILY_CAP', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_SITE_KEY', 'BCRYPT_MAX_CONCURRENT', 'MAX_ACCOUNTS', 'DB_STORAGE_CAP_BYTES', 'STORAGE_BLOCK_PERCENT'];

let messages;
let warn;
beforeEach(async () => {
  messages = [];
  mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
  resetRecipientCooldowns();
  resetSignupDomainCounts();
  resetAlerts();
  storageGuard.setStorageFull(false);
  await resetAuthRateLimiters();
  warn = vi.spyOn(logger, 'warn');
});
afterEach(() => {
  mailer.setMailTransport(null);
  for (const key of ENV_KEYS) delete process.env[key];
  storageGuard.setStorageFull(false);
  app.set('trust proxy', 0);
  warn.mockRestore();
  vi.restoreAllMocks();
});

const signupBody = (email) => ({ email, acceptedTerms: true, acceptedPrivacy: true });
const from = (ip) => ({ post: (path) => request(app).post(path).set('X-Forwarded-For', ip) });

describe('login flood protection (FX-18)', () => {
  it('caps failed logins per source IP across many addresses', async () => {
    for (let i = 0; i < 30; i += 1) {
      await request(app).post('/api/auth/login').send({ email: `rotating${i}@test.com`, password: 'wrong password' }).expect(401);
    }
    const limited = await request(app).post('/api/auth/login').send({ email: 'rotating-new@test.com', password: 'wrong password' });
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('rate_limited');
    expect(alerts(warn, 'rate_limited_429')).toHaveLength(0); // one 429 is below the burst threshold
  });

  it('soft-caps failed logins for one address across many sources', async () => {
    app.set('trust proxy', 1);
    for (let i = 0; i < 50; i += 1) {
      await from(`203.0.113.${i + 1}`).post('/api/auth/login').send({ email: 'sprayed@test.com', password: 'wrong password' }).expect(401);
    }
    await from('198.51.100.1').post('/api/auth/login').send({ email: 'sprayed@test.com', password: 'wrong password' }).expect(429);
    await from('198.51.100.1').post('/api/auth/login').send({ email: 'someone-else@test.com', password: 'wrong password' }).expect(401);
  });

  it('answers 503 busy with Retry-After when every bcrypt slot is taken, and raises the busy alert', async () => {
    const passwordHash = await bcrypt.hash('the real password', 4);
    await User.create({ email: 'busy@test.com', passwordHash, emailVerifiedAt: new Date() });
    process.env.BCRYPT_MAX_CONCURRENT = '1';
    const release = bcryptGate.acquire();
    try {
      const busy = await request(app).post('/api/auth/login').send({ email: 'busy@test.com', password: 'the real password' });
      expect(busy.status).toBe(503);
      expect(busy.body).toMatchObject({ success: false, error: 'busy' });
      expect(busy.headers['retry-after']).toBe('2');
      expect(alerts(warn, 'busy_503')).toHaveLength(1);
    } finally { release(); }
    expect(bcryptGate.inFlight()).toBe(0);
    await request(app).post('/api/auth/login').send({ email: 'busy@test.com', password: 'the real password' }).expect(200);
  });
});

describe('dashboard responses are never cached (FX-21)', () => {
  it('sets Cache-Control: no-store on the account export and on errors', async () => {
    const user = await createUser(User);
    const exported = await request(app).get('/api/account/export').set('Authorization', loginAs(user)).expect(200);
    expect(exported.headers['cache-control']).toBe('no-store');
    const missing = await request(app).get('/api/nothing-here').expect(404);
    expect(missing.headers['cache-control']).toBe('no-store');
  });
});

describe('Turnstile on the public mail endpoints (FX-67)', () => {
  const mockSiteverify = (result) => vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    expect(String(url)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(init.body.get('secret')).toBe('test-turnstile-secret');
    if (result instanceof Error) throw result;
    return { json: async () => result };
  });

  it('is off without a secret key, and the config advertises no site key', async () => {
    process.env.SIGNUP_MODE = 'open';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await request(app).get('/api/auth/config').expect(200)).body.turnstileSiteKey).toBeNull();
    await request(app).post('/api/auth/signup').send(signupBody('plain@test.com')).expect(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires a valid token on signup and resend-verification when configured', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret';
    process.env.TURNSTILE_SITE_KEY = '0x4AAAAAAA-test-site-key';
    expect((await request(app).get('/api/auth/config').expect(200)).body.turnstileSiteKey).toBe('0x4AAAAAAA-test-site-key');

    const missing = await request(app).post('/api/auth/signup').send(signupBody('captcha@test.com')).expect(400);
    expect(missing.body.error).toBe('captcha_required');

    mockSiteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const failed = await request(app).post('/api/auth/signup').send({ ...signupBody('captcha@test.com'), captchaToken: 'bad' }).expect(400);
    expect(failed.body.error).toBe('captcha_failed');
    const failedResend = await request(app).post('/api/auth/resend-verification').send({ email: 'captcha@test.com', captchaToken: 'bad' }).expect(400);
    expect(failedResend.body.error).toBe('captcha_failed');
    expect(await User.exists({ email: 'captcha@test.com' })).toBeFalsy();
    expect(messages).toHaveLength(0);

    vi.restoreAllMocks();
    mockSiteverify({ success: true });
    await request(app).post('/api/auth/signup').send({ ...signupBody('captcha@test.com'), captchaToken: 'good' }).expect(200);
    expect(await User.exists({ email: 'captcha@test.com' })).toBeTruthy();
    expect(messages).toHaveLength(1);
  });

  it('fails closed with 503 when Cloudflare cannot be reached', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.TURNSTILE_SECRET_KEY = 'test-turnstile-secret';
    mockSiteverify(new Error('network down'));
    const response = await request(app).post('/api/auth/signup').send({ ...signupBody('outage@test.com'), captchaToken: 'any' }).expect(503);
    expect(response.body.error).toBe('captcha_unavailable');
    expect(await User.exists({ email: 'outage@test.com' })).toBeFalsy();
  });
});

describe('signup budget controls (FX-67)', () => {
  it('caps new signups per email domain per day without charging the mail budget', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.SIGNUP_DOMAIN_DAILY_CAP = '2';
    app.set('trust proxy', 1);
    await from('203.0.113.1').post('/api/auth/signup').send(signupBody('a@bulk.test')).expect(200);
    // A repeat signup for an existing address does not use up the domain's allowance.
    await from('203.0.113.2').post('/api/auth/signup').send(signupBody('a@bulk.test')).expect(200);
    await from('203.0.113.3').post('/api/auth/signup').send(signupBody('b@bulk.test')).expect(200);
    const capped = await from('203.0.113.4').post('/api/auth/signup').send(signupBody('c@bulk.test'));
    expect(capped.status).toBe(429);
    expect(capped.body.error).toBe('rate_limited');
    // Once capped, existing and new addresses get the same answer, so the cap reveals nothing.
    const existing = await from('203.0.113.5').post('/api/auth/signup').send(signupBody('a@bulk.test'));
    expect(existing.status).toBe(429);
    expect(existing.body).toEqual(capped.body);
    expect(alerts(warn, 'signup_domain_capped')).toHaveLength(1);
    expect(await User.exists({ email: 'c@bulk.test' })).toBeFalsy();
    await from('203.0.113.6').post('/api/auth/signup').send(signupBody('c@other.test')).expect(200);
    expect((await Setting.findOne({ key: today() }).lean()).value).toBe(3);
  });

  it('logs mail_budget_half exactly once when half of the daily cap is spent', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.MAIL_DAILY_CAP = '8';
    process.env.MAIL_RESET_RESERVE = '2';
    app.set('trust proxy', 1);
    for (let i = 0; i < 5; i += 1) await from(`203.0.113.${i + 10}`).post('/api/auth/signup').send(signupBody(`half${i}@test.com`)).expect(200);
    const half = alerts(warn, 'mail_budget_half');
    expect(half).toHaveLength(1);
    expect(half[0][0]).toMatchObject({ sent: 4, cap: 8 });
  });

  it('closes signup for every address once MAX_ACCOUNTS is reached', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.MAX_ACCOUNTS = '1';
    await createUser(User, { email: 'existing@test.com' });
    const refused = await request(app).post('/api/auth/signup').send(signupBody('newcomer@test.com')).expect(503);
    expect(refused.body.error).toBe('signup_unavailable');
    await request(app).post('/api/auth/signup').send(signupBody('existing@test.com')).expect(503);
    expect(messages).toHaveLength(0);
  });
});

describe('recovery and onboarding limiter design (FX-68)', () => {
  it('sends no reset mail to an unverified account and takes no reserve unit', async () => {
    await User.create({ email: 'unverified@test.com', passwordHash: null, emailVerifiedAt: null });
    const response = await request(app).post('/api/auth/forgot-password').send({ email: 'unverified@test.com' }).expect(200);
    expect(response.body.success).toBe(true);
    expect(messages).toHaveLength(0);
    expect(await EmailToken.countDocuments({ type: 'reset' })).toBe(0);
    expect(await Setting.exists({ key: today() })).toBeFalsy();
  });

  it('keys the second signup limiter on (IP, email), so a victim can still register from their own network', async () => {
    process.env.SIGNUP_MODE = 'open';
    app.set('trust proxy', 1);
    for (let i = 0; i < 5; i += 1) await from('203.0.113.66').post('/api/auth/signup').send(signupBody('victim@test.com')).expect(200);
    await from('203.0.113.66').post('/api/auth/signup').send(signupBody('victim@test.com')).expect(429);
    await from('198.51.100.20').post('/api/auth/signup').send(signupBody('victim@test.com')).expect(200);
  });

  it('gives verify-email and reset-password separate per-IP budgets', async () => {
    for (let i = 0; i < 5; i += 1) await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(40), newPassword: 'long enough password' }).expect(400);
    await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(40), newPassword: 'long enough password' }).expect(429);
    await request(app).post('/api/auth/verify-email').send({ token: 'x'.repeat(40), password: 'long enough password' }).expect(400);
  });

  it('answers resend-verification over budget with the same 503 whether or not the account exists', async () => {
    process.env.MAIL_DAILY_CAP = '10';
    process.env.MAIL_RESET_RESERVE = '5';
    await Setting.create({ key: today(), value: 5 });
    await User.create({ email: 'pending@test.com', passwordHash: null, emailVerifiedAt: null });
    const known = await request(app).post('/api/auth/resend-verification').send({ email: 'pending@test.com' });
    const unknown = await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@test.com' });
    expect(known.status).toBe(503);
    expect(unknown.status).toBe(503);
    expect(unknown.body).toEqual(known.body);
  });

  it('refunds the unit when resend-verification finds no unverified account', async () => {
    await request(app).post('/api/auth/resend-verification').send({ email: 'nobody@test.com' }).expect(200);
    expect((await Setting.findOne({ key: today() }).lean()).value).toBe(0);
  });
});

describe('storage guard (FX-63)', () => {
  it('closes signup and refuses content writes above the threshold, while reads and deletes still work', async () => {
    process.env.SIGNUP_MODE = 'open';
    process.env.DB_STORAGE_CAP_BYTES = '1000';
    const user = await createUser(User);
    const auth = loginAs(user);
    const project = await Project.create({ owner: user._id, title: 'Keep', slug: 'keep', shortDescription: 'x', visibility: 'published' });

    const status = await storageGuard.checkStorage({ stats: async () => ({ storageSize: 850, indexSize: 100 }) });
    expect(status).toMatchObject({ full: true, percent: 95 });
    expect(alerts(warn, 'storage_full')).toHaveLength(1);

    const refused = await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'New', slug: 'new', shortDescription: 'x' }).expect(503);
    expect(refused.body).toMatchObject({ success: false, error: 'storage_full' });
    await request(app).put('/api/profile').set('Authorization', auth).send({ name: 'X' }).expect(503);
    await request(app).post('/api/apps').set('Authorization', auth).send({ name: 'A', type: 'protected' }).expect(503);
    await request(app).get('/api/projects').set('Authorization', auth).expect(200);
    await request(app).delete(`/api/projects/${project._id}`).set('Authorization', auth).expect(200);

    const config = await request(app).get('/api/auth/config').expect(200);
    expect(config.body).toMatchObject({ signupEnabled: false, signupMode: 'closed' });
    const signup = await request(app).post('/api/auth/signup').send(signupBody('late@test.com')).expect(503);
    expect(signup.body.error).toBe('signup_unavailable');

    await storageGuard.checkStorage({ stats: async () => ({ storageSize: 500, indexSize: 0 }) });
    expect(storageGuard.isStorageFull()).toBe(false);
    await request(app).post('/api/projects').set('Authorization', auth).send({ title: 'New', slug: 'new', shortDescription: 'x' }).expect(201);
  });

  it('warns with storage_high between the warn and block thresholds', async () => {
    process.env.DB_STORAGE_CAP_BYTES = '1000';
    await storageGuard.checkStorage({ stats: async () => ({ storageSize: 750, indexSize: 0 }) });
    expect(storageGuard.isStorageFull()).toBe(false);
    expect(alerts(warn, 'storage_high')).toHaveLength(1);
  });
});

describe('token expiry notices (FX-64)', () => {
  it('runs without tripping ownerGuard, mails each owner once, and marks the warned tokens', async () => {
    const owner = await createUser(User, { email: 'expiring-owner@test.com' });
    const other = await createUser(User, { email: 'quiet-owner@test.com' });
    const appDoc = await createApp(App, owner, { type: 'protected', allowedOrigins: [] });
    const quietApp = await createApp(App, other, { type: 'protected', allowedOrigins: [] });
    const soon = new Date(Date.now() + 2 * DAY_MS);
    const { tokenDoc: expiring } = await createToken(ApiToken, appDoc, 'sk', { expiresAt: soon, label: 'deploy key' });
    await createToken(ApiToken, appDoc, 'sk', { expiresAt: new Date(Date.now() + 60 * DAY_MS) });
    await createToken(ApiToken, quietApp, 'sk', { expiresAt: soon, revokedAt: new Date() });

    const first = await notifyExpiringTokens();
    expect(first).toMatchObject({ owners: 1, tokens: 1, failed: 0, deferred: 0 });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ template: 'token-expiry', to: owner.email });
    expect(messages[0].tokens).toEqual([expect.objectContaining({ label: 'deploy key' })]);
    expect((await ApiToken.findOne({ _id: expiring._id, owner: owner._id })).expiryWarningSentAt).toBeInstanceOf(Date);

    const second = await notifyExpiringTokens();
    expect(second.tokens).toBe(0);
    expect(messages).toHaveLength(1);
  });

  it('defers to the next run when the mail budget is spent', async () => {
    process.env.MAIL_DAILY_CAP = '2';
    process.env.MAIL_RESET_RESERVE = '1';
    await Setting.create({ key: today(), value: 1 });
    const owner = await createUser(User);
    const appDoc = await createApp(App, owner, { type: 'protected', allowedOrigins: [] });
    const { tokenDoc } = await createToken(ApiToken, appDoc, 'sk', { expiresAt: new Date(Date.now() + DAY_MS) });
    const result = await notifyExpiringTokens();
    expect(result).toMatchObject({ tokens: 0, deferred: 1 });
    expect(messages).toHaveLength(0);
    expect((await ApiToken.findOne({ _id: tokenDoc._id, owner: owner._id })).expiryWarningSentAt).toBeNull();
    expect(alerts(warn, 'token_expiry_deferred')).toHaveLength(1);
  });
});

describe('alert events (FX-43/FX-73)', () => {
  it('raises one token_invalid_burst per token prefix per minute on /v1', async () => {
    process.env.ALERT_TOKEN_INVALID_PER_MINUTE = '3';
    try {
      const bogus = `pk_live_${'A'.repeat(43)}`;
      for (let i = 0; i < 5; i += 1) await request(app).get('/v1/app').set('Authorization', `Bearer ${bogus}`).expect(401);
      const fired = alerts(warn, 'token_invalid_burst');
      expect(fired).toHaveLength(1);
      expect(fired[0][0]).toMatchObject({ key: 'pk_live_AAAA', count: 3 });
      expect(JSON.stringify(fired[0][0])).not.toContain(bogus);
    } finally { delete process.env.ALERT_TOKEN_INVALID_PER_MINUTE; }
  });

  it('truncates logged IPs to /24 and /48', () => {
    expect(logger.truncateIp('203.0.113.77')).toBe('203.0.113.0/24');
    expect(logger.truncateIp('::ffff:198.51.100.9')).toBe('198.51.100.0/24');
    expect(logger.truncateIp('2001:db8:abcd:12::1')).toBe('2001:db8:abcd::/48');
    expect(logger.truncateIp('::1')).toBe('0:0:0::/48');
    expect(logger.truncateIp(undefined)).toBeUndefined();
  });
});
