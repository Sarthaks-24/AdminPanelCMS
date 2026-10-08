const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mongoServer;
let testDbPath;

function assertLocalMongoUri(uri) {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error('[CRITICAL] Test Mongo URI is malformed');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
      !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname)) {
    throw new Error(`[CRITICAL] Tests attempted connection to non-local DB host: ${parsed.hostname || 'unknown'}`);
  }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET ||= 'test_jwt_secret_64chars_long_for_security_checks_1234567890abcdef1234';

  // Keep mongod's data files under the workspace. The Windows sandbox blocks
  // WiredTiger's atomic file rename in its redirected system temp directory.
  const testTempRoot = path.join(__dirname, '..', 'node_modules', '.cache');
  fs.mkdirSync(testTempRoot, { recursive: true });
  testDbPath = fs.mkdtempSync(path.join(testTempRoot, 'mongo-memory-server-'));
  mongoServer = await MongoMemoryServer.create({
    instance: { ip: '127.0.0.1', dbPath: testDbPath, tmpDir: os.tmpdir() },
  });
  const uri = mongoServer.getUri();
  assertLocalMongoUri(uri);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
});

beforeEach(async () => {
  const host = mongoose.connection.host;
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`[SAFETY GUARD] Refusing to clear collections on non-test host: ${host || 'disconnected'}`);
  }

  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
  if (testDbPath) fs.rmSync(testDbPath, { recursive: true, force: true });
});
