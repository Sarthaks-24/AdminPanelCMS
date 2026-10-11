const crypto = require('crypto');

// Echo a sane incoming X-Request-Id (so a proxy or client can correlate), otherwise generate one.
// Applied app-wide before anything else; every error body and log line carries `req.id`.
const SAFE_ID = /^[A-Za-z0-9._-]{1,64}$/;

function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
