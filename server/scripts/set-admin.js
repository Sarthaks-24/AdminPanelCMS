require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

/**
 * set-admin.js
 * 
 * Standalone tool to create or update Admin login credentials in MongoDB.
 * 
 * Usage:
 *   node scripts/set-admin.js <email> <password>
 *   npm run admin -- <email> <password>
 * 
 * If arguments are omitted, credentials are read from server/.env:
 *   ADMIN_EMAIL and ADMIN_PASSWORD
 */
async function setAdmin() {
  console.log('====================================================');
  console.log('         ADMIN LOGIN CREDENTIAL MANAGER             ');
  console.log('====================================================');

  const cliEmail = process.argv[2];
  const cliPassword = process.argv[3];

  const email = (cliEmail || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = (cliPassword || process.env.ADMIN_PASSWORD || '').trim();

  if (!email || !password) {
    console.error('\n[Error] Missing admin credentials!');
    console.error('Usage:');
    console.error('  node scripts/set-admin.js <email> <password>');
    console.error('  npm run admin -- <email> <password>');
    console.error('Or set ADMIN_EMAIL and ADMIN_PASSWORD in your server/.env file.\n');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('\n[Error] Password must be at least 6 characters long.\n');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('\n[Error] MONGODB_URI is not defined in server/.env\n');
    process.exit(1);
  }

  try {
    console.log('\n[1/2] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log(`[OK] Connected to database: ${mongoose.connection.name}`);

    console.log('\n[2/2] Updating Admin account credentials...');
    let admin = await Admin.findOne({ email });

    if (admin) {
      admin.password = password; // pre('save') hook will hash with bcrypt
      await admin.save();
      console.log(`[OK] Existing admin password updated for: ${email}`);
    } else {
      admin = await Admin.create({ email, password });
      console.log(`[OK] Created new admin user: ${email} (ID: ${admin._id})`);
    }

    console.log('\n====================================================');
    console.log('           ADMIN CREDENTIALS UPDATED!               ');
    console.log('====================================================');
    console.log(`Email    : ${email}`);
    console.log(`Password : ${password.replace(/./g, '*')}`);
    console.log(`Status   : Active & Ready for Login at /admin/login`);
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n[Error] Failed to set admin credentials:');
    console.error(error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

setAdmin();
