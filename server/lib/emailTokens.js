const crypto = require('node:crypto');
const EmailToken = require('../models/EmailToken');

function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function inviteDigest(value) {
  const pepper = process.env.INVITE_CODE_PEPPER || process.env.JWT_SECRET;
  if (!pepper) throw new Error('JWT_SECRET or INVITE_CODE_PEPPER is required to hash invite codes');
  return crypto.createHmac('sha256', pepper).update(`portfolio-invite:v1:${value}`).digest('hex');
}

async function issueEmailToken(userId, type) {
  if (!['verify', 'reset'].includes(type)) throw new TypeError('Unsupported email token type');
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + (type === 'verify' ? 24 : 1) * 60 * 60 * 1000);
  await EmailToken.updateMany({ user: userId, type, usedAt: null }, { $set: { usedAt: new Date() } });
  await EmailToken.create({ user: userId, type, hash: digest(token), expiresAt });
  return token;
}

async function consumeEmailToken(token, type) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
  const now = new Date();
  return EmailToken.findOneAndUpdate(
    { hash: digest(token), type, usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
    { returnDocument: 'before' },
  ).select('user type').lean();
}

module.exports = { digest, inviteDigest, issueEmailToken, consumeEmailToken };
