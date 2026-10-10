require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');

const CAP_BYTES = Number(process.env.DB_STORAGE_CAP_BYTES || 512 * 1024 * 1024);
// ownerGuard-exemption: db stats utility uses native database stats and collection inventory

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  if (!Number.isSafeInteger(CAP_BYTES) || CAP_BYTES <= 0) throw new Error('DB_STORAGE_CAP_BYTES must be a positive integer.');
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 2 });
  try {
    const stats = await mongoose.connection.db.stats();
    const used = Number(stats.storageSize || 0) + Number(stats.indexSize || 0);
    const percent = (used / CAP_BYTES) * 100;
    console.log(`Storage: ${percent.toFixed(1)}% of ${(CAP_BYTES / 1024 / 1024).toFixed(0)} MB (${(used / 1024 / 1024).toFixed(1)} MB used)`);
    for (const collection of await mongoose.connection.db.listCollections().toArray()) {
      const value = await mongoose.connection.db.command({ collStats: collection.name });
      console.log(`${collection.name.padEnd(24)} ${((value.storageSize || 0) / 1024).toFixed(0)} KB storage  ${((value.totalIndexSize || 0) / 1024).toFixed(0)} KB indexes  ${value.count || 0} docs`);
    }
    if (percent >= 70) {
      console.error('\nALERT: Storage is at or above 70%. Operator action required: set signup to invite-only (superadmin dashboard, or SIGNUP_MODE=invite) and review upgrade/cleanup options. This command does not change signup configuration.');
      process.exitCode = 2;
    }
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
