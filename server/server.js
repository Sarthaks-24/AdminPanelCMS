const { mode } = require('./config/loadEnv');

const validateEnv = require('./lib/validateEnv');
const { warnings } = validateEnv();
for (const warning of warnings) console.warn(`[Config] ${warning}`);

const mongoose = require('mongoose');
const connectDB = require('./config/db');
const app = require('./app');
const logger = require('./lib/logger');
const readiness = require('./lib/readiness');
const { startDeletedSweep } = require('./lib/sweepDeleted');
const { loadActiveTokens } = require('./lib/activeTokens');

const PORT = process.env.PORT || 5000;
const SHUTDOWN_DRAIN_MS = 10_000;

let server = null;
let sweep = null;
let shuttingDown = false;

async function start() {
  await connectDB();
  // The /v1 auth path rejects unknown tokens from this set with zero database work. A failed load
  // is not fatal: requireToken loads it lazily on the first /v1 request instead.
  try {
    const count = await loadActiveTokens();
    logger.info({ count }, 'active token set loaded');
  } catch (err) {
    logger.error({ err }, 'active token set failed to load at boot; it will load on the first /v1 request');
  }
  server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} in ${mode} mode`);
    sweep = startDeletedSweep();
  });
  server.on('error', (err) => {
    logger.error({ err }, 'listen failed');
    process.exitCode = 1;
  });
}

// Graceful stop: readiness goes 503, the listener closes, in-flight requests get up to
// SHUTDOWN_DRAIN_MS, the sweep timer stops, Mongo closes, then the process exits.
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  readiness.setShuttingDown(true);
  logger.info({ signal }, 'shutdown started');
  if (sweep) sweep.stop();
  const force = setTimeout(() => {
    logger.warn({ signal }, `drain exceeded ${SHUTDOWN_DRAIN_MS}ms; exiting now`);
    process.exit(1);
  }, SHUTDOWN_DRAIN_MS);
  force.unref();
  const finish = async () => {
    try { await mongoose.connection.close(); } catch (err) { logger.error({ err }, 'mongo close failed'); }
    logger.info({ signal }, 'shutdown complete');
    process.exit(0);
  };
  if (!server) { finish(); return; }
  server.close(() => { finish(); });
  if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((error) => {
  console.error(`[Server] Failed to start: ${error.message}`);
  process.exitCode = 1;
});
