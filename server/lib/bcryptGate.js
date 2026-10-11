// bcryptjs is pure JavaScript on the main thread. A login flood that rotates emails turns into a queue of
// cost-10 compares that stalls every request in the process, /v1 included. This semaphore caps how many run at
// once; a caller that finds it full gets `null` back and answers 503 `busy` instead of queueing more CPU work.
const positiveInt = (value, fallback) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};
const limit = () => positiveInt(process.env.BCRYPT_MAX_CONCURRENT, 4);

let active = 0;

// Returns a release function, or null when every slot is taken.
function acquire() {
  if (active >= limit()) return null;
  active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active -= 1;
  };
}

// Runs fn inside a slot. Resolves { busy: true } without calling fn when the gate is full.
async function withBcryptSlot(fn) {
  const release = acquire();
  if (!release) return { busy: true };
  try { return { busy: false, value: await fn() }; } finally { release(); }
}

function inFlight() { return active; }

module.exports = { acquire, withBcryptSlot, inFlight };
