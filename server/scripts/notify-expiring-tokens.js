require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');
const ApiToken = require('../models/ApiToken');
const User = require('../models/User');
const mailer = require('../lib/mailer');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  if (!mailer.isConfigured()) throw new Error('Configure Resend before sending token expiry notifications.');
  const days = Number(process.env.TOKEN_EXPIRY_WARNING_DAYS || 7);
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('TOKEN_EXPIRY_WARNING_DAYS must be an integer from 1 to 30.');
  const now = new Date();
  const deadline = new Date(now.getTime() + days * 86_400_000);
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 3 });
  try {
    const tokens = await ApiToken.find({ revokedAt: null, expiryWarningSentAt: null, expiresAt: { $gt: now, $lte: deadline } })
      .select('_id owner prefix label expiresAt').sort({ expiresAt: 1 }).lean();
    const byOwner = new Map();
    for (const token of tokens) {
      const owner = String(token.owner);
      if (!byOwner.has(owner)) byOwner.set(owner, []);
      byOwner.get(owner).push(token);
    }
    const users = await User.find({ _id: { $in: [...byOwner.keys()] }, status: 'active' }).select('_id email').lean();
    let sent = 0;
    let failed = 0;
    for (const user of users) {
      const group = byOwner.get(String(user._id));
      try {
        await mailer.sendTokenExpiryWarning(user, group);
        await ApiToken.updateMany({ _id: { $in: group.map((token) => token._id) }, owner: user._id, expiryWarningSentAt: null }, { $set: { expiryWarningSentAt: new Date() } });
        sent += group.length;
      } catch {
        failed += group.length;
      }
    }
    console.log(`Token expiry notifications complete: ${sent} token(s) notified; ${failed} delivery failure(s).`);
    if (failed) process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
