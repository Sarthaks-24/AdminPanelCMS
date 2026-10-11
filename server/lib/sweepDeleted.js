const User = require('../models/User');
const EmailToken = require('../models/EmailToken');
const { cascadeDeletedOwner } = require('../controllers/accountController');
const logger = require('./logger');

const UNVERIFIED_TTL_MS = 48 * 60 * 60 * 1000;
let running = false;

// Finishes the data cascade for accounts marked deleted (idempotent, safe to retry).
async function sweepDeletedAccounts() {
  if (running) return 0;
  running = true;
  try {
    const deleted = await User.find({ status: 'deleted' }).select('_id').lean();
    let done = 0;
    for (const user of deleted) {
      // One failing account must not block the rest; it is retried on the next run.
      try { await cascadeDeletedOwner(user._id); done += 1; } catch (error) { logger.error({ err: error, userId: String(user._id) }, 'sweep: account cascade failed'); }
    }
    return done;
  } finally { running = false; }
}

// Removes signups that never proved their email. Such accounts have no password and no content, so nothing is
// lost, and purging them frees the address for whoever actually owns it. Returns the number removed.
async function purgeUnverified({ now = Date.now(), maxAgeMs = UNVERIFIED_TTL_MS } = {}) {
  const cutoff = new Date(now - maxAgeMs);
  const stale = await User.find({ emailVerifiedAt: null, status: { $ne: 'deleted' }, createdAt: { $lt: cutoff } }).select('_id email').lean();
  let purged = 0;
  for (const user of stale) {
    try {
      // The filter re-checks the state so a user verifying at this very moment is kept.
      const marked = await User.updateOne({ _id: user._id, emailVerifiedAt: null, createdAt: { $lt: cutoff } }, { $set: { status: 'deleted' }, $inc: { tokenVersion: 1 } });
      if (!marked.modifiedCount) continue;
      await EmailToken.deleteMany({ user: user._id });
      await cascadeDeletedOwner(user._id);
      purged += 1;
      logger.event('unverified_purged', { userId: String(user._id) });
    } catch (error) { logger.error({ err: error, userId: String(user._id) }, 'sweep: unverified purge failed'); }
  }
  return purged;
}

// Runs once shortly after boot and then periodically. SWEEP_DELETED_INTERVAL_HOURS=0 disables it.
function startDeletedSweep({ log = console } = {}) {
  const hours = process.env.SWEEP_DELETED_INTERVAL_HOURS === undefined ? 6 : Number(process.env.SWEEP_DELETED_INTERVAL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const run = async () => {
    try {
      const count = await sweepDeletedAccounts();
      if (count) log.log(`[Sweep] Finished cleanup for ${count} deleted account(s)`);
      const purged = await purgeUnverified();
      if (purged) log.log(`[Sweep] Purged ${purged} unverified signup(s) older than 48 h`);
    } catch (error) { log.error(`[Sweep] Failed: ${error.message}`); }
  };
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, hours * 60 * 60 * 1000);
  first.unref(); timer.unref();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { sweepDeletedAccounts, purgeUnverified, startDeletedSweep, UNVERIFIED_TTL_MS };
