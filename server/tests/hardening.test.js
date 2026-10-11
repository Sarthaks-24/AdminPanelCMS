const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const User = require('../models/User');
const Project = require('../models/Project');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const App = require('../models/App');
const validateEnv = require('../lib/validateEnv');
const pickWritable = require('../middleware/pickWritable');
const errorHandler = require('../middleware/errorHandler');
const { createUser, loginAs, createApp } = require('./helpers/factory');

const goodEnv = { JWT_SECRET: 'x'.repeat(40) + 'randomSecretValue', NODE_ENV: 'production', CLIENT_ORIGIN: 'https://admin.example.com', MONGODB_URI: 'mongodb://127.0.0.1:27017/Test', TRUST_PROXY_HOPS: '1', RESEND_MAIL_KEY: 're_live_key', RESEND_FROM_EMAIL: 'CMS <no-reply@example.com>', INVITE_CODE_PEPPER: 'k'.repeat(48), PUBLIC_API_URL: 'https://api.example.com', OPERATOR_NAME: 'Example Ltd', SUPPORT_EMAIL: 'support@example.com' };

describe('nested writable fields', () => {
  it('saves project links and profile location through the HTTP routes', async () => {
    const user = await createUser(User);
    const created = await request(app).post('/api/projects').set('Authorization', loginAs(user))
      .send({ title: 'Linked', mode: 'solo', role: 'Lead', shortDescription: 's', caseStudyBody: 'b', links: { github: 'https://github.com/x/y' } });
    expect(created.status).toBe(201);
    expect((await Project.findOne({ _id: created.body._id, owner: user._id })).links.github).toBe('https://github.com/x/y');
    const profile = await request(app).put('/api/profile').set('Authorization', loginAs(user)).send({ location: { city: 'Pune' } });
    expect(profile.status).toBe(200);
    expect((await Profile.findOne({ owner: user._id })).location.city).toBe('Pune');
  });

  it('drops unlisted fields and ignores dotted-key injection', () => {
    const req = { body: { title: 't', owner: 'evil', 'links.github': 'x', links: { github: 'g', admin: 1 } } };
    pickWritable(['title', 'links.github'])(req, {}, () => {});
    expect(req.body).toEqual({ title: 't', links: { github: 'g' } });
  });
});

