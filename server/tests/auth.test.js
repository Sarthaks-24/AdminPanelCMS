const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../app');
const User = require('../models/User');

describe('session compatibility', () => {
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
});
