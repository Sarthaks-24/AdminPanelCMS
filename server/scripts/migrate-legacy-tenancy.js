require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const contentChanged = require('../lib/onContentChanged');

const collections = ['profiles', 'resumes', 'projects', 'skills', 'socials', 'experiences', 'educations', 'certifications'];
const visibleCollections = new Set(['projects', 'skills', 'socials', 'experiences', 'educations', 'certifications']);

function databaseFromUri(uri) {
  return decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]);
}

async function migrate() {
  const uri = process.env.MONGODB_URI;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const confirmAt = process.argv.indexOf('--confirm');
  const confirmed = confirmAt >= 0 ? process.argv[confirmAt + 1] : undefined;
  if (!uri || !email) throw new Error('Configure MONGODB_URI and ADMIN_EMAIL first.');
  const dbName = databaseFromUri(uri);
  if (!confirmed || confirmed !== dbName) throw new Error(`Refusing migration. Review backup and target, then pass --confirm ${dbName}.`);

  await mongoose.connect(uri, { maxPoolSize: 2, autoIndex: false });
  try {
    console.log(`Migration target host=${mongoose.connection.host} database=${mongoose.connection.name}`);
    let user = await User.findOne({ email });
    if (!user) {
      // The legacy Admin stores the same bcrypt hash in `password`; preserve it during the identity model transition.
      // This read uses the same narrow native-collection exemption as the owner assignment below.
      const legacyAdmin = await mongoose.connection.db.collection('admins').findOne({ email });
      if (!legacyAdmin?.password) throw new Error(`No User or legacy Admin exists for ADMIN_EMAIL=${email}.`);
      user = await User.create({ email, passwordHash: legacyAdmin.password, emailVerifiedAt: new Date(), status: 'active', tokenVersion: 0 });
      console.log('Created verified User identity from the existing legacy Admin credentials.');
    }
    const db = mongoose.connection.db;
    let contentWasChanged = false;
    for (const name of collections) {
      const filter = { $or: [{ owner: { $exists: false } }, { owner: null }] };
      const update = { $set: { owner: user._id } };
      if (visibleCollections.has(name)) update.$set.visibility = 'published';
      // ownerGuard-exemption: legacy tenant migration requires native collection updates
      const collection = db.collection(name);
      const result = await collection.updateMany(filter, update);
      contentWasChanged ||= result.modifiedCount > 0;
      console.log(`${name}: assignedOwner=${result.modifiedCount}`);
    }
    for (const [name, indexName] of [['projects', 'slug_1'], ['skills', 'name_1']]) {
      const collection = db.collection(name);
      const indexes = await collection.indexes().catch((error) => error.codeName === 'NamespaceNotFound' || error.code === 26 ? [] : Promise.reject(error));
      if (indexes.some((index) => index.name === indexName)) {
        await collection.dropIndex(indexName);
        console.log(`${name}: dropped ${indexName}`);
      }
    }
    if (contentWasChanged) await contentChanged.onContentChanged(user._id);
    console.log('Legacy tenancy migration complete. Run npm run setup to create tenant-scoped indexes.');
  } finally { await mongoose.disconnect(); }
}

migrate().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
