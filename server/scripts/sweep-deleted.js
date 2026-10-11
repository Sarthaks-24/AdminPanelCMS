require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');
const { sweepDeletedAccounts, purgeUnverified } = require('../lib/sweepDeleted');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 2 });
  try {
    console.log(`Deleted-account sweep complete: ${await sweepDeletedAccounts()} account(s).`);
    console.log(`Unverified-signup purge complete: ${await purgeUnverified()} account(s) older than 48 h removed.`);
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
