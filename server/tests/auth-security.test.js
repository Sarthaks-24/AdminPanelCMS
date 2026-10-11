const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const EmailToken = require('../models/EmailToken');
const Setting = require('../models/Setting');
const mailer = require('../lib/mailer');
const validateEnv = require('../lib/validateEnv');
const { issueEmailToken } = require('../lib/emailTokens');
const { purgeUnverified, UNVERIFIED_TTL_MS } = require('../lib/sweepDeleted');
const { resetRecipientCooldowns } = require('../lib/mailBudget');
const { signupRateLimiters, resendVerificationRateLimiters, recoveryRateLimiters, verificationRateLimiter } = require('../middleware/authRateLimiters');
const { createUser, createApp, createToken, seedContent } = require('./helpers/factory');

const LOCAL_KEYS = ['127.0.0.1', '::ffff:127.0.0.1', '::1'];
const resetLimiters = (limiters) => Promise.all(limiters.flatMap((limiter) => LOCAL_KEYS.map((key) => limiter.resetKey(key))));
const PUBLIC_MAIL_LIMITERS = [...signupRateLimiters, ...resendVerificationRateLimiters, ...recoveryRateLimiters, verificationRateLimiter];
const today = () => `mail:${new Date().toISOString().slice(0, 10)}`;

describe('mail budget on the public mail paths', () => {
  let messages;
  beforeEach(async () => {
    messages = [];
    mailer.setMailTransport({ send: async (message) => { messages.push(message); } });
    process.env.SIGNUP_MODE = 'open';
    process.env.MAIL_DAILY_CAP = '80';
    process.env.MAIL_RESET_RESERVE = '10';
    resetRecipientCooldowns();
    await resetLimiters(PUBLIC_MAIL_LIMITERS);
  });
  afterEach(() => { mailer.setMailTransport(null); delete process.env.SIGNUP_MODE; delete process.env.MAIL_DAILY_CAP; delete process.env.MAIL_RESET_RESERVE; });

  it('answers 503 mail_budget on signup and resend once the non-reserved budget is spent, while resets keep going', async () => {
    // 69 sends already happened today; the 70th is the last one signup may take (cap 80 minus a reserve of 10).
    await Setting.create({ key: today(), value: 69 });
    await request(app).post('/api/auth/signup').send({ email: 'seventy@test.com', acceptedTerms: true, acceptedPrivacy: true }).expect(200);
    expect(messages).toHaveLength(1);
    const refused = await request(app).post('/api/auth/signup').send({ email: 'seventy-one@test.com', acceptedTerms: true, acceptedPrivacy: true });
    expect(refused.status).toBe(503);
    expect(refused.body).toMatchObject({ success: false, error: 'mail_budget' });
    expect(await User.exists({ email: 'seventy-one@test.com' })).toBeFalsy();
    resetRecipientCooldowns();
    const resend = await request(app).post('/api/auth/resend-verification').send({ email: 'seventy@test.com' });
    expect(resend.status).toBe(503);
    expect(resend.body.error).toBe('mail_budget');
    expect(messages).toHaveLength(1);
    // The reserve is still open for password resets.
    const user = await User.create({ email: 'reset-me@test.com', passwordHash: 'x', emailVerifiedAt: new Date() });
    await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ template: 'password-reset', to: user.email });
    // Past the whole cap even resets are dropped, but the answer stays generic.
    await Setting.updateOne({ key: today() }, { $set: { value: 80 } });
    resetRecipientCooldowns();
    const generic = await request(app).post('/api/auth/forgot-password').send({ email: user.email }).expect(200);
    expect(generic.body.success).toBe(true);
    expect(messages).toHaveLength(2);
    expect((await Setting.findOne({ key: today() }).lean()).value).toBe(80);
  });

  it('refunds the reserved unit when no mail was needed', async () => {
    await User.create({ email: 'quiet@test.com', passwordHash: 'x', emailVerifiedAt: new Date(), accountExistsNoticeAt: new Date() });
    await request(app).post('/api/auth/signup').send({ email: 'quiet@test.com', acceptedTerms: true, acceptedPrivacy: true }).expect(200);
    expect(messages).toHaveLength(0);
    expect((await Setting.findOne({ key: today() }).lean()).value).toBe(0);
  });
});

