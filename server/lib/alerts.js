const logger = require('./logger');
const { envNumber } = require('./envNumber');

// Burst alerts: count events per key in a fixed window and log one `alert` line when a key reaches the
// threshold, then stay quiet for the rest of that window. A flood therefore produces one line per minute per
// key instead of one per request. State is in process memory (single replica, docs/OPERATIONS.md).
// `threshold` may be a function so an env override is read when the event happens, not at load.
function burstAlert(alert, { threshold = 1, windowMs = 60_000, maxKeys = 10_000 } = {}) {
  const windows = new Map();
  function hit(key = 'all', fields = {}, now = Date.now()) {
    let entry = windows.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0, alerted: false };
      windows.set(key, entry);
      if (windows.size > maxKeys) windows.delete(windows.keys().next().value);
    }
    entry.count += 1;
    if (!entry.alerted && entry.count >= (typeof threshold === 'function' ? threshold() : threshold)) {
      entry.alerted = true;
      logger.alert(alert, { key, count: entry.count, windowSeconds: Math.round(windowMs / 1000), ...fields });
      return true;
    }
    return false;
  }
  return { hit, reset: () => windows.clear() };
}

// The response-status watchers that app.js wires on every request.
const busy = burstAlert('busy_503', { threshold: 1 });
const rateLimited = burstAlert('rate_limited_429', { threshold: () => envNumber('ALERT_429_PER_MINUTE') });
const tokenInvalid = burstAlert('token_invalid_burst', { threshold: () => envNumber('ALERT_TOKEN_INVALID_PER_MINUTE') });

// The pk_/sk_ prefix (first 12 characters) is not secret: the dashboard shows it. It is the only handle a 401
// has on "which App's keys are failing", because a rejected token never resolves to an App.
function tokenPrefix(req) {
  const match = /^Bearer\s+((?:pk|sk)_live_[A-Za-z0-9]{4})/.exec(req.get?.('authorization') || '');
  return match ? match[1] : 'malformed';
}

function watchResponses(req, res, next) {
  res.on('finish', () => {
    const path = (req.originalUrl || req.url || '').split('?')[0];
    const surface = path.startsWith('/v1') ? 'v1' : 'api';
    // Load-shedding 503s (`busy`) always carry Retry-After; config 503s (signup closed, mail budget) do not
    // and have their own alerts, so they are left out here.
    if (res.statusCode === 503 && res.get('Retry-After')) busy.hit(surface, { path });
    else if (res.statusCode === 429) rateLimited.hit(surface);
    else if (res.statusCode === 401 && surface === 'v1') tokenInvalid.hit(tokenPrefix(req), { app: req.cmsApp ? String(req.cmsApp._id) : undefined });
  });
  next();
}

function resetAlerts() { busy.reset(); rateLimited.reset(); tokenInvalid.reset(); }

module.exports = { burstAlert, watchResponses, resetAlerts };
