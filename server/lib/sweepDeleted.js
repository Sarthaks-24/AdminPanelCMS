const User = require('../models/User');
const { cascadeDeletedOwner } = require('../controllers/accountController');

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
      try { await cascadeDeletedOwner(user._id); done += 1; } catch (error) { console.error(`[Sweep] Account ${user._id} failed: ${error.message}`); }
    }
    return done;
  } finally { running = false; }
}

// Runs once shortly after boot and then periodically. SWEEP_DELETED_INTERVAL_HOURS=0 disables it.
function startDeletedSweep({ log = console } = {}) {
  const hours = process.env.SWEEP_DELETED_INTERVAL_HOURS === undefined ? 6 : Number(process.env.SWEEP_DELETED_INTERVAL_HOURS);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  const run = () => sweepDeletedAccounts()
    .then((count) => { if (count) log.log(`[Sweep] Finished cleanup for ${count} deleted account(s)`); })
    .catch((error) => log.error(`[Sweep] Failed: ${error.message}`));
  const first = setTimeout(run, 60_000);
  const timer = setInterval(run, hours * 60 * 60 * 1000);
  first.unref(); timer.unref();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { sweepDeletedAccounts, startDeletedSweep };
