// Wrong invite codes are capped per source IP (INVITE_IP_FAILURE_LIMIT per hour, default 10) and, as a
// backstop against distributed guessing, globally (INVITE_FAILURE_LIMIT per hour, default 2,000). Attempts
// are reserved before the lookup so a burst of parallel guesses cannot slip past either limit, and released
// again when the code turns out to be valid.
const WINDOW_MS = 60 * 60 * 1000;
const attempts = [];
const byIp = new Map();

const positiveInt = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};
const globalLimit = () => positiveInt(process.env.INVITE_FAILURE_LIMIT, 2000);
const ipLimit = () => positiveInt(process.env.INVITE_IP_FAILURE_LIMIT, 10);

function prune(list, now) {
  while (list.length && now - list[0].at > WINDOW_MS) list.shift();
}

// Returns a ticket, or null when the IP or the service is locked. Call release(ticket) when the code was valid.
function reserve(ip = 'unknown', now = Date.now()) {
  prune(attempts, now);
  const key = String(ip);
  const own = byIp.get(key) || [];
  prune(own, now);
  if (own.length === 0) byIp.delete(key); else byIp.set(key, own);
  if (attempts.length >= globalLimit() || own.length >= ipLimit()) return null;
  const ticket = { at: now, ip: key };
  attempts.push(ticket);
  own.push(ticket);
  byIp.set(key, own);
  if (byIp.size > 100_000) byIp.delete(byIp.keys().next().value);
  return ticket;
}

function release(ticket) {
  if (!ticket) return;
  const index = attempts.indexOf(ticket);
  if (index >= 0) attempts.splice(index, 1);
  const own = byIp.get(ticket.ip);
  if (own) {
    const ownIndex = own.indexOf(ticket);
    if (ownIndex >= 0) own.splice(ownIndex, 1);
    if (own.length === 0) byIp.delete(ticket.ip);
  }
}

function reset() { attempts.length = 0; byIp.clear(); }

module.exports = { reserve, release, reset };
