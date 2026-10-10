// Resolved from this file, not the working directory, so cron jobs and `node server/server.js` find it too.
require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });
const { applyMode } = require('../lib/envMode');
const { databaseNameFor } = require('../lib/mongoConnect');

const mode = applyMode();

// Printed by the server and by every script, so a destructive command never runs against the wrong database unnoticed.
if (mode !== 'test') {
  const database = process.env.MONGODB_URI ? databaseNameFor(process.env.MONGODB_URI) : '(MONGODB_URI not set)';
  console.error(`[Env] MODE=${mode} · database ${database}`);
}

module.exports = { mode };
