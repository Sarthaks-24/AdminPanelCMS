require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');
const mailer = require('../lib/mailer');
const { notifyExpiringTokens, warningDays } = require('../lib/tokenExpiryNotice');

// Manual run of the expiry notices. The API server already runs the same job daily in process
// (TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS); this script is for a one-off catch-up.
async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  if (!mailer.isConfigured()) throw new Error('Configure Resend before sending token expiry notifications.');
  warningDays();
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 3 });
  try {
    const { tokens, failed, deferred } = await notifyExpiringTokens();
    console.log(`Token expiry notifications complete: ${tokens} token(s) notified; ${failed} delivery failure(s); ${deferred} deferred by the mail budget.`);
    if (failed) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
