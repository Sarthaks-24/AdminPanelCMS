const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Invite = require('../models/Invite');
const { digest, inviteDigest, issueEmailToken, consumeEmailToken } = require('../lib/emailTokens');
const { usableInviteFilter } = require('../lib/inviteUses');
const mailer = require('../lib/mailer');
const inviteGuard = require('../lib/inviteGuard');
const { getSignupMode } = require('../lib/signupMode');
const { evictOwner } = require('../lib/cache');
const { setSessionCookie, clearSessionCookie, readSessionCookie } = require('../lib/sessionCookie');
const { TERMS_VERSION, PRIVACY_VERSION } = require('../lib/legal');
const { reserveMail, refundMail, recipientAllowed } = require('../lib/mailBudget');
const { withBcryptSlot } = require('../lib/bcryptGate');
const { takeSignupSlot, releaseSignupSlot } = require('../lib/signupDomainCap');
const { isStorageFull } = require('../lib/storageGuard');
const turnstile = require('../lib/turnstile');
const { burstAlert } = require('../lib/alerts');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('../lib/logger');
const { envNumber } = require('../lib/envNumber');
const { cascadeDeletedOwner } = require('./accountController');

const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_CODE_PATTERN = /^[A-Z2-9]{12}$/;
const ACCOUNT_EXISTS_NOTICE_GAP_MS = 24 * 60 * 60 * 1000;

const GENERIC_SIGNUP = { success: true, message: 'Check your email to complete registration' };
const GENERIC_RECOVERY = { success: true, message: 'If the account exists, password reset instructions will be sent' };
const GENERIC_RESEND = { success: true, message: 'If an unverified account exists for that address, a new link is on its way' };
const LOGIN_FAILED = { success: false, error: 'credentials_invalid', message: 'Invalid credentials or unverified email' };
const BUSY = { success: false, error: 'busy', message: 'The service is busy. Please try again in a few seconds.' };
const SIGNUP_CLOSED = { success: false, error: 'signup_unavailable', message: 'Registration is closed right now' };

// Distributed wrong invite codes no longer lock invites for everyone (SEC8): the 12-character codes have 60 bits,
// so a global lock protects nothing and only hands an attacker a switch. Crossing INVITE_FAILURE_LIMIT per hour
// raises an alert instead, and the per-/48 guard in lib/inviteGuard.js still stops any one source.
const inviteFailures = burstAlert('invite_failures_high', {
  threshold: () => envNumber('INVITE_FAILURE_LIMIT'),
  windowMs: 60 * 60 * 1000,
});
const inviteSource = (req) => ipKeyGenerator(req.ip, 48);
// One alert per locked invite source and per capped domain per hour, however many requests they refuse.
const inviteLocked = burstAlert('invite_locked', { threshold: 1, windowMs: 60 * 60 * 1000 });
const domainCapped = burstAlert('signup_domain_capped', { threshold: 1, windowMs: 60 * 60 * 1000 });

// Optional account-count cap (MAX_ACCOUNTS, blank or 0 = no cap). Counts every account that is not deleted.
// A value that is not a whole number is refused at production boot (lib/envNumber.js), never read as "no cap".
function accountCap() { return envNumber('MAX_ACCOUNTS'); }

