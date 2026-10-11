const crypto = require('node:crypto');
const EmailToken = require('../models/EmailToken');

// A recipient may hold a few live links at once (they often request twice); the oldest is retired when a
// fourth is issued. Issuing a new link never kills the ones already in the inbox, so a griefer cannot keep a
// victim's reset link dead by re-requesting. Consuming any link revokes the rest of its type.
const MAX_OUTSTANDING = 3;

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function inviteDigest(value) {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JWT_SECRET;
  if (!pepper) throw new Error('JWT_SECRET or INVITE_CODE_PEPPER is required to hash invite codes');
  return crypto.createHmac('sha256', pepper).update(`portfolio-invite:v1:${value}`).digest('hex');
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

module.exports = { digest, inviteDigest, issueEmailToken, consumeEmailToken, MAX_OUTSTANDING };
