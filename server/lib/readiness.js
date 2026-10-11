const mongoose = require('mongoose');

// /readyz state. `shuttingDown` flips on SIGTERM so a load balancer stops routing before the drain.
let shuttingDown = false;
function setShuttingDown(value = true) { shuttingDown = Boolean(value); }
function isShuttingDown() { return shuttingDown; }

async function checkReady({ connection = mongoose.connection, timeoutMs = 2000 } = {}) {
  if (shuttingDown) return { ok: false, reason: 'shutting_down' };
  if (connection.readyState !== 1) return { ok: false, reason: 'mongo_disconnected' };
  let timer;
  try {
    await Promise.race([
      // ownerGuard-exemption: a ping on the admin database reads no collection
      connection.getClient().db('admin').command({ ping: 1 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ping timeout')), timeoutMs); }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'mongo_ping_failed' };
  } finally { clearTimeout(timer); }
}

// /readyz is public and sits above every limiter, so the Mongo ping is shared: one ping per
// READY_CACHE_MS however many probes arrive. Draining and a dropped connection are still seen at once.
const READY_CACHE_MS = 3000;
let cached = null; // { at, promise }
function checkReadyCached({ connection = mongoose.connection, now = Date.now() } = {}) {
  if (shuttingDown) return Promise.resolve({ ok: false, reason: 'shutting_down' });
  if (connection.readyState !== 1) return Promise.resolve({ ok: false, reason: 'mongo_disconnected' });
  if (!cached || now - cached.at >= READY_CACHE_MS) cached = { at: now, promise: checkReady({ connection }) };
  return cached.promise;
}
function resetReadyCache() { cached = null; }

module.exports = { checkReady, checkReadyCached, resetReadyCache, setShuttingDown, isShuttingDown, READY_CACHE_MS };
