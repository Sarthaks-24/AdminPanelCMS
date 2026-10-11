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
      connection.getClient().db('admin').command({ ping: 1 }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ping timeout')), timeoutMs); }),
    ]);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'mongo_ping_failed' };
  } finally { clearTimeout(timer); }
}

module.exports = { checkReady, setShuttingDown, isShuttingDown };