describe('unverified signup purge', () => {
  it('removes only accounts that never verified and are older than 48 hours', async () => {
    const old = new Date(Date.now() - UNVERIFIED_TTL_MS - 60_000);
    const stale = await User.create({ email: 'stale@test.com', passwordHash: null, emailVerifiedAt: null });
    const fresh = await User.create({ email: 'fresh@test.com', passwordHash: null, emailVerifiedAt: null });
    const verifiedOld = await User.create({ email: 'verified-old@test.com', passwordHash: 'x', emailVerifiedAt: old });
    const legacyUnverified = await User.create({ email: 'legacy@test.com', passwordHash: 'x', emailVerifiedAt: null });
    // createdAt is a timestamp Mongoose sets; move the old ones back in time directly.
    await User.updateMany({ _id: { $in: [stale._id, verifiedOld._id, legacyUnverified._id] } }, { $set: { createdAt: old } }, { timestamps: false, overwriteImmutable: true });
    expect((await User.findById(stale._id)).createdAt.getTime()).toBe(old.getTime());
    await issueEmailToken(stale._id, 'verify');

    expect(await purgeUnverified()).toBe(2);
    expect(await User.exists({ _id: stale._id })).toBeFalsy();
    expect(await User.exists({ _id: legacyUnverified._id })).toBeFalsy();
    expect(await EmailToken.countDocuments({ user: stale._id })).toBe(0);
    expect(await User.exists({ _id: fresh._id })).toBeTruthy();
    expect(await User.exists({ _id: verifiedOld._id })).toBeTruthy();
    expect(await purgeUnverified()).toBe(0);
  });
});

describe('password reset and API tokens', () => {
  let messages;
  beforeEach(async () => { messages = []; mailer.setMailTransport({ send: async (message) => { messages.push(message); } }); resetRecipientCooldowns(); await resetLimiters(PUBLIC_MAIL_LIMITERS); });
  afterEach(() => mailer.setMailTransport(null));

  it('keeps the tenant’s API tokens live across a password reset', async () => {
    const owner = await createUser(User, { passwordHash: await bcrypt.hash('old-password-here', 4) });
    await seedContent({ Profile: require('../models/Profile'), Project: require('../models/Project'), Resume: require('../models/Resume'), Skill: require('../models/Skill'), Social: require('../models/Social'), Experience: require('../models/Experience'), Education: require('../models/Education'), Certification: require('../models/Certification') }, owner);
    const appDoc = await createApp(App, owner, { type: 'protected', allowedOrigins: [] });
    const { rawToken, tokenDoc } = await createToken(ApiToken, appDoc, 'sk');
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${rawToken}`)).status).toBe(200);

    await request(app).post('/api/auth/forgot-password').send({ email: owner.email }).expect(200);
    const token = new URL(messages[0].url).searchParams.get('token');
    await request(app).post('/api/auth/reset-password').send({ token, newPassword: 'a-new-long-password' }).expect(200);

    expect((await ApiToken.findOne({ _id: tokenDoc._id, owner: owner._id })).revokedAt).toBeNull();
    expect((await request(app).get('/v1/app').set('Authorization', `Bearer ${rawToken}`)).status).toBe(200);
  });
});

describe('production mail configuration', () => {
  const goodEnv = { JWT_SECRET: 'x'.repeat(40) + 'randomSecretValue', NODE_ENV: 'production', CLIENT_ORIGIN: 'https://admin.example.com', MONGODB_URI: 'mongodb://127.0.0.1:27017/Test', TRUST_PROXY_HOPS: '1', RESEND_MAIL_KEY: 're_live_key', RESEND_FROM_EMAIL: 'CMS <no-reply@example.com>' };

  it('is fatal when signup is enabled and only a warning when signup is closed', () => {
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'invite', RESEND_MAIL_KEY: 're_xxxxxxxxx' })).toThrow(/RESEND_MAIL_KEY/);
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'open', RESEND_FROM_EMAIL: 'onboarding@resend.dev' })).toThrow(/RESEND_FROM_EMAIL/);
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'open', RESEND_FROM_EMAIL: '' })).toThrow(/RESEND_FROM_EMAIL/);
    expect(validateEnv({ ...goodEnv, SIGNUP_MODE: 'closed', RESEND_MAIL_KEY: 're_xxxxxxxxx' }).warnings[0]).toMatch(/RESEND_MAIL_KEY/);
    expect(validateEnv({ ...goodEnv, RESEND_FROM_EMAIL: 'onboarding@resend.dev' }).warnings[0]).toMatch(/RESEND_FROM_EMAIL/);
    expect(validateEnv({ ...goodEnv, SIGNUP_MODE: 'open' }).warnings).toEqual([]);
  });

  it('validates PUBLIC_API_URL as a bare https origin in production', () => {
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: 'https://api.example.com' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: 'http://api.example.com' })).toThrow(/https/);
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: 'https://api.example.com/' })).toThrow(/trailing slash/);
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: 'https://api.example.com/v1' })).toThrow(/path/);
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: 'not a url' })).toThrow(/PUBLIC_API_URL/);
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173', PUBLIC_API_URL: 'http://localhost:5000' })).not.toThrow();
  });
});
