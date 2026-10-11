const pino = require('pino');

// One JSON logger for the whole process. Security-relevant events are logged as
// `logger.info({ event: 'login_failed', ... })` so they can be filtered by `event`.
// Secrets never reach the log: the redact list covers headers, bodies and tokens.
const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info');

const logger = pino({
  level,
  base: undefined,
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
      'password', 'newPassword', 'currentPassword', 'token', 'inviteCode', 'body.password',
      '*.password', '*.token', '*.authorization', '*.cookie',
    ],
    censor: '[redacted]',
  },
});

// Convenience for security events: logger.event('signup', { userId, reqId })
logger.event = (event, fields = {}) => logger.info({ event, ...fields });

module.exports = logger;