const validPassword = (value) => typeof value === 'string' && value.length >= 10 && value.length <= 1024;
const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');
const validEmail = (email) => EMAIL_PATTERN.test(email) && email.length <= 254;
const identityOf = (user) => ({ id: user._id, email: user.email, emailVerified: Boolean(user.emailVerifiedAt), role: user.role });
const signSession = (user) => jwt.sign({ sub: user._id, tv: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Mail is never awaited on the public paths: the response timing must not reveal whether an account exists,
// and a slow provider must not hold a signup. Failures are logged with the template and request id.
function sendInBackground(promise, template, req) {
  promise.catch((error) => logger.event('mail_failed', { template, reqId: req.id, err: error?.message || String(error) }));
}

function publicApiBase() {
  const value = String(process.env.PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
  return value || null;
}

// Codes are often pasted as "ABCD-EFGH-JKLM" or with spaces; separators are ignored and letters upper-cased.
function normalizeInviteCode(raw) {
  if (typeof raw !== 'string') return null;
  const compact = raw.trim().replace(/[\s-]/g, '');
  if (INVITE_CODE_PATTERN.test(compact.toUpperCase())) return compact.toUpperCase();
  const trimmed = raw.trim();
  // Long opaque codes issued before the 12-character format.
  if (trimmed.length >= 16 && trimmed.length <= 128) return trimmed;
  return null;
}

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }
    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized, status: { $ne: 'deleted' } });
    // Unverified accounts have no password yet; legacy unverified ones are refused until they verify.
    const usable = Boolean(user && user.passwordHash && user.emailVerifiedAt);
    // Every attempt costs one bcrypt compare (a dummy one for unknown addresses, so timing reveals nothing).
    // The gate sheds load with 503 busy instead of letting a flood queue CPU work in front of /v1.
    const compare = await withBcryptSlot(() => (usable ? user.matchPassword(password) : bcrypt.compare(password, DUMMY_PASSWORD_HASH)));
    if (compare.busy) {
      res.set('Retry-After', '2');
      return res.status(503).json(BUSY);
    }
    const passwordMatches = compare.value;
    if (!usable || !passwordMatches) {
      logger.event('login_failed', { reqId: req.id, emailHash: digest(normalized).slice(0, 16), reason: !user ? 'unknown' : !usable ? 'unverified' : 'password' });
      return res.status(401).json(LOGIN_FAILED);
    }
    if (user.status !== 'active') {
      logger.event('login_refused', { reqId: req.id, userId: String(user._id), status: user.status });
      return res.status(401).json({ success: false, error: 'account_suspended', message: 'This account is suspended. Contact support if you think this is a mistake.' });
    }
    const identity = identityOf(user);
    setSessionCookie(res, signSession(user));
    logger.event('login_ok', { reqId: req.id, userId: String(user._id) });
    return res.json({ success: true, user: identity, admin: identity });
  } catch (error) {
    return next(error);
  }
};

const verify = (req, res) => {
  const identity = identityOf(req.user);
  res.json({ success: true, valid: true, user: identity, admin: identity });
};

async function signupConfig(_req, res, next) {
  try {
    const mode = await getSignupMode();
    const open = Boolean(mode) && !isStorageFull();
    return res.json({ success: true, signupEnabled: open, signupMode: open ? mode : 'closed', publicApiBase: publicApiBase(), turnstileSiteKey: turnstile.siteKey() });
  } catch (error) { return next(error); }
}

