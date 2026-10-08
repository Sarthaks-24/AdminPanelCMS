require('dotenv').config();
const mongoose = require('mongoose');

const collections = ['users', 'admins', 'profiles', 'socials', 'skills', 'projects', 'experiences', 'educations', 'certifications', 'resumes'];
const visibleCollections = new Set(['projects', 'skills', 'socials', 'experiences', 'educations', 'certifications']);
// ownerGuard-exemption: read-only database inventory uses native commands

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 2, autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    console.log(`Read-only target host=${mongoose.connection.host} database=${mongoose.connection.name}`);
    for (const name of collections) {
      try {
        const [count, owned, published, indexResult] = await Promise.all([
          mongoose.connection.db.command({ count: name, query: {} }),
          mongoose.connection.db.command({ count: name, query: { owner: { $exists: true } } }),
          visibleCollections.has(name)
            ? mongoose.connection.db.command({ count: name, query: { visibility: 'published' } })
            : Promise.resolve({ n: '-' }),
          mongoose.connection.db.command({ listIndexes: name, cursor: { batchSize: 100 } }),
        ]);
        const indexes = (indexResult.cursor.firstBatch || []).map((index) => `${index.name} ${JSON.stringify(index.key)}${index.unique ? ' unique' : ''}`);
        console.log(`${name}: documents=${count.n}; owned=${owned.n}; published=${published.n}; indexes=${indexes.join(' | ') || '(none)'}`);
      } catch (error) {
        if (error.codeName === 'NamespaceNotFound' || error.code === 26) console.log(`${name}: collection absent`);
        else throw error;
      }
    }
  } finally { await mongoose.disconnect(); }
}

run().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