describe('startup validation', () => {
  it('rejects missing, short and placeholder secrets and non-https production origins', () => {
    expect(() => validateEnv({ ...goodEnv, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
    expect(() => validateEnv({ ...goodEnv, JWT_SECRET: 'super_secret_jwt_key_at_least_32_characters_long_replace_me' })).toThrow(/placeholder/);
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'http://admin.example.com' })).toThrow(/https/);
    expect(() => validateEnv(goodEnv)).not.toThrow();
  });

  it('requires a database URI everywhere and an explicit proxy setting in production', () => {
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: '' })).toThrow(/MONGODB_URI/);
    expect(() => validateEnv({ ...goodEnv, TRUST_PROXY_HOPS: undefined })).toThrow(/TRUST_PROXY_HOPS/);
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173' })).not.toThrow();
  });

  it('rejects production settings that would share state with development or break CORS', () => {
    expect(() => validateEnv({ ...goodEnv, DEV_MONGODB_URI: goodEnv.MONGODB_URI })).toThrow(/must differ from DEV_MONGODB_URI/);
    expect(() => validateEnv({ ...goodEnv, DEV_JWT_SECRET: goodEnv.JWT_SECRET })).toThrow(/must differ from DEV_JWT_SECRET/);
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb+srv://u:p@cluster.example.net/?retryWrites=true' })).toThrow(/database name/);
    expect(() => validateEnv({ ...goodEnv, DEV_MONGODB_URI: goodEnv.MONGODB_URI + '?retryWrites=true' })).toThrow(/must differ from DEV_MONGODB_URI/);
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb+srv://prod:pw@Cluster.x.net/App', DEV_MONGODB_URI: 'mongodb+srv://dev:other@cluster.x.net/App?w=1' })).toThrow(/must differ from DEV_MONGODB_URI/);
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/App_prod', DEV_MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/App_dev' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, JWT_SECRET: 'p'.repeat(40) + '?one', DEV_JWT_SECRET: 'p'.repeat(40) + '?two' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, DEV_MONGODB_URI: undefined, DEV_JWT_SECRET: undefined })).not.toThrow();
    // A dev URI with no database name resolves to the default database, so a prod URI naming that database is the same target.
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/Portfolio_db', DEV_MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/?retryWrites=true' })).toThrow(/must differ from DEV_MONGODB_URI/);
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/Portfolio_prod', DEV_MONGODB_URI: 'mongodb+srv://u:p@cluster.x.net/?retryWrites=true' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb://h1:27017,h2:27017/?replicaSet=rs' })).toThrow(/database name/);
    expect(() => validateEnv({ ...goodEnv, MONGODB_URI: 'mongodb://h1:27017,h2:27017/Prod?replicaSet=rs' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', CLIENT_ORIGIN: 'not a url', TRUST_PROXY_HOPS: undefined })).toThrow(/bare origin/);
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'https://admin.example.com/' })).toThrow(/bare origin/);
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', CLIENT_ORIGIN: 'http://localhost:5173/', TRUST_PROXY_HOPS: undefined })).toThrow(/bare origin/);
  });

  it('requires a separate INVITE_CODE_PEPPER and PUBLIC_API_URL in production', () => {
    expect(() => validateEnv({ ...goodEnv, INVITE_CODE_PEPPER: '' })).toThrow(/INVITE_CODE_PEPPER must be set/);
    expect(() => validateEnv({ ...goodEnv, INVITE_CODE_PEPPER: 'short' })).toThrow(/INVITE_CODE_PEPPER/);
    expect(() => validateEnv({ ...goodEnv, INVITE_CODE_PEPPER: goodEnv.JWT_SECRET })).toThrow(/must differ from JWT_SECRET/);
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', INVITE_CODE_PEPPER: '', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, PUBLIC_API_URL: '' })).toThrow(/PUBLIC_API_URL must be set/);
  });

  it('refuses half a Turnstile configuration and Cloudflare test keys in production (X-02, CB-18)', () => {
    const keys = { TURNSTILE_SECRET_KEY: '0x4AAAAAAAreal-secret', TURNSTILE_SITE_KEY: '0x4AAAAAAAreal-site' };
    expect(() => validateEnv({ ...goodEnv, ...keys })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, TURNSTILE_SECRET_KEY: keys.TURNSTILE_SECRET_KEY })).toThrow(/TURNSTILE_SITE_KEY is not/);
    expect(() => validateEnv({ ...goodEnv, TURNSTILE_SITE_KEY: keys.TURNSTILE_SITE_KEY })).toThrow(/TURNSTILE_SECRET_KEY is not/);
    expect(() => validateEnv({ ...goodEnv, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', TURNSTILE_SITE_KEY: keys.TURNSTILE_SITE_KEY })).toThrow(/test keys/);
    expect(() => validateEnv({ ...goodEnv, ...keys, TURNSTILE_SITE_KEY: '3x00000000000000000000FF' })).toThrow(/test keys/);
    // Development only warns, and accepts the test keys.
    const dev = { ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173', PUBLIC_API_URL: '' };
    expect(validateEnv({ ...dev, TURNSTILE_SECRET_KEY: 'secret' }).warnings.join(' ')).toMatch(/TURNSTILE/);
    expect(() => validateEnv({ ...dev, TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', TURNSTILE_SITE_KEY: '1x00000000000000000000AA' })).not.toThrow();
  });

  it('rejects unknown values for enum settings instead of coercing them (CB-02)', () => {
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'invites' })).toThrow(/SIGNUP_MODE must be one of/);
    expect(() => validateEnv({ ...goodEnv, LEGAL_POLICIES_APPROVED: 'TRUE' })).toThrow(/LEGAL_POLICIES_APPROVED/);
    expect(() => validateEnv({ ...goodEnv, LEGAL_POLICIES_APPROVED: 'yes' })).toThrow(/LEGAL_POLICIES_APPROVED/);
    expect(() => validateEnv({ ...goodEnv, SESSION_COOKIE_SAMESITE: 'relaxed' })).toThrow(/SESSION_COOKIE_SAMESITE/);
    expect(() => validateEnv({ ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173', SIGNUP_MODE: 'opne' })).toThrow(/SIGNUP_MODE/);
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'Invite', LEGAL_POLICIES_APPROVED: 'false', SESSION_COOKIE_SAMESITE: 'Strict' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: '', LEGAL_POLICIES_APPROVED: '', SESSION_COOKIE_SAMESITE: '' })).not.toThrow();
  });

  it('treats a non-numeric limit as a production boot problem and a dev warning, and names disabled guards (CB-14)', () => {
    expect(() => validateEnv({ ...goodEnv, STORAGE_CHECK_INTERVAL_MINUTES: '10m' })).toThrow(/STORAGE_CHECK_INTERVAL_MINUTES must be a number/);
    expect(() => validateEnv({ ...goodEnv, MAX_ACCOUNTS: 'fifty' })).toThrow(/MAX_ACCOUNTS must be a whole number/);
    expect(() => validateEnv({ ...goodEnv, MAIL_DAILY_CAP: '', SWEEP_DELETED_INTERVAL_HOURS: '  ' })).not.toThrow();
    const dev = { ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173' };
    expect(validateEnv({ ...dev, MAX_ACCOUNTS: 'fifty' }).warnings.join(' ')).toMatch(/MAX_ACCOUNTS/);
    expect(validateEnv({ ...goodEnv, STORAGE_CHECK_INTERVAL_MINUTES: '0' }).warnings).toEqual([expect.stringMatching(/STORAGE_CHECK_INTERVAL_MINUTES=0: the storage guard is DISABLED/)]);
  });

  it('refuses a dashboard and API on provably different sites with a Lax/Strict cookie (FE-09)', () => {
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'https://example.com', PUBLIC_API_URL: 'https://api.example.com' })).not.toThrow();
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'https://cms.example.com', PUBLIC_API_URL: 'https://api.other.org' })).toThrow(/different sites/);
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'https://cms.pages.dev', PUBLIC_API_URL: 'https://cms-api.onrender.com' })).toThrow(/different sites/);
    expect(() => validateEnv({ ...goodEnv, CLIENT_ORIGIN: 'https://app-a.onrender.com', PUBLIC_API_URL: 'https://api-a.onrender.com' })).toThrow(/different sites/);
    expect(() => validateEnv({ ...goodEnv, SESSION_COOKIE_SAMESITE: 'strict', CLIENT_ORIGIN: 'https://cms.example.com', PUBLIC_API_URL: 'https://api.other.org' })).toThrow(/SameSite=strict/);
    // SameSite=None is never an escape hatch that fails boot, but it is always called out.
    const none = validateEnv({ ...goodEnv, SESSION_COOKIE_SAMESITE: 'none', CLIENT_ORIGIN: 'https://cms.example.com', PUBLIC_API_URL: 'https://api.other.org' });
    expect(none.warnings.join(' ')).toMatch(/SESSION_COOKIE_SAMESITE=none/);
  });

  it('refuses the console mail transport in production and announces it in development (NF-17)', () => {
    expect(() => validateEnv({ ...goodEnv, MAIL_TRANSPORT: 'console' })).toThrow(/MAIL_TRANSPORT=console/);
    expect(() => validateEnv({ ...goodEnv, MAIL_TRANSPORT: 'smtp' })).toThrow(/MAIL_TRANSPORT must be one of/);
    const dev = { ...goodEnv, NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined, CLIENT_ORIGIN: 'http://localhost:5173' };
    expect(validateEnv({ ...dev, RESEND_MAIL_KEY: 're_xxxxxxxxx' }).warnings.join(' ')).toMatch(/Mail goes to the console/);
    expect(validateEnv({ ...dev, MAIL_TRANSPORT: 'console' }).warnings.join(' ')).toMatch(/Mail goes to the console/);
    expect(validateEnv(dev).warnings.join(' ')).not.toMatch(/console/);
  });

  it('exports the data-safety subset the production scripts run (X-06)', () => {
    const { dataSafetyProblems, assertDataSafety } = validateEnv;
    expect(dataSafetyProblems(goodEnv)).toEqual([]);
    expect(() => assertDataSafety({ ...goodEnv, INVITE_CODE_PEPPER: '' })).toThrow(/Refusing to run against production[\s\S]*INVITE_CODE_PEPPER/);
    expect(() => assertDataSafety({ ...goodEnv, MONGODB_URI: 'mongodb://h/App', DEV_MONGODB_URI: 'mongodb://h/App' })).toThrow(/DEV_MONGODB_URI/);
    expect(() => assertDataSafety({ ...goodEnv, MONGODB_URI: 'mongodb://h/' })).toThrow(/database name/);
    // Development scripts are not blocked by production rules.
    expect(() => assertDataSafety({ ...goodEnv, NODE_ENV: 'development', INVITE_CODE_PEPPER: '' })).not.toThrow();
  });

  it('warns instead of failing when production mail is not ready', () => {
    expect(validateEnv(goodEnv).warnings).toEqual([]);
    expect(validateEnv({ ...goodEnv, RESEND_MAIL_KEY: 're_xxxxxxxxx' }).warnings[0]).toMatch(/RESEND_MAIL_KEY/);
    expect(validateEnv({ ...goodEnv, RESEND_FROM_EMAIL: 'onboarding@resend.dev' }).warnings[0]).toMatch(/RESEND_FROM_EMAIL/);
    // CB-01: the mail identity counts as part of mail readiness; FE-08's values.
    expect(validateEnv({ ...goodEnv, OPERATOR_NAME: ' ' }).warnings[0]).toMatch(/OPERATOR_NAME/);
    expect(validateEnv({ ...goodEnv, SUPPORT_EMAIL: '' }).warnings[0]).toMatch(/SUPPORT_EMAIL is empty/);
    expect(validateEnv({ ...goodEnv, SUPPORT_EMAIL: 'Support <help@example.com>' }).warnings[0]).toMatch(/SUPPORT_EMAIL is not a plain email/);
    expect(() => validateEnv({ ...goodEnv, SIGNUP_MODE: 'invite', OPERATOR_NAME: '' })).toThrow(/OPERATOR_NAME/);
    // BE-04: a cap above the Resend free tier is called out.
    expect(validateEnv({ ...goodEnv, MAIL_DAILY_CAP: '500' }).warnings).toEqual([expect.stringMatching(/above the Resend free tier/)]);
  });
});