// Email-first: no password is taken here. Whoever opens the verification link chooses the password.
async function signup(req, res, next) {
  try {
    const mode = await getSignupMode();
    if (!mode) return res.status(503).json(SIGNUP_CLOSED);
    // Storage guard (lib/storageGuard.js) and the optional account cap close signup for every address alike,
    // before any lookup, so neither answer says anything about whether an address is registered.
    if (isStorageFull()) {
      logger.event('signup_refused', { reqId: req.id, reason: 'storage_full' });
      return res.status(503).json(SIGNUP_CLOSED);
    }
    if (accountCap() && (await User.countDocuments({ status: { $ne: 'deleted' } })) >= accountCap()) {
      logger.alert('account_cap_reached', { reqId: req.id, cap: accountCap() });
      return res.status(503).json(SIGNUP_CLOSED);
    }
    if (process.env.NODE_ENV === 'production' && !mailer.isConfigured()) {
      return res.status(503).json({ success: false, error: 'email_unavailable', message: 'Registration is temporarily unavailable' });
    }
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) {
      return res.status(400).json({ success: false, error: 'validation_failed', message: 'Enter a valid email address' });
    }
    if (req.body?.acceptedTerms !== true || req.body?.acceptedPrivacy !== true) {
      return res.status(400).json({ success: false, error: 'consent_required', message: 'Accept the Terms and Privacy Policy to continue' });
    }
    let inviteHashes = [];
    if (mode === 'invite') {
      const inviteCode = normalizeInviteCode(req.body?.inviteCode);
      if (!inviteCode) return res.status(400).json({ success: false, error: 'invite_invalid', message: 'That invite code is invalid or has expired' });
      // Older invites were hashed with plain sha256 before the keyed digest existed; keep accepting both.
      inviteHashes = [inviteDigest(inviteCode), digest(inviteCode)];
      const ticket = inviteGuard.reserve(inviteSource(req));
      if (!ticket) {
        inviteLocked.hit(logger.truncateIp(req.ip), { reqId: req.id });
        return res.status(429).json({ success: false, error: 'invite_locked', message: 'Too many incorrect invite codes. Try again later or ask for a new invite.' });
      }
      // An invalid code ends here: no user lookup and no mail, so a leaked code cannot probe addresses.
      const invite = await Invite.exists({ codeHash: { $in: inviteHashes }, ...usableInviteFilter() });
      if (!invite) {
        logger.event('invite_failed', { reqId: req.id, ip: logger.truncateIp(req.ip) });
        inviteFailures.hit('all');
        return res.status(400).json({ success: false, error: 'invite_invalid', message: 'That invite code is invalid or has expired' });
      }
      inviteGuard.release(ticket);
    }
    // Per-domain daily cap, then the mail unit, both before looking at the account so a refusal is the same for
    // every address. The domain unit is given back below whenever no new account is created.
    if (!takeSignupSlot(email)) {
      domainCapped.hit(email.slice(email.lastIndexOf('@') + 1), { reqId: req.id });
      return res.status(429).json({ success: false, error: 'rate_limited', message: 'Too many signups from this email domain today. Please try again tomorrow.' });
    }
    if (!(await reserveMail())) {
      releaseSignupSlot(email);
      logger.event('mail_budget_exhausted', { reqId: req.id, template: 'verification' });
      return res.status(503).json({ success: false, error: 'mail_budget', message: 'We cannot send more email today. Please try again tomorrow.' });
    }
    const consent = { acceptedTermsAt: new Date(), acceptedTermsVersion: TERMS_VERSION, acceptedPrivacyAt: new Date(), acceptedPrivacyVersion: PRIVACY_VERSION };

    let existing = await User.findOne({ email }).select('_id status emailVerifiedAt accountExistsNoticeAt');
    if (existing?.status === 'deleted') {
      // A deletion whose cascade is still pending must not block the address forever: finish it now.
      await cascadeDeletedOwner(existing._id);
      existing = null;
    }
    if (existing) {
      releaseSignupSlot(email);
      if (existing.status !== 'active') {
        await refundMail();
        logger.event('signup_suspended_account', { reqId: req.id, userId: String(existing._id) });
      } else if (!existing.emailVerifiedAt) {
        if (recipientAllowed('verify', email)) {
          await User.updateOne({ _id: existing._id }, { $set: consent });
          const token = await issueEmailToken(existing._id, 'verify');
          sendInBackground(mailer.sendVerification({ email }, token), 'verification', req);
          logger.event('signup_resent', { reqId: req.id, userId: String(existing._id) });
        } else {
          await refundMail();
        }
      } else {
        const noticedAt = existing.accountExistsNoticeAt ? new Date(existing.accountExistsNoticeAt).getTime() : 0;
        if (Date.now() - noticedAt > ACCOUNT_EXISTS_NOTICE_GAP_MS) {
          await User.updateOne({ _id: existing._id }, { $set: { accountExistsNoticeAt: new Date() } });
          const resetToken = await issueEmailToken(existing._id, 'reset');
          sendInBackground(mailer.sendAccountExistsNotice({ email }, resetToken), 'account-exists', req);
          logger.event('signup_existing_account', { reqId: req.id, userId: String(existing._id) });
        } else {
          await refundMail();
        }
      }
      return res.status(200).json(GENERIC_SIGNUP);
    }

    let user;
    try {
      user = await User.create({ email, passwordHash: null, emailVerifiedAt: null, status: 'active', ...consent });
    } catch (error) {
      if (error.code === 11000) { releaseSignupSlot(email); await refundMail(); return res.status(200).json(GENERIC_SIGNUP); }
      throw error;
    }
    if (inviteHashes.length) {
      const consumed = await Invite.findOneAndUpdate(
        { codeHash: { $in: inviteHashes }, ...usableInviteFilter() },
        { $inc: { usedCount: 1 }, $set: { usedBy: user._id } }, { returnDocument: 'after' },
      );
      if (!consumed) {
        await User.deleteOne({ _id: user._id });
        releaseSignupSlot(email);
        await refundMail();
        return res.status(400).json({ success: false, error: 'invite_invalid', message: 'That invite code is invalid or has expired' });
      }
    }
    recipientAllowed('verify', email);
    const token = await issueEmailToken(user._id, 'verify');
    sendInBackground(mailer.sendVerification(user, token), 'verification', req);
    logger.event('signup', { reqId: req.id, userId: String(user._id), mode });
    // With delivery off the link has nowhere to go, so it goes back to the browser that just asked for it.
    // Only on this path: the branches above answer for addresses that already exist, and a link there would
    // say so. The address is still unproved, which is the whole cost of MAIL_DELIVERY=disabled (lib/mailer.js).
    if (mailer.mailDeliveryDisabled()) {
      return res.status(200).json({ ...GENERIC_SIGNUP, mailDelivery: 'disabled', verifyUrl: mailer.verificationLink(token) });
    }
    return res.status(200).json(GENERIC_SIGNUP);
  } catch (error) { return next(error); }
}

