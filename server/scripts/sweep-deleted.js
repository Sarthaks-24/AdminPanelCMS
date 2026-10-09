require('dotenv').config();
const mongoose = require('mongoose');
const { sweepDeletedAccounts } = require('../lib/sweepDeleted');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 2 });
  try {
    console.log(`Deleted-account sweep complete: ${await sweepDeletedAccounts()} account(s).`);
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
