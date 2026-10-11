const request = require('supertest');
const appServer = require('../app');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const Profile = require('../models/Profile');
const cache = require('../lib/cache');
const { hashToken } = require('../lib/tokens');
const { resetV1Limiters } = require('../middleware/v1Limiters');
const { createUser, createApp, createToken, loginAs } = require('./helpers/factory');

// BE-01: a token resolve that is in flight while the owner revokes a key, edits the App or is suspended
// must never re-cache what it read before the change. Each test stalls the resolve's App read on a
// deferred promise, makes the change, releases the stale read and checks the next request.
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (check()) return;
    await new Promise((done) => setTimeout(done, 5));
  }
  throw new Error('condition not reached');
}

async function setup() {
  const user = await createUser(User);
  await Profile.create({ owner: user._id, name: 'Race Owner', email: 'owner@race.test', configured: true });
  const cmsApp = await createApp(App, user, { include: { profile: { enabled: true, fields: ['name', 'email'] } } });
  const { tokenDoc, rawToken } = await createToken(ApiToken, cmsApp, 'pk');
  const headers = { Authorization: `Bearer ${rawToken}`, Origin: 'https://portfolio.test' };
  return { user, cmsApp, tokenDoc, rawToken, headers };
}

// Starts GET /v1/profile with its App read stalled on the old document; resolves once the read is parked.
async function startStalledRequest(cmsApp, headers) {
  const staleApp = await App.findOne({ _id: cmsApp._id, owner: cmsApp.owner }).lean();
  const gate = deferred();
  const spy = vi.spyOn(App, 'findOne').mockImplementationOnce(() => ({ lean: () => gate.promise }));
  const inFlight = request(appServer).get('/v1/profile').set(headers).then((response) => response);
  await waitFor(() => spy.mock.calls.length > 0);
  spy.mockRestore();
  return { inFlight, release: () => gate.resolve(staleApp) };
}

describe('/v1 token cache races (BE-01)', () => {
  beforeEach(() => {
    resetV1Limiters();
    cache.tokenCache.clear();
    cache.badTokenCache.clear();
    cache.responseCache.clear();
  });

  it('does not re-cache an App read that an App edit raced', async () => {
    const { user, cmsApp, headers } = await setup();
    const { inFlight, release } = await startStalledRequest(cmsApp, headers);
    await request(appServer).put(`/api/apps/${cmsApp._id}`).set('Authorization', loginAs(user))
      .send({ include: { profile: { enabled: true, fields: ['name'] } } }).expect(200);
    release();
    await inFlight;
    const after = await request(appServer).get('/v1/profile').set(headers).expect(200);
    expect(after.body.data.name).toBe('Race Owner');
    expect(after.body.data).not.toHaveProperty('email');
  });

  it('does not resurrect a key revoked while its first lookup was in flight', async () => {
    const { user, cmsApp, tokenDoc, headers } = await setup();
    const { inFlight, release } = await startStalledRequest(cmsApp, headers);
    await request(appServer).delete(`/api/apps/${cmsApp._id}/tokens/${tokenDoc._id}`).set('Authorization', loginAs(user)).expect(200);
    release();
    await inFlight;
    const after = await request(appServer).get('/v1/profile').set(headers).expect(401);
    expect(after.body.error).toBe('token_invalid');
  });

  it('does not keep serving an owner suspended while the lookup was in flight', async () => {
    const { user, cmsApp, headers } = await setup();
    const { inFlight, release } = await startStalledRequest(cmsApp, headers);
    // What adminController.suspendUser does: flip the status, then evict the owner's resolved tokens.
    await User.updateOne({ _id: user._id }, { $set: { status: 'suspended' } });
    cache.evictOwner(user._id);
    release();
    await inFlight;
    const after = await request(appServer).get('/v1/profile').set(headers).expect(401);
    expect(after.body.error).toBe('account_unavailable');
  });

  it('rejects a cached entry whose hash has left the active set', async () => {
    const { rawToken, headers } = await setup();
    await request(appServer).get('/v1/profile').set(headers).expect(200);
    const hash = hashToken(rawToken);
    expect(cache.tokenCache.get(hash)).toBeDefined();
    cache.removeActiveToken(hash);
    await request(appServer).get('/v1/profile').set(headers).expect(401);
    expect(cache.tokenCache.get(hash)).toBeUndefined();
  });

  it('files responses under the App version, so an older App read never shares a key', () => {
    const base = { ownerId: 'o', path: '/profile' };
    const older = cache.buildCacheKey({ ...base, cmsApp: { _id: 'a', updatedAt: new Date(1000) } });
    const newer = cache.buildCacheKey({ ...base, cmsApp: { _id: 'a', updatedAt: new Date(2000) } });
    expect(older).not.toBe(newer);
  });
});
