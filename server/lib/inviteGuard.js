// Wrong invite codes are capped per source (INVITE_IP_FAILURE_LIMIT per hour, default 10). The caller passes the
// source already grouped (`ipKeyGenerator(req.ip, 48)`), so one IPv6 allocation is one source. Attempts are
// reserved before the lookup so a burst of parallel guesses cannot slip past the limit, and released again when
// the code turns out to be valid. There is no global lock (SEC8): distributed failures raise the
// `invite_failures_high` alert in the auth controller instead of closing invites for everyone.
const WINDOW_MS = 60 * 60 * 1000;
const byIp = new Map();

const { envNumber } = require('./envNumber');

const ipLimit = () => envNumber('INVITE_IP_FAILURE_LIMIT');

function prune(list, now) {
  while (list.length && now - list[0].at > WINDOW_MS) list.shift();
}

// Returns a ticket, or null when the source is locked. Call release(ticket) when the code was valid.
function reserve(ip = 'unknown', now = Date.now()) {
  const key = String(ip);
  const own = byIp.get(key) || [];
  prune(own, now);
  if (own.length === 0) byIp.delete(key); else byIp.set(key, own);
  if (own.length >= ipLimit()) return null;
  const ticket = { at: now, ip: key };
  own.push(ticket);
  byIp.set(key, own);
  if (byIp.size > 100_000) byIp.delete(byIp.keys().next().value);
  return ticket;
}

function release(ticket) {
  if (!ticket) return;
  const own = byIp.get(ticket.ip);
  if (own) {
    const ownIndex = own.indexOf(ticket);
    if (ownIndex >= 0) own.splice(ownIndex, 1);
    if (own.length === 0) byIp.delete(ticket.ip);
  }
}

function reset() { byIp.clear(); }

module.exports = { reserve, release, reset };