// Consumes the link, sets the password chosen by whoever holds the inbox, and signs them in.
async function verifyEmail(req, res, next) {
  try {
    const password = req.body?.password;
    if (!validPassword(password)) return res.status(400).json({ success: false, error: 'password_invalid', message: 'Choose a password of at least 10 characters' });
    const consumed = await consumeEmailToken(req.body?.token, 'verify');
    if (!consumed) return res.status(400).json({ success: false, error: 'token_invalid', message: 'This link is invalid, expired, or already used' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { _id: consumed.user, status: 'active', emailVerifiedAt: null },
      { $set: { passwordHash, emailVerifiedAt: new Date() }, $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    ).select('_id email emailVerifiedAt role tokenVersion');
    if (!user) return res.status(400).json({ success: false, error: 'token_invalid', message: 'This link is invalid, expired, or already used' });
    evictOwner(user._id);
    setSessionCookie(res, signSession(user));
    logger.event('email_verified', { reqId: req.id, userId: String(user._id) });
    return res.json({ success: true, verified: true, user: identityOf(user) });
  } catch (error) { return next(error); }
}

// Public: re-sends the verification link only when an unverified account exists. Always the generic 200.
async function resendVerification(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!validEmail(email)) return res.status(400).json({ success: false, error: 'validation_failed', message: 'Enter a valid email address' });
    // SEC23: the unit is reserved before the lookup, so a spent budget answers 503 for every address alike
    // instead of only for addresses with an unverified account. Unused units are refunded.
    if (!(await reserveMail())) {
      logger.event('mail_budget_exhausted', { reqId: req.id, template: 'verification' });
      return res.status(503).json({ success: false, error: 'mail_budget', message: 'We cannot send more email today. Please try again tomorrow.' });
    }
    const user = await User.findOne({ email, status: 'active', emailVerifiedAt: null }).select('_id email');
    if (user && recipientAllowed('verify', email)) {
      const token = await issueEmailToken(user._id, 'verify');
      sendInBackground(mailer.sendVerification(user, token), 'verification', req);
      logger.event('verification_resent', { reqId: req.id, userId: String(user._id) });
    } else {
      await refundMail();
    }
    return res.json(GENERIC_RESEND);
  } catch (error) { return next(error); }
}

