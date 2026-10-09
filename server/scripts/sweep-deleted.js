require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { cascadeDeletedOwner } = require('../controllers/accountController');

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 2 });
  try {
    const deleted = await User.find({ status: 'deleted' }).select('_id').lean();
    for (const user of deleted) await cascadeDeletedOwner(user._id);
    console.log(`Deleted-account sweep complete: ${deleted.length} account(s).`);
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
