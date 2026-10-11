require('../config/loadEnv');
const mongoose = require('mongoose');
const readline = require('node:readline/promises');
const { connectMongo, databaseNameFor } = require('../lib/mongoConnect');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Usage: npm run admin -- <email> [--yes]
// The password is read from ADMIN_PASSWORD or, failing that, from stdin (piped or typed), never from argv,
// so it does not end up in shell history or the process list.
function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const positional = process.argv.slice(2).filter((value, index, all) => !value.startsWith('--') && all[index - 1] !== '--confirm-db');

async function readPassword() {
  const fromEnv = String(process.env.ADMIN_PASSWORD || '').trim();
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY) {
    let data = '';
    for await (const chunk of process.stdin) data += chunk;
    return data.split(/\r?\n/)[0].trim();
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return String(await rl.question('Password (10+ characters, input is echoed): ')).trim(); } finally { rl.close(); }
}

async function confirm(email, database) {
  if (process.argv.includes('--yes')) return;
  if (!process.stdin.isTTY) throw new Error('Non-interactive run: pass --yes to confirm setting the password for this account.');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Set the password and mark ${email} verified in database "${database}"? Type the email to continue: `);
    if (String(answer).trim().toLowerCase() !== email) throw new Error('Confirmation did not match; nothing was changed.');
  } finally { rl.close(); }
}

async function setAdmin() {
  const email = String(positional[0] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email || !process.env.MONGODB_URI) throw new Error('Provide the email as the first argument (or ADMIN_EMAIL) and configure MONGODB_URI.');
  if (positional[1]) throw new Error('Do not pass the password on the command line; set ADMIN_PASSWORD or pipe it on stdin.');
  const password = await readPassword();
  if (password.length < 10) throw new Error('The password must be at least 10 characters.');
  const database = databaseNameFor(process.env.MONGODB_URI);
  await confirm(email, database);
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 10 });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ email });
    if (user) {
      user.passwordHash = passwordHash;
      user.emailVerifiedAt = user.emailVerifiedAt || new Date();
      user.status = 'active';
      user.tokenVersion += 1;
      await user.save();
    } else {
      user = await User.create({ email, passwordHash, emailVerifiedAt: new Date(), status: 'active', tokenVersion: 0 });
    }
    console.log(`Admin account ready: ${user.email} (${user._id})`);
  } finally {
    await mongoose.disconnect();
  }
}

setAdmin().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
