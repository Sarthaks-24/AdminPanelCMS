require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');
const crypto = require('node:crypto');
const Invite = require('../models/Invite');
const { inviteDigest } = require('../lib/emailTokens');

async function main() {
  const flag = process.argv.indexOf('--count');
  const count = Number(flag >= 0 ? process.argv[flag + 1] : 1);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Use --count with an integer from 1 to 100.');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  await connectMongo(process.env.MONGODB_URI);
  try {
    for (let i = 0; i < count; i += 1) {
      let code;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
        try {
          await Invite.create({ codeHash: inviteDigest(code), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), maxUses: 1 });
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 9) throw error;
        }
      }
      console.log(code);
    }
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
