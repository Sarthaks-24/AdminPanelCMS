require('dotenv').config();
const readline = require('node:readline/promises');
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
const ApiToken = require('../models/ApiToken');
const EmailToken = require('../models/EmailToken');
const Invite = require('../models/Invite');
const assertNoLegacyGlobalIndexes = require('../lib/legacyIndexPreflight');

const models = [User, Profile, Social, Skill, Project, Experience, Education, Certification, Resume, App, ApiToken, EmailToken, Invite];
// ownerGuard-exemption: production setup preflight uses native database metadata only
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function targetFromUri(uri) {
  const parsed = new URL(uri);
  return { host: parsed.hostname, database: decodeURIComponent(parsed.pathname.replace(/^\//, '').split('/')[0]) };
}

function askHidden(question) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') throw new Error('Run this command from an interactive terminal so the admin password can be entered without echo.');
  return new Promise((resolve, reject) => {
    let value = '';
    const input = process.stdin;
    const wasRaw = input.isRaw;
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    const finish = (answer, error) => {
      input.off('data', onData);
      input.setRawMode(wasRaw || false);
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(answer);
    };
    const onData = (chunk) => {
      for (const character of String(chunk)) {
        if (character === '\u0003') return finish('', new Error('Cancelled.'));
        if (character === '\r' || character === '\n') return finish(value);
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}

async function confirm(prompt, expected) {
  const answer = (await rl.question(`${prompt} `)).trim();
  if (answer !== expected) throw new Error('Confirmation did not match; no further action was taken.');
}

async function main() {
  if (process.env.NODE_ENV !== 'production') throw new Error('Set NODE_ENV=production before running this production database preparation command.');
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI for the production database first.');
  const target = targetFromUri(process.env.MONGODB_URI);
  if (!target.database) throw new Error('MONGODB_URI must include a database name.');
  console.log(`Production target: host=${target.host}; database=${target.database}`);
  await confirm('Type the database name exactly to continue:', target.database);

  await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 5, autoIndex: false });
  try {
    console.log(`Connected to ${mongoose.connection.name}. Checking existing indexes and preparing indexes…`);
    await assertNoLegacyGlobalIndexes(mongoose.connection.db);
    for (const Model of models) await Model.createIndexes();
    console.log('Indexes are ready. No collections were dropped.');

    const email = String(await rl.question('Superadmin email: ')).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.status !== 'active' || !existing.emailVerifiedAt) throw new Error('That account must be active and email-verified before it can be promoted. No account changes were made.');
      await confirm(`Type PROMOTE to grant superadmin to the existing verified account ${email}:`, 'PROMOTE');
      existing.role = 'superadmin';
      existing.tokenVersion += 1;
      await existing.save();
      console.log(`Superadmin is active for ${email}. Sign in again to refresh the session.`);
      return;
    }

    await confirm(`Type CREATE to create a new verified superadmin account for ${email}:`, 'CREATE');
    rl.close();
    const password = await askHidden('Admin password (minimum 12 characters): ');
    const repeated = await askHidden('Confirm admin password: ');
    if (password.length < 12 || password !== repeated) throw new Error('Passwords must match and contain at least 12 characters.');
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ email, passwordHash, emailVerifiedAt: new Date(), role: 'superadmin', status: 'active', tokenVersion: 0 });
    console.log(`Created verified superadmin ${email} in ${mongoose.connection.name}. Store the password securely.`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; }).finally(() => rl.close());
