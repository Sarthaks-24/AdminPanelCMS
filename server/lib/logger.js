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

// Alert-worthy events carry a stable `alert` field (and level warn), so any log sink can page on
// `alert` being present without parsing messages. The names are listed in docs/OPERATIONS.md#alerts.
logger.alert = (alert, fields = {}) => logger.warn({ event: alert, alert, ...fields });

// Client IPs are logged truncated (IPv4 to /24, IPv6 to /48): enough to spot a flood, not to identify a person.
logger.truncateIp = (ip) => {
  const value = String(ip || '').replace(/^::ffff:(?=\d+\.)/i, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return `${value.split('.').slice(0, 3).join('.')}.0/24`;
  if (value.includes(':')) {
    const [head] = value.split('::');
    const groups = head.split(':').filter(Boolean).slice(0, 3);
    while (groups.length < 3) groups.push('0');
    return `${groups.join(':')}::/48`;
  }
  return value ? 'unknown' : undefined;
};

module.exports = logger;
