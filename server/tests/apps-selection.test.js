const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const { tokenCache } = require('../lib/cache');
const { LEGACY_SKILL_CATEGORIES } = require('../lib/modelConstants');
const { createUser, loginAs, createToken } = require('./helpers/factory');

const publishedProject = (owner, title) => Project.create({ owner, title, slug: title.toLowerCase().replace(/\s+/g, '-'), shortDescription: 's', visibility: 'published' });

describe('App selections survive content changes (A15 / B1)', () => {
  it('keeps the App saveable after a selected item is deleted through the dashboard', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const keep = await publishedProject(user._id, 'Keep me');
    const gone = await publishedProject(user._id, 'Delete me');
    const created = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Selected', type: 'protected', include: { projects: { enabled: true, mode: 'selected', ids: [String(keep._id), String(gone._id)] } } });
    expect(created.status).toBe(201);
    await request(app).delete(`/api/projects/${gone._id}`).set('Authorization', auth).expect(200);
    expect((await App.findOne({ _id: created.body._id, owner: user._id })).include.projects.ids.map(String)).toEqual([String(keep._id)]);
    const saved = await request(app).put(`/api/apps/${created.body._id}`).set('Authorization', auth).send({ name: 'Renamed' });
    expect(saved.status).toBe(200);
    expect(saved.body.include.projects.ids.map(String)).toEqual([String(keep._id)]);
  });

  it('silently drops stale stored ids but still rejects newly sent unowned ids', async () => {
    const user = await createUser(User);
    const stranger = await createUser(User);
    const auth = loginAs(user);
    const mine = await publishedProject(user._id, 'Mine');
    const theirs = await publishedProject(stranger._id, 'Theirs');
    const stale = await publishedProject(user._id, 'Stale');
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Stale', type: 'protected', include: { projects: { enabled: true, mode: 'selected', ids: [mine._id, stale._id] } } });
    await Project.deleteOne({ _id: stale._id, owner: user._id }); // deleted outside the dashboard, no prune ran
    const fullPut = await request(app).put(`/api/apps/${appDoc._id}`).set('Authorization', auth).send({ name: 'Still fine', include: { projects: { enabled: true, mode: 'selected' } } });
    expect(fullPut.status).toBe(200);
    expect(fullPut.body.include.projects.ids.map(String)).toEqual([String(mine._id)]);
    const unowned = await request(app).put(`/api/apps/${appDoc._id}`).set('Authorization', auth).send({ include: { projects: { ids: [String(mine._id), String(theirs._id)] } } });
    expect(unowned.status).toBe(400);
    expect(unowned.body.details.join(' ')).toMatch(/unowned/);
  });

  it('prunes skills from App selections when they are bulk-unpublished (B10)', async () => {
    const user = await createUser(User);
    const skill = await Skill.create({ owner: user._id, name: 'Go', category: 'Languages', visibility: 'published' });
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Skills', type: 'protected', include: { skills: { enabled: true, mode: 'selected', ids: [skill._id] } } });
    await request(app).patch('/api/skills/bulk').set('Authorization', loginAs(user)).send({ ids: [String(skill._id)], updates: { visibility: 'draft' } }).expect(200);
    expect((await App.findOne({ _id: appDoc._id, owner: user._id })).include.skills.ids).toHaveLength(0);
  });
});

