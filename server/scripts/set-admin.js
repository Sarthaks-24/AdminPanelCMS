require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo } = require('../lib/mongoConnect');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function setAdmin() {
  const email = String(process.argv[2] || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.argv[3] || process.env.ADMIN_PASSWORD || '').trim();
  if (!email || !password || password.length < 10 || !process.env.MONGODB_URI) {
    throw new Error('Provide MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (at least 10 characters).');
  }
  await connectMongo(process.env.MONGODB_URI, { maxPoolSize: 10 });
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    let user = await User.findOne({ email });
    if (user) {
      user.passwordHash = passwordHash;
      user.emailVerifiedAt = new Date();
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
