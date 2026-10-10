require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo, databaseNameFor } = require('../lib/mongoConnect');
const User = require('../models/User');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = String(argument('--email') || '').trim().toLowerCase();
  const confirmedDatabase = argument('--confirm-db');
  if (!email || !process.env.MONGODB_URI) throw new Error('Provide --email and configure MONGODB_URI.');
  const database = databaseNameFor(process.env.MONGODB_URI);
  if (!database || confirmedDatabase !== database) throw new Error(`Refusing role grant. Re-run with --confirm-db ${database} after checking the target database.`);
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 2 });
  try {
    const user = await User.findOne({ email });
    if (!user) throw new Error('No matching user account exists.');
    if (user.status !== 'active' || !user.emailVerifiedAt) throw new Error('Account must be active and email-verified before promotion.');
    if (user.role !== 'superadmin') {
      user.role = 'superadmin';
      user.tokenVersion += 1;
      await user.save();
    }
    console.log(`Superadmin role is active for ${user.email} in ${mongoose.connection.name}. The account must sign in again.`);
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