describe('App type change revokes the other kind of token (A16 / B15)', () => {
  it('revokes live pk tokens, evicts them from the cache, and hides their value after a flip to protected', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Flip', type: 'static', allowedOrigins: ['*'], include: { projects: { enabled: true } } });
    const { tokenDoc, rawToken } = await createToken(ApiToken, appDoc, 'pk');
    tokenCache.set(tokenDoc.hash, { tokenDoc: tokenDoc.toObject(), appDoc: appDoc.toObject(), ownerUser: { _id: user._id, status: 'active' } });
    const flipped = await request(app).put(`/api/apps/${appDoc._id}`).set('Authorization', auth).send({ type: 'protected' });
    expect(flipped.status).toBe(200);
    expect(flipped.body.type).toBe('protected');
    expect((await ApiToken.findOne({ _id: tokenDoc._id, owner: user._id })).revokedAt).not.toBeNull();
    expect(tokenCache.get(tokenDoc.hash)).toBeUndefined();
    const tokens = await request(app).get(`/api/apps/${appDoc._id}/tokens`).set('Authorization', auth);
    expect(tokens.status).toBe(200);
    expect(tokens.body[0]).not.toHaveProperty('value');
    const v1 = await request(app).get('/v1/app').set('Authorization', `Bearer ${rawToken}`);
    expect(v1.status).toBe(401);
    const minted = await request(app).post(`/api/apps/${appDoc._id}/tokens`).set('Authorization', auth).send({});
    expect(minted.status).toBe(201);
    expect(minted.body.type).toBe('sk');
  });

  it('leaves tokens alone when the type does not change', async () => {
    const user = await createUser(User);
    const appDoc = await App.create({ owner: user._id, quotaSlot: 0, name: 'Same', type: 'static', allowedOrigins: ['*'] });
    const { tokenDoc } = await createToken(ApiToken, appDoc, 'pk');
    await request(app).put(`/api/apps/${appDoc._id}`).set('Authorization', loginAs(user)).send({ name: 'Renamed', type: 'static' }).expect(200);
    expect((await ApiToken.findOne({ _id: tokenDoc._id, owner: user._id })).revokedAt).toBeNull();
  });
});

describe('per-owner skill categories (§2.6, B6, B12)', () => {
  it('suggests the legacy list for an owner with no skills, then the owner\'s own sorted categories', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    const empty = await request(app).get('/api/skills/categories').set('Authorization', auth);
    expect(empty.status).toBe(200);
    expect(empty.body.categories).toEqual([...LEGACY_SKILL_CATEGORIES]);
    const created = await request(app).post('/api/skills').set('Authorization', auth).send({ skills: [
      { name: 'Figma', category: 'Design Tools' }, { name: 'Typography', category: 'Visual Design' }, { name: 'Sketch', category: 'Design Tools', order: 40 },
    ] });
    expect(created.status).toBe(201);
    expect(created.body.map((skill) => skill.order)).toEqual([0, 1, 40]);
    const mine = await request(app).get('/api/skills/categories').set('Authorization', auth);
    expect(mine.body.categories).toEqual(['Design Tools', 'Visual Design']);
    const list = await request(app).get('/api/skills').set('Authorization', auth);
    expect(Object.keys(list.body.byCategory).sort()).toEqual(['Design Tools', 'Visual Design']);
    const later = await request(app).post('/api/skills').set('Authorization', auth).send({ name: 'Framer', category: 'Design Tools' });
    expect(later.body.order).toBe(41);
  });

  it('accepts a custom category in include.skills.categories and rejects an unknown one', async () => {
    const user = await createUser(User);
    const auth = loginAs(user);
    await Skill.create({ owner: user._id, name: 'Figma', category: 'Design Tools', visibility: 'published' });
    const ok = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Design', type: 'protected', include: { skills: { enabled: true, categories: ['Design Tools'] } } });
    expect(ok.status).toBe(201);
    expect(ok.body.include.skills.categories).toEqual(['Design Tools']);
    const preview = await request(app).get(`/api/apps/${ok.body._id}/preview`).set('Authorization', auth);
    expect(preview.body.skills.map((skill) => skill.category)).toEqual(['Design Tools']);
    const unknown = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Unknown', type: 'protected', include: { skills: { enabled: true, categories: ['Languages'] } } });
    expect(unknown.status).toBe(400);
    expect(unknown.body.details.join(' ')).toMatch(/Languages/);
    const duplicate = await request(app).post('/api/apps').set('Authorization', auth)
      .send({ name: 'Dup', type: 'protected', include: { skills: { enabled: true, categories: ['Design Tools', 'Design Tools'] } } });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.details.join(' ')).toMatch(/duplicates/);
    // Deleting the last skill in a stored category must not make the App unsaveable.
    await Skill.deleteMany({ owner: user._id });
    const saved = await request(app).put(`/api/apps/${ok.body._id}`).set('Authorization', auth).send({ name: 'Renamed' });
    expect(saved.status).toBe(200);
    expect(saved.body.include.skills.categories).toEqual([]);
  });
});
