const mongoose = require('mongoose');
const logger = require('./logger');
const { envNumber } = require('./envNumber');

// Atlas M0 stops accepting writes for every tenant at 512 MB. This check runs dbStats in process every few
// minutes; at STORAGE_BLOCK_PERCENT of DB_STORAGE_CAP_BYTES it closes signup and refuses content writes with a
// clear 503 `storage_full` (deletes still work, they free space), so the database never reaches the hard wall.
// State is in process memory and refreshed by the timer; a failed check keeps the last known state.
const capBytes = () => envNumber('DB_STORAGE_CAP_BYTES');
const blockPercent = () => Math.min(envNumber('STORAGE_BLOCK_PERCENT'), 100);
const warnPercent = () => Math.min(envNumber('STORAGE_WARN_PERCENT'), blockPercent());

const state = { full: false, percent: null, usedBytes: null, checkedAt: null };

// ownerGuard-exemption: dbStats reads database-wide size counters only, never documents
const readStats = () => mongoose.connection.db.stats();

// Re-reads the size and updates the shared state. `stats` is injectable for tests.
async function checkStorage({ stats = readStats } = {}) {
  const result = await stats();
  const used = Number(result?.storageSize || 0) + Number(result?.indexSize || 0);
  const percent = (used / capBytes()) * 100;
  const wasFull = state.full;
  Object.assign(state, { full: percent >= blockPercent(), percent: Math.round(percent * 10) / 10, usedBytes: used, checkedAt: new Date() });
  if (state.full && !wasFull) logger.alert('storage_full', { percent: state.percent, usedBytes: used, capBytes: capBytes() });
  else if (!state.full && wasFull) logger.event('storage_recovered', { percent: state.percent });
  else if (!state.full && percent >= warnPercent()) logger.alert('storage_high', { percent: state.percent, usedBytes: used, capBytes: capBytes() });
  return { ...state };
}

function isStorageFull() { return state.full; }
function storageStatus() { return { ...state }; }
function setStorageFull(full) { state.full = Boolean(full); } // test hook

const STORAGE_FULL = { success: false, error: 'storage_full', message: 'The service is out of storage space, so changes cannot be saved right now. Deleting items still works. Please try again later.' };

// Express middleware for content and App routes: reads and deletes pass, every other write is refused while full.
function rejectWritesWhenFull(req, res, next) {
  if (!state.full || ['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) return next();
  // Bulk delete is a POST but frees space.
  if (/\/bulk-delete\/?$/.test(req.path)) return next();
  return res.status(503).json({ ...STORAGE_FULL, requestId: req.id });
}

// Runs once shortly after boot and then every STORAGE_CHECK_INTERVAL_MINUTES (blank = 10; only an explicit 0 disables).
function startStorageMonitor({ log = logger } = {}) {
  const minutes = envNumber('STORAGE_CHECK_INTERVAL_MINUTES');
  if (minutes <= 0) {
    if (process.env.NODE_ENV === 'production') log.warn({ event: 'storage_guard_disabled' }, 'storage guard DISABLED: STORAGE_CHECK_INTERVAL_MINUTES=0, nothing stops writes before the database cap');
    return null;
  }
  const run = async () => {
    try { await checkStorage(); } catch (error) { log.error({ err: error }, 'storage check failed'); }
  };
  const first = setTimeout(run, 5_000);
  const timer = setInterval(run, minutes * 60 * 1000);
  first.unref(); timer.unref();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { checkStorage, isStorageFull, storageStatus, setStorageFull, rejectWritesWhenFull, startStorageMonitor, STORAGE_FULL };
