require('dotenv').config();
const mongoose = require('mongoose');
const Resume = require('../models/Resume');

/**
 * update-resume.js
 *
 * Updates or creates the single resume link entry in the database.
 * The link is pulled from the RESUME_DRIVE_URL environment variable in .env,
 * or can be passed directly as a command-line argument:
 *   node scripts/update-resume.js "https://drive.google.com/file/d/YOUR_ID/view?usp=sharing"
 */
async function updateResume() {
  console.log('====================================================');
  console.log('       RESUME LINK DATABASE UPDATER & SYNC          ');
  console.log('====================================================');

  // 1. Get the URL from CLI arguments or environment variables
  const cliUrl = process.argv[2];
  const envUrl = process.env.RESUME_DRIVE_URL || process.env.RESUME_URL;
  const resumeUrl = (cliUrl || envUrl || '').trim();

  if (!resumeUrl) {
    console.error('\n[Error] No resume URL provided!');
    console.error('Please either:');
    console.error(' 1. Define RESUME_DRIVE_URL in server/.env:');
    console.error('    RESUME_DRIVE_URL=https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing');
    console.error(' 2. Or pass it as a command line argument:');
    console.error('    npm run update-resume -- "https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing"\n');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('[Error] MONGODB_URI is not defined in server/.env');
    process.exit(1);
  }

  try {
    console.log('\n[1/3] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log(`[OK] Connected successfully to database: ${mongoose.connection.name}`);

    console.log('\n[2/3] Upserting single resume row in database...');
    // Find the existing single resume or create one
    let resume = await Resume.findOne();

    if (resume) {
      resume.resumeUrl = resumeUrl;
      resume.lastUpdated = new Date();
      await resume.save();
      console.log(`[OK] Existing resume entry updated.`);
    } else {
      resume = await Resume.create({
        resumeUrl,
        lastUpdated: new Date(),
      });
      console.log(`[OK] New resume entry created with ID: ${resume._id}`);
    }

    // Guarantee singleton: remove any duplicate entries if they somehow exist
    const excess = await Resume.deleteMany({ _id: { $ne: resume._id } });
    if (excess.deletedCount > 0) {
      console.log(`[Clean] Removed ${excess.deletedCount} duplicate resume entries.`);
    }

    // Ensure index/model initialization
    await Resume.init();

    const totalRows = await Resume.countDocuments();

    console.log('\n====================================================');
    console.log('              RESUME SYNC COMPLETE                  ');
    console.log('====================================================');
    console.log(`Database Name  : ${mongoose.connection.name}`);
    console.log(`Collection     : resumes (single row guaranteed)`);
    console.log(`Total Rows     : ${totalRows}`);
    console.log(`Document ID    : ${resume._id}`);
    console.log(`Resume Drive URL: ${resume.resumeUrl}`);
    console.log(`Last Updated   : ${resume.lastUpdated.toISOString()}`);
    console.log('====================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n[Error] Failed to update resume link in database:');
    console.error(error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

updateResume();