async function forgotPassword(req, res, next) {
  try {
    const email = normalizeEmail(req.body?.email);
    if (validEmail(email)) {
      // SEC6: verified accounts only. An unverified signup has no password to reset; it uses resend-verification,
      // which keeps strangers' unverified rows from draining the reset reserve.
      const user = await User.findOne({ email, status: 'active', emailVerifiedAt: { $ne: null } }).select('_id email');
      // Cooldown first (cheap, in memory), then the reserved part of the daily budget. Both keep the generic answer.
      if (user && recipientAllowed('reset', email)) {
        if (await reserveMail({ reset: true })) {
          const token = await issueEmailToken(user._id, 'reset');
          sendInBackground(mailer.sendPasswordReset(user, token), 'password-reset', req);
          logger.event('password_reset_requested', { reqId: req.id, userId: String(user._id) });
        } else {
          logger.event('mail_budget_exhausted', { reqId: req.id, template: 'password-reset', userId: String(user._id) });
        }
      }
    }
    return res.status(200).json(GENERIC_RECOVERY);
  } catch (error) { return next(error); }
}

// Proving the inbox through a reset link verifies the address too. API tokens are left alone on purpose:
// revoking them would take the tenant's live sites down on a routine reset.
async function resetPassword(req, res, next) {
  try {
    if (!validPassword(req.body?.newPassword)) return res.status(400).json({ success: false, error: 'password_invalid', message: 'Password must be at least 10 characters' });
    const consumed = await consumeEmailToken(req.body?.token, 'reset');
    if (!consumed) return res.status(400).json({ success: false, error: 'token_invalid' });
    const passwordHash = await bcrypt.hash(req.body.newPassword, 10);
    const user = await User.findOneAndUpdate({ _id: consumed.user, status: 'active' }, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { returnDocument: 'after' }).select('_id emailVerifiedAt');
    if (!user) return res.status(400).json({ success: false, error: 'token_invalid' });
    if (!user.emailVerifiedAt) await User.updateOne({ _id: user._id, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
    evictOwner(user._id);
    logger.event('password_reset', { reqId: req.id, userId: String(user._id) });
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
    setSessionCookie(res, signSession(user));
    logger.event('password_changed', { reqId: req.id, userId: String(user._id) });
    return res.json({ success: true });
  } catch (error) { return next(error); }
}

async function logout(req, res, next) {
  try {
    // Only the dashboard can send this header, so a cross-site page cannot force a logout.
    if (req.get('x-requested-with') !== 'XMLHttpRequest') return res.status(403).json({ success: false, error: 'csrf_rejected', message: 'Missing request header' });
    const token = readSessionCookie(req);
    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
        // Bumping the version revokes this JWT everywhere, so a copied cookie stops working too.
        if (payload.sub && typeof payload.tv === 'number') {
          await User.updateOne({ _id: payload.sub, tokenVersion: payload.tv }, { $inc: { tokenVersion: 1 } });
          evictOwner(payload.sub);
          logger.event('logout', { reqId: req.id, userId: String(payload.sub) });
        }
      } catch { /* expired or invalid token: nothing to revoke */ }
    }
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) { return next(error); }
}

function me(req, res) {
  const user = req.user;
  return res.json({ success: true, user: {
    ...identityOf(user),
    acceptedTermsAt: user.acceptedTermsAt || null,
    acceptedTermsVersion: user.acceptedTermsVersion || null,
    acceptedPrivacyAt: user.acceptedPrivacyAt || null,
    acceptedPrivacyVersion: user.acceptedPrivacyVersion || null,
  } });
}

module.exports = { login, verify, signup, signupConfig, verifyEmail, resendVerification, forgotPassword, resetPassword, changePassword, logout, me, normalizeInviteCode };