describe('error responses', () => {
  const run = (env, err) => {
    const previous = process.env.NODE_ENV; process.env.NODE_ENV = env;
    let body; const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { body = b; } };
    errorHandler(err, { id: 'req-1' }, res, () => {});
    process.env.NODE_ENV = previous; return { status: res.statusCode, body };
  };

  it('hides internal messages for 500s in production only and never emits a stack', () => {
    const production = run('production', new Error('MongoServerError: secret detail'));
    expect(production).toEqual({ status: 500, body: { success: false, error: 'internal', message: 'Internal Server Error', requestId: 'req-1' } });
    const development = run('development', new Error('MongoServerError: secret detail'));
    expect(development.body.message).toMatch(/secret detail/);
    expect(development.body).not.toHaveProperty('stack');
  });

  it('honours err.status and err.statusCode instead of turning every error into a 500', () => {
    expect(run('production', Object.assign(new Error('teapot'), { status: 418, expose: true })).body).toMatchObject({ error: 'bad_request', message: 'teapot' });
    expect(run('production', Object.assign(new Error('teapot'), { status: 418 }))).toMatchObject({ status: 418, body: { message: 'Bad request' } });
    expect(run('production', Object.assign(new Error('gateway'), { statusCode: 502 }))).toMatchObject({ status: 502, body: { error: 'internal' } });
    expect(run('production', Object.assign(new Error('x'), { status: 999 })).status).toBe(500);
  });

  it('turns malformed and oversized JSON bodies into 400 and 413 instead of 500', async () => {
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad').expect(400);
    expect(malformed.body).toMatchObject({ success: false, error: 'bad_request', requestId: expect.any(String) });
    expect(malformed.body).not.toHaveProperty('stack');
    const oversized = await request(app).post('/api/auth/login').set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(300 * 1024) })).expect(413);
    expect(oversized.body).toMatchObject({ success: false, error: 'payload_too_large', requestId: expect.any(String) });
  });

  it('defaults req.body to an object so body-less dashboard writes fail with 400, not 500', async () => {
    const user = await createUser(User);
    const response = await request(app).patch('/api/projects/reorder').set('Authorization', loginAs(user));
    expect(response.status).toBe(400);
  });
});

