require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Profile = require('../models/Profile');
const Social = require('../models/Social');
const Skill = require('../models/Skill');
const Project = require('../models/Project');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Resume = require('../models/Resume');

/**
 * setup-db.js
 * 
 * Production database initializer for the Portfolio & Resume CMS.
 * 
 * Usage:
 *   node scripts/setup-db.js           # Safe init: builds indexes and ensures admin exists without deleting data
 *   node scripts/setup-db.js --fresh   # Fresh start: wipes existing data and reinitializes empty collections
 */
async function setupDatabase() {
  console.log('====================================================');
  console.log('       PORTFOLIO CMS DATABASE SETUP & INITIALIZER   ');
  console.log('====================================================');

  const isFresh = process.argv.includes('--fresh') || process.argv.includes('--clean');
  const mongoUri = process.env.MONGODB_URI;
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // 1. Validate environment
  if (!mongoUri) {
    console.error('[Error] MONGODB_URI is not defined in server/.env');
    process.exit(1);
  }

  if (!adminEmail || !adminPassword) {
    console.error('[Error] ADMIN_EMAIL or ADMIN_PASSWORD is not defined in server/.env');
    console.error('Please configure them before running this setup script.');
    process.exit(1);
  }

  try {
    // 2. Connect to MongoDB
    console.log('\n[1/3] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log(`[OK] Connected successfully to database: ${mongoose.connection.name}`);

    // 3. If --fresh flag is passed, wipe existing content collections
    if (isFresh) {
      console.log('\n[!] --fresh flag detected: Wiping existing content collections for a clean start...');
      const pDel = await Profile.deleteMany({});
      const sDel = await Social.deleteMany({});
      const skDel = await Skill.deleteMany({});
      const projDel = await Project.deleteMany({});
      const expDel = await Experience.deleteMany({});
      const eduDel = await Education.deleteMany({});
      const certDel = await Certification.deleteMany({});
      const resDel = await Resume.deleteMany({});
      console.log(`[Clean] Cleared collections across all 8 modules.`);
    }

    // 4. Setup / Upsert Admin Account
    console.log('\n[2/3] Configuring Admin User account...');
    const normalizedEmail = adminEmail.toLowerCase().trim();

    let admin = await Admin.findOne({ email: normalizedEmail });
    if (admin) {
      console.log(`Found existing admin user (${normalizedEmail}). Updating password...`);
      admin.password = adminPassword; // pre('save') hook hashes this password
      await admin.save();
      console.log(`[OK] Admin password updated successfully for: ${normalizedEmail}`);
    } else {
      console.log(`Creating initial admin user: ${normalizedEmail}...`);
      admin = await Admin.create({
        email: normalizedEmail,
        password: adminPassword,
      });
      console.log(`[OK] Admin user created successfully with ID: ${admin._id}`);
    }

    // 5. Ensure Database Indexes across all 8 collections
    console.log('\n[3/3] Verifying and building collection indexes...');
    await Admin.init();
    await Profile.init();
    await Social.init();
    await Skill.init();
    await Project.init();
    await Experience.init();
    await Education.init();
    await Certification.init();
    await Resume.init();
    console.log('[OK] Indexes verified for all 8 collections.');

    // 6. Diagnostics Summary
    const projectCount = await Project.countDocuments();
    const experienceCount = await Experience.countDocuments();
    const skillsCount = await Skill.countDocuments();
    const socialsCount = await Social.countDocuments();
    const resumeDoc = await Resume.findOne();

    console.log('\n====================================================');
    console.log('                SETUP SUMMARY                       ');
    console.log('====================================================');
    console.log(`Database Name     : ${mongoose.connection.name}`);
    console.log(`Admin Email       : ${normalizedEmail}`);
    console.log(`Active Projects   : ${projectCount}`);
    console.log(`Active Skills     : ${skillsCount}`);
    console.log(`Active Experiences: ${experienceCount}`);
    console.log(`Active Socials    : ${socialsCount}`);
    console.log(`Resume Drive Link : ${resumeDoc ? resumeDoc.resumeUrl : 'None (configure in Admin Panel)'}`);
    console.log('\nYou can now log in to the CMS Dashboard with:');
    console.log(`Email    : ${normalizedEmail}`);
    console.log('Password : (value of ADMIN_PASSWORD from your server/.env)');
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n[Error] Database setup failed:');
    console.error(error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

setupDatabase();
