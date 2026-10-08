const request = require('supertest');
const app = require('../app');
describe('legacy resume download removal', () => {
  it('removes the unauthenticated redirect endpoint; consumers use resumeUrl from /v1/resume', async () => {
    await request(app).get('/api/resume/download').expect(404);
    await request(app).get('/api/resume').expect(401);
  });
});