describe('probes and readiness', () => {
  it('serves /livez and the /api/health alias as liveness, and /readyz pings Mongo', async () => {
    await request(app).get('/livez').expect(200).expect((res) => expect(res.body.status).toBe('ok'));
    await request(app).get('/api/health').expect(200).expect((res) => expect(res.body.status).toBe('ok'));
    const ready = await request(app).get('/readyz').expect(200);
    expect(ready.body.status).toBe('ready');
  });

  it('reports 503 from /readyz when Mongo is down or the process is draining', async () => {
    const readiness = require('../lib/readiness');
    expect(await readiness.checkReady({ connection: { readyState: 0 } })).toEqual({ ok: false, reason: 'mongo_disconnected' });
    expect(await readiness.checkReady({ connection: { readyState: 1, getClient: () => ({ db: () => ({ command: () => Promise.reject(new Error('down')) }) }) } }))
      .toEqual({ ok: false, reason: 'mongo_ping_failed' });
    const spy = vi.spyOn(mongoose.connection, 'readyState', 'get').mockReturnValue(0);
    try {
      const down = await request(app).get('/readyz').expect(503);
      expect(down.body).toEqual({ status: 'unavailable' }); // the internal reason is not published
    } finally { spy.mockRestore(); }
    readiness.setShuttingDown(true);
    try {
      const draining = await request(app).get('/readyz').expect(503);
      expect(draining.body).toEqual({ status: 'unavailable' });
    } finally { readiness.setShuttingDown(false); }
    await request(app).get('/readyz').expect(200);
  });

  it('shares one Mongo ping across a burst of /readyz calls', async () => {
    const readiness = require('../lib/readiness');
    readiness.resetReadyCache();
    const admin = mongoose.connection.getClient().db('admin');
    const pingSpy = vi.spyOn(Object.getPrototypeOf(admin), 'command');
    try {
      const responses = await Promise.all(Array.from({ length: 100 }, () => request(app).get('/readyz')));
      expect(responses.every((response) => response.status === 200)).toBe(true);
      expect(pingSpy.mock.calls.filter(([command]) => command?.ping).length).toBe(1);
    } finally { pingSpy.mockRestore(); readiness.resetReadyCache(); }
  });
});

