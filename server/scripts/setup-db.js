require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Profile = require('../models/Profile');
const Social = require('../models/Social');
const Skill = require('../models/Skill');
const Project = require('../models/Project');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const Resume = require('../models/Resume');
const App = require('../models/App');
const assertNoLegacyGlobalIndexes = require('../lib/legacyIndexPreflight');

const models = [User, Profile, Social, Skill, Project, Experience, Education, Certification, Resume, App];
// ownerGuard-exemption: setup preflight and confirmed fresh cleanup use native database APIs

function getTargetDatabase(uri) {
  const parsed = new URL(uri);
  return { host: parsed.hostname, database: decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0]) };
}

async function setupDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const fresh = process.argv.includes('--fresh') || process.argv.includes('--clean');
  const confirmIndex = process.argv.indexOf('--confirm');
  const confirmedDatabase = confirmIndex >= 0 ? process.argv[confirmIndex + 1] : undefined;
  if (!mongoUri || !email || !password) throw new Error('Configure MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD first.');
  const target = getTargetDatabase(mongoUri);
  if (fresh && (!confirmedDatabase || confirmedDatabase !== target.database)) {
    throw new Error(`Refusing fresh setup. Re-run with --fresh --confirm ${target.database} after reviewing and backing up the target.`);
  }

  await mongoose.connect(mongoUri, { maxPoolSize: 10, autoIndex: false });
  try {
    console.log(`Connected target host=${mongoose.connection.host} database=${mongoose.connection.name}`);
    if (!fresh) await assertNoLegacyGlobalIndexes(mongoose.connection.db);
    if (fresh) {
      const collectionNames = ['admins', 'profiles', 'socials', 'skills', 'projects', 'experiences', 'educations', 'certifications', 'resumes', 'apps'];
      console.log(`Fresh setup confirmed for database ${confirmedDatabase}; dropping legacy content collections and indexes.`);
      for (const name of collectionNames) {
        try { await mongoose.connection.db.dropCollection(name); }
        catch (error) { if (error.codeName !== 'NamespaceNotFound' && error.code !== 26) throw error; }
      }
    }

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

    for (const model of models) await model.createIndexes();
    const owner = user._id;
    const counts = await Promise.all([
      Project.countDocuments({ owner }), Skill.countDocuments({ owner }),
      Experience.countDocuments({ owner }), Social.countDocuments({ owner }),
    ]);
    const resume = await Resume.findOne({ owner });
    console.log(`Indexes ready. projects=${counts[0]}; skills=${counts[1]}; experience=${counts[2]}; socials=${counts[3]}; resume=${resume ? 'configured' : 'not configured'}`);
  } finally {
    await mongoose.disconnect();
  }
}

setupDatabase().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
