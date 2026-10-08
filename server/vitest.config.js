const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test_jwt_secret_64chars_long_for_security_checks_1234567890abcdef1234',
      CLIENT_ORIGIN: 'http://localhost:5173',
      TRUST_PROXY_HOPS: '0',
    },
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
});
