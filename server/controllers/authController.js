const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Invite = require('../models/Invite');
const { digest, inviteDigest, issueEmailToken, consumeEmailToken } = require('../lib/emailTokens');
const { usableInviteFilter } = require('../lib/inviteUses');
const mailer = require('../lib/mailer');
const { evictOwner } = require('../lib/cache');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase(), status: 'active' });
    const passwordMatches = user
      ? await user.matchPassword(password)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const identity = { id: user._id, email: user.email, emailVerified: Boolean(user.emailVerifiedAt), role: user.role };
    return res.json({ success: true, token, user: identity, admin: identity });
  } catch (error) {
    return next(error);
  }
};

const verify = (req, res) => {
  const identity = { id: req.user._id, email: req.user.email, emailVerified: Boolean(req.user.emailVerifiedAt), role: req.user.role };
  res.json({ success: true, valid: true, user: identity, admin: identity });
};

const GENERIC_SIGNUP = { success: true, message: 'Check your email to complete registration' };
const GENERIC_RECOVERY = { success: true, message: 'If the account exists, password reset instructions will be sent' };
const validPassword = (value) => typeof value === 'string' && value.length >= 10 && value.length <= 1024;

function signupMode() {
  if (process.env.NODE_ENV === 'production' && process.env.LEGAL_POLICIES_APPROVED !== 'true') return null;
  const mode = process.env.SIGNUP_MODE || 'invite';
  return ['invite', 'open'].includes(mode) ? mode : null;
}

function signupConfig(_req, res) {
  const mode = signupMode();
  return res.json({ success: true, signupEnabled: Boolean(mode), signupMode: mode || 'closed' });
}

async function signup(req, res, next) {
  try {
    const mode = signupMode();
    if (!mode) return res.status(503).json({ success: false, error: 'signup_unavailable' });
    if (process.env.NODE_ENV === 'production' && !mailer.isConfigured()) {
      return res.status(503).json({ success: false, error: 'email_unavailable' });
    }
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body?.password;
    const inviteCode = req.body?.inviteCode;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !validPassword(password)) {
      return res.status(400).json({ success: false, error: 'validation_failed', message: 'Enter a valid email and a password of at least 10 characters' });
    }
    if (req.body?.acceptedTerms !== true || req.body?.acceptedPrivacy !== true) {
      return res.status(400).json({ success: false, error: 'consent_required' });
    }
    let inviteHash;
    let inviteHashes = [];
    if (mode === 'invite') {
      if (typeof inviteCode !== 'string' || !( /^\d{6}$/.test(inviteCode) || (inviteCode.length >= 16 && inviteCode.length <= 128) )) {
        return res.status(400).json({ success: false, error: 'invite_invalid' });
      }
      inviteHashes = /^\d{6}$/.test(inviteCode) ? [inviteDigest(inviteCode), digest(inviteCode)] : [digest(inviteCode)];
      inviteHash = inviteHashes[0];
      const invite = await Invite.exists({ codeHash: { $in: inviteHashes }, ...usableInviteFilter() });
      if (!invite) return res.status(400).json({ success: false, error: 'invite_invalid' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await User.findOne({ email, status: 'active' });
    if (existing) {
      try {
        const resetToken = await issueEmailToken(existing._id, 'reset');
        await mailer.sendAccountExistsNotice(existing, resetToken);
      } catch { /* Never reveal account state or mail delivery outcome. */ }
      return res.status(200).json(GENERIC_SIGNUP);
    }
    let user;
    try {
      user = await User.create({ email, passwordHash, acceptedTermsAt: new Date(), status: 'active' });
    } catch (error) {
      if (error.code === 11000) return res.status(200).json(GENERIC_SIGNUP);
      throw error;
    }
    if (inviteHash) {
      const consumed = await Invite.findOneAndUpdate(
        { codeHash: { $in: inviteHashes }, ...usableInviteFilter() },
        { $inc: { usedCount: 1 }, $set: { usedBy: user._id } }, { returnDocument: 'after' },
      );
      if (!consumed) {
        await User.deleteOne({ _id: user._id });
        return res.status(400).json({ success: false, error: 'invite_invalid' });
      }
    }
    try {
      const token = await issueEmailToken(user._id, 'verify');
      await mailer.sendVerification(user, token);
    } catch { /* Signup remains enumeration-safe; resend is available after mail setup. */ }
    return res.status(200).json(GENERIC_SIGNUP);
  } catch (error) { return next(error); }
}

async function verifyEmail(req, res, next) {
  try {
    const consumed = await consumeEmailToken(req.body?.token, 'verify');
    if (!consumed) return res.status(400).json({ success: false, error: 'token_invalid' });
    await User.updateOne({ _id: consumed.user, status: 'active', emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
    return res.json({ success: true, verified: true });
  } catch (error) { return next(error); }
}

async function resendVerification(req, res, next) {
  try {
    if (req.user.emailVerifiedAt) return res.json({ success: true, message: 'If verification is needed, an email will be sent' });
    const token = await issueEmailToken(req.userId, 'verify');
    try { await mailer.sendVerification(req.user, token); } catch { /* Generic response prevents delivery-state disclosure. */ }
    return res.json({ success: true, message: 'If verification is needed, an email will be sent' });
  } catch (error) { return next(error); }
}

async function forgotPassword(req, res, next) {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254) {
      const user = await User.findOne({ email, status: 'active' });
      if (user) {
        try {
          const token = await issueEmailToken(user._id, 'reset');
          await mailer.sendPasswordReset(user, token);
        } catch { /* Keep response identical for known and unknown emails. */ }
      }
    }
    return res.status(200).json(GENERIC_RECOVERY);
  } catch (error) { return next(error); }
}

async function resetPassword(req, res, next) {
  try {
    if (!validPassword(req.body?.newPassword)) return res.status(400).json({ success: false, error: 'password_invalid', message: 'Password must be at least 10 characters' });
    const consumed = await consumeEmailToken(req.body?.token, 'reset');
    if (!consumed) return res.status(400).json({ success: false, error: 'token_invalid' });
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    const user = await User.findOneAndUpdate({ _id: consumed.user, status: 'active' }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' }).select('_id');
    if (!user) return res.status(400).json({ success: false, error: 'token_invalid' });
    evictOwner(user._id);
    return res.json({ success: true, message: 'Password updated. Please sign in again.' });
  } catch (error) { return next(error); }
}

async function changePassword(req, res, next) {
  try {
    if (typeof req.body?.currentPassword !== 'string' || !validPassword(req.body?.newPassword)) {
      return res.status(400).json({ success: false, error: 'validation_failed', message: 'Enter your current password and a new password of at least 10 characters' });
    }
    const user = await User.findOne({ _id: req.userId });
    if (!user || !(await user.matchPassword(req.body.currentPassword))) return res.status(401).json({ success: false, error: 'credentials_invalid' });
    user.passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    user.tokenVersion += 1;
    await user.save();
    evictOwner(user._id);
    const token = jwt.sign({ sub: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });
    return res.json({ success: true, token });
  } catch (error) { return next(error); }
}

function me(req, res) {
  return res.json({ success: true, user: { id: req.user._id, email: req.user.email, emailVerified: Boolean(req.user.emailVerifiedAt), acceptedTermsAt: req.user.acceptedTermsAt || null, role: req.user.role } });
}

module.exports = { login, verify, signup, signupConfig, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, me };
