const crypto = require('node:crypto');
const EmailToken = require('../models/EmailToken');

// A recipient may hold a few live links at once (they often request twice); the oldest is retired when a
// fourth is issued. Issuing a new link never kills the ones already in the inbox, so a griefer cannot keep a
// victim's reset link dead by re-requesting. Consuming any link revokes the rest of its type.
const MAX_OUTSTANDING = 3;

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

// BE-03: production never falls back to JWT_SECRET. A CLI run without the pepper would hash codes with a key
// the server does not use, and every invite would then fail as "invalid code" with no error anywhere.
function inviteDigest(value) {
  if (process.env.NODE_ENV === 'production' && !process.env.INVITE_CODE_PEPPER) throw new Error('INVITE_CODE_PEPPER is required in production to hash invite codes');
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JWT_SECRET;
  if (!pepper) throw new Error('JWT_SECRET or INVITE_CODE_PEPPER is required to hash invite codes');
  return crypto.createHmac('sha256', pepper).update(`portfolio-invite:v1:${value}`).digest('hex');
}

// C1: a short, non-reversible fingerprint of the key invite codes are hashed with (the pepper, or JWT_SECRET where
// the server would fall back to it). The server prints it at boot and shows it to superadmins; scripts/create-invites.js
// compares it so a CLI run with a different pepper (e.g. a platform-generated one) cannot mint dead codes.
function invitePepperFingerprint(env = process.env) {
  const pepper = env.INVITE_CODE_PEPPER || (env.NODE_ENV === 'production' ? '' : env.JWT_SECRET);
  if (!pepper) return null;
  return crypto.createHash('sha256').update(`invite-pepper-fp:${pepper}`).digest('hex').slice(0, 8);
}

// Null when the CLI may mint, otherwise the reason it must not. Production requires --pepper-fp to match.
function pepperFingerprintProblem(rawGiven, env = process.env) {
  const actual = invitePepperFingerprint(env);
  const given = rawGiven === undefined || rawGiven === null ? '' : String(rawGiven).trim().toLowerCase();
  if (env.NODE_ENV !== 'production') {
    return given && given !== actual ? `--pepper-fp ${given} does not match this environment's fingerprint ${actual}` : null;
  }
  const advice = 'Copy the fingerprint from the server\'s boot log line ("invite pepper fingerprint ...") and pass it as --pepper-fp <fp>, or mint invites from the Superadmin panel instead (recommended: it uses the server\'s own pepper).';
  if (!given) return `In production, --pepper-fp is required. ${advice}`;
  if (given !== actual) return `--pepper-fp ${given} does not match this environment's INVITE_CODE_PEPPER (fingerprint ${actual}): codes minted here would never be accepted by that server. ${advice}`;
  return null;
}

async function issueEmailToken(userId, type) {
  if (!['verify', 'reset'].includes(type)) throw new TypeError('Unsupported email token type');
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (type === 'verify' ? 24 : 1) * 60 * 60 * 1000);
  const outstanding = await EmailToken.find({ user: userId, type, usedAt: null, expiresAt: { $gt: now } }).select('_id').sort({ createdAt: -1 }).lean();
  const retire = outstanding.slice(MAX_OUTSTANDING - 1).map((doc) => doc._id);
  if (retire.length) await EmailToken.updateMany({ _id: { $in: retire } }, { $set: { usedAt: now } });
  await EmailToken.create({ user: userId, type, hash: digest(token), expiresAt });
  return token;
}

async function consumeEmailToken(token, type) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
  const now = new Date();
  const consumed = await EmailToken.findOneAndUpdate(
    { hash: digest(token), type, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: 'before' },
  ).select('user type').lean();
  if (consumed) await EmailToken.updateMany({ user: consumed.user, type, usedAt: null }, { $set: { usedAt: now } });
  return consumed;
}

module.exports = { digest, inviteDigest, invitePepperFingerprint, pepperFingerprintProblem, issueEmailToken, consumeEmailToken, MAX_OUTSTANDING };