describe('content edits and bulk endpoints', () => {
  it('keeps an edited item in apps\' selected lists but prunes it when unpublished', async () => {
    const user = await createUser(User);
    const skill = await Skill.create({ owner: user._id, name: 'Go', category: 'Languages', visibility: 'published' });
    const cmsApp = await createApp(App, user, { include: { skills: { enabled: true, mode: 'selected', ids: [skill._id], fields: [] } } });
    await request(app).put(`/api/skills/${skill._id}`).set('Authorization', loginAs(user)).send({ proficiency: 'Expert' }).expect(200);
    expect((await App.findOne({ _id: cmsApp._id, owner: user._id })).include.skills.ids.map(String)).toContain(String(skill._id));
    await request(app).put(`/api/skills/${skill._id}`).set('Authorization', loginAs(user)).send({ visibility: 'draft' }).expect(200);
    expect((await App.findOne({ _id: cmsApp._id, owner: user._id })).include.skills.ids).toHaveLength(0);
  });

  it('rejects oversized and empty bulk updates with 400 instead of 500', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const ids = Array.from({ length: 501 }, () => '507f1f77bcf86cd799439011');
    await request(app).patch('/api/skills/bulk').set('Authorization', auth).send({ ids, updates: { featured: true } }).expect(400);
    await request(app).patch('/api/skills/bulk').set('Authorization', auth).send({ ids: ['507f1f77bcf86cd799439011'], updates: { nope: 1 } }).expect(400);
    await request(app).patch('/api/projects/reorder').set('Authorization', auth).send({ items: [null, { id: 'bad', order: 1 }] }).expect(200);
  });
});

describe('partial nested updates', () => {
  it('merges profile location instead of replacing the sub-document', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await request(app).put('/api/profile').set('Authorization', auth).send({ location: { city: 'Pune', country: 'India' } }).expect(200);
    await request(app).put('/api/profile').set('Authorization', auth).send({ location: { city: 'Mumbai' } }).expect(200);
    const saved = await Profile.findOne({ owner: user._id });
    expect(saved.location.city).toBe('Mumbai');
    expect(saved.location.country).toBe('India');
  });
});
