const { mode } = require('../config/loadEnv');
const mongoose = require('mongoose');
const { connectMongo, databaseNameFor } = require('../lib/mongoConnect');
const { assertDataSafety } = require('../lib/validateEnv');
const Invite = require('../models/Invite');
const { inviteDigest, invitePepperFingerprint, pepperFingerprintProblem } = require('../lib/emailTokens');
const { generateInviteCode } = require('../controllers/adminController');

// Usage: npm run invite -- [--count N] [--uses M] [--days D] [--pepper-fp FP]
// In production --pepper-fp is required: copy it from the server's boot log ("invite pepper fingerprint ...").
function rawOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function option(name, fallback) {
  const raw = rawOption(name);
  return raw === undefined ? fallback : Number(raw);
}

async function main() {
  const count = option('--count', 1);
  const maxUses = option('--uses', 1);
  const days = option('--days', 30);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Use --count with an integer from 1 to 100.');
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > Invite.MAX_INVITE_USES) throw new Error(`Use --uses with an integer from 1 to ${Invite.MAX_INVITE_USES}.`);
  if (!Number.isInteger(days) || days < 1 || days > Invite.MAX_INVITE_DAYS) throw new Error(`Use --days with an integer from 1 to ${Invite.MAX_INVITE_DAYS}.`);
  if (!process.env.MONGODB_URI) throw new Error('Configure MONGODB_URI first.');
  // BE-03 / X-06: refuse before connecting when production checks fail (above all a missing pepper, which would
  // mint codes the server can never match). Prefer minting from the Superadmin panel, which uses the server's own env.
  assertDataSafety();
  if (!process.env.INVITE_CODE_PEPPER) console.error('[Invite] INVITE_CODE_PEPPER is not set: codes are hashed with JWT_SECRET, which only matches a server that also has no pepper.');
  console.error(`[Invite] MODE=${mode} · database ${databaseNameFor(process.env.MONGODB_URI)} · ${process.env.INVITE_CODE_PEPPER ? 'hashing with INVITE_CODE_PEPPER' : 'hashing with JWT_SECRET'} · pepper fingerprint ${invitePepperFingerprint() || '(none)'}`);
  // C1: the deployed server may run with a different pepper (Render generates its own); refuse to mint dead codes.
  const pepperProblem = pepperFingerprintProblem(rawOption('--pepper-fp'));
  if (pepperProblem) throw new Error(pepperProblem);
  await connectMongo(process.env.MONGODB_URI);
  try {
    for (let i = 0; i < count; i += 1) {
      let code;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        code = generateInviteCode();
        try {
          await Invite.create({ codeHash: inviteDigest(code), expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000), maxUses });
          break;
        } catch (error) {
          if (error.code !== 11000 || attempt === 9) throw error;
        }
      }
      // Grouped for reading aloud; the server ignores the dashes.
      console.log(code.replace(/(.{4})(?=.)/g, '$1-'));
    }
  } finally { await mongoose.disconnect(); }
}

main().catch((error) => { console.error(`[Error] ${error.message}`); process.exitCode = 1; });
