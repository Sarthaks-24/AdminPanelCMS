const request = require('supertest');
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

const goodEnv = { JWT_SECRET: 'x'.repeat(40) + 'randomSecretValue', NODE_ENV: 'production', CLIENT_ORIGIN: 'https://admin.example.com', MONGODB_URI: 'mongodb://127.0.0.1:27017/Test', TRUST_PROXY_HOPS: '1', RESEND_MAIL_KEY: 're_live_key', RESEND_FROM_EMAIL: 'CMS <no-reply@example.com>' };

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

  it('warns instead of failing when production mail is not ready', () => {
    expect(validateEnv(goodEnv).warnings).toEqual([]);
    expect(validateEnv({ ...goodEnv, RESEND_MAIL_KEY: 're_xxxxxxxxx' }).warnings[0]).toMatch(/RESEND_MAIL_KEY/);
    expect(validateEnv({ ...goodEnv, RESEND_FROM_EMAIL: 'onboarding@resend.dev' }).warnings[0]).toMatch(/RESEND_FROM_EMAIL/);
  });
});

describe('error responses', () => {
  it('hides internal messages for 500s in production only', () => {
    const run = (env) => {
      const previous = process.env.NODE_ENV; process.env.NODE_ENV = env;
      let body; const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { body = b; } };
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      errorHandler(new Error('MongoServerError: secret detail'), {}, res, () => {});
      spy.mockRestore(); process.env.NODE_ENV = previous; return body;
    };
    expect(run('production').message).toBe('Internal Server Error');
    expect(run('development').message).toMatch(/secret detail/);
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
