// Six-digit invite codes are easy to share but only have 1M values, so guessing is capped globally:
// once too many wrong codes are submitted in an hour (from any number of IPs), invite signups pause.
// Attempts are reserved before the lookup so a burst of parallel guesses cannot slip past the limit.
const WINDOW_MS = 60 * 60 * 1000;
const attempts = [];

const limit = () => {
  const value = Number(process.env.INVITE_FAILURE_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 100;
};

function prune(now) {
  while (attempts.length && now - attempts[0].at > WINDOW_MS) attempts.shift();
}

// Returns a ticket, or null when locked. Call release(ticket) when the code turned out valid.
function reserve(now = Date.now()) {
  prune(now);
  if (attempts.length >= limit()) return null;
  const ticket = { at: now };
  attempts.push(ticket);
  return ticket;
}

function release(ticket) {
  const index = attempts.indexOf(ticket);
  if (index >= 0) attempts.splice(index, 1);
}

function reset() { attempts.length = 0; }

module.exports = { reserve, release, reset };
