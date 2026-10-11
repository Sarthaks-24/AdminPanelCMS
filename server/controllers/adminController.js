const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Invite = require('../models/Invite');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const { inviteDigest, invitePepperFingerprint } = require('../lib/emailTokens');
const { getSignupSetting, setSignupMode, legalBlocked, MODES } = require('../lib/signupMode');
const { mailReadinessProblems } = require('../lib/mailReadiness');
const { capacityFilter, usableInviteFilter, inviteUsage } = require('../lib/inviteUses');
const { evictOwner, bumpOwnerVersion } = require('../lib/cache');
const { mailBudgetStatus } = require('../lib/mailBudget');
const { retireAccount, isLastSuperadmin } = require('./accountController');
const logger = require('../lib/logger');

// 12 characters from a 32-symbol alphabet with no 0/O/1/I (60 bits): unguessable, still typeable.
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 12;
const USER_PAGE_SIZE = 50;

function generateInviteCode() {
  const bytes = crypto.randomBytes(INVITE_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) code += INVITE_ALPHABET[byte % INVITE_ALPHABET.length];
  return code;
}

async function overview(_req, res, next) {
  try {
    const owners = await User.find({ status: 'active' }).select('_id').lean();
    const ownerIds = owners.map((user) => user._id);
    const [apps, tokens, invites, suspended, unverified] = await Promise.all([
      Promise.all(ownerIds.map((owner) => App.countDocuments({ owner }))).then((values) => values.reduce((a, b) => a + b, 0)),
      Promise.all(ownerIds.map((owner) => ApiToken.countDocuments({ owner }))).then((values) => values.reduce((a, b) => a + b, 0)),
      Invite.countDocuments(usableInviteFilter()),
      User.countDocuments({ status: 'suspended' }),
      User.countDocuments({ status: 'active', emailVerifiedAt: null }),
    ]);
    const memory = process.memoryUsage();
    return res.json({ success: true, totals: { activeAccounts: owners.length, suspendedAccounts: suspended, unverifiedAccounts: unverified, apps, apiTokens: tokens, unusedInvites: invites }, performance: {
      uptimeSeconds: Math.floor(process.uptime()),
      memory: { rssMb: Math.round(memory.rss / 1024 / 1024), heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024), heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024) },
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      sampledAt: new Date(),
    } });
  } catch (error) { return next(error); }
}

async function listInvites(_req, res, next) {
  try {
    const invites = await Invite.find({}).select('_id usedBy usedCount maxUses expiresAt createdAt').sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ success: true, invites: invites.map((invite) => {
      const { _id, expiresAt, createdAt } = invite;
      const usage = inviteUsage(invite);
      return { _id, ...usage, used: usage.remainingUses === 0, expiresAt, createdAt };
    }) });
  } catch (error) { return next(error); }
}

async function createInvite(req, res, next) {
  try {
    const days = req.body?.expiresInDays === undefined ? 30 : req.body.expiresInDays;
    if (!Number.isInteger(days) || days < 1 || days > Invite.MAX_INVITE_DAYS) return res.status(400).json({ success: false, error: 'validation_failed', message: `expiresInDays must be an integer from 1 to ${Invite.MAX_INVITE_DAYS}` });
    const maxUses = req.body?.maxUses === undefined ? 1 : req.body.maxUses;
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > Invite.MAX_INVITE_USES) return res.status(400).json({ success: false, error: 'validation_failed', message: `maxUses must be an integer from 1 to ${Invite.MAX_INVITE_USES}` });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generateInviteCode();
      try {
        const invite = await Invite.create({ codeHash: inviteDigest(code), createdBy: req.userId, maxUses, expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000) });
        logger.event('invite_created', { reqId: req.id, by: String(req.userId), inviteId: String(invite._id), maxUses, days });
        return res.status(201).json({ success: true, invite: { id: invite._id, code, maxUses, expiresAt: invite.expiresAt } });
      } catch (error) {
        if (error.code !== 11000 || attempt === 9) throw error;
      }
    }
    throw new Error('Could not generate a unique invite code');
  } catch (error) { return next(error); }
}

async function revokeInvite(req, res, next) {
  try {
    const result = await Invite.deleteOne({ _id: req.params.id, ...capacityFilter() });
    if (!result.deletedCount) return res.status(404).json({ success: false, error: 'not_found' });
    logger.event('invite_revoked', { reqId: req.id, by: String(req.userId), inviteId: String(req.params.id) });
    return res.json({ success: true, revoked: true });
  } catch (error) { return next(error); }
}

async function settingsPayload() {
  const { dashboard, env, effective } = await getSignupSetting();
  const mailProblems = process.env.NODE_ENV === 'production' ? mailReadinessProblems() : [];
  return { signupMode: effective || 'closed', source: dashboard ? 'dashboard' : 'environment', environmentDefault: env || 'closed', blockedByLegalApproval: legalBlocked(), blockedByMail: mailProblems.length > 0, mailProblems, invitePepperFingerprint: invitePepperFingerprint() };
}

async function getSettings(_req, res, next) {
  try { return res.json({ success: true, settings: await settingsPayload() }); } catch (error) { return next(error); }
}

async function updateSettings(req, res, next) {
  try {
    const mode = req.body?.signupMode;
    if (!MODES.includes(mode)) return res.status(400).json({ success: false, error: 'validation_failed', message: `signupMode must be one of: ${MODES.join(', ')}` });
    // CB-01: opening signup while account mail cannot work would strand every new user at "check your email".
    if (mode !== 'closed' && process.env.NODE_ENV === 'production') {
      const reasons = mailReadinessProblems();
      if (reasons.length) return res.status(409).json({ success: false, error: 'mail_not_ready', message: 'Signup cannot be opened until account email works. Fix the server settings below and restart.', reasons });
    }
    await setSignupMode(mode, req.userId);
    logger.event('signup_mode_changed', { reqId: req.id, by: String(req.userId), mode });
    return res.json({ success: true, settings: await settingsPayload() });
  } catch (error) { return next(error); }
}

// ── Users ────────────────────────────────────────────────────────────────────

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function listUsers(req, res, next) {
  try {
    const filter = { status: { $ne: 'deleted' } };
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 254) : '';
    if (q) filter.email = { $regex: escapeRegex(q.toLowerCase()) };
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (['active', 'suspended'].includes(status)) filter.status = status;
    else if (status === 'unverified') { filter.status = 'active'; filter.emailVerifiedAt = null; }
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : '';
    if (cursor) {
      if (!mongoose.isValidObjectId(cursor)) return res.status(400).json({ success: false, error: 'validation_failed', message: 'Invalid cursor' });
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }
    const page = await User.find(filter).select('_id email createdAt emailVerifiedAt status role').sort({ _id: -1 }).limit(USER_PAGE_SIZE + 1).lean();
    const hasMore = page.length > USER_PAGE_SIZE;
    const rows = hasMore ? page.slice(0, USER_PAGE_SIZE) : page;
    const users = await Promise.all(rows.map(async (user) => {
      const [appCount, lastToken] = await Promise.all([
        App.countDocuments({ owner: user._id }),
        ApiToken.findOne({ owner: user._id, lastUsedAt: { $ne: null } }).select('lastUsedAt').sort({ lastUsedAt: -1 }).lean(),
      ]);
      return { ...user, appCount, lastTokenUseAt: lastToken?.lastUsedAt || null };
    }));
    return res.json({ success: true, users, nextCursor: hasMore ? String(rows[rows.length - 1]._id) : null });
  } catch (error) { return next(error); }
}

// Shared guards for suspend, unsuspend and delete: never the caller, never the last superadmin.
async function loadTarget(req, res) {
  if (String(req.params.id) === String(req.userId)) {
    res.status(400).json({ success: false, error: 'cannot_target_self', message: 'You cannot suspend or delete your own account from here' });
    return null;
  }
  const target = await User.findOne({ _id: req.params.id, status: { $ne: 'deleted' } }).select('_id email role status');
  if (!target) { res.status(404).json({ success: false, error: 'not_found' }); return null; }
  if (await isLastSuperadmin(target)) {
    res.status(400).json({ success: false, error: 'last_superadmin', message: 'The last superadmin cannot be suspended or deleted' });
    return null;
  }
  return target;
}

async function suspendUser(req, res, next) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return undefined;
    const result = await User.updateOne({ _id: target._id, status: 'active' }, { $set: { status: 'suspended' }, $inc: { tokenVersion: 1 } });
    if (!result.matchedCount) return res.status(409).json({ success: false, error: 'already_suspended' });
    evictOwner(target._id);
    bumpOwnerVersion(target._id);
    logger.event('user_suspended', { reqId: req.id, by: String(req.userId), userId: String(target._id) });
    return res.json({ success: true, user: { _id: target._id, status: 'suspended' } });
  } catch (error) { return next(error); }
}

async function unsuspendUser(req, res, next) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return undefined;
    const result = await User.updateOne({ _id: target._id, status: 'suspended' }, { $set: { status: 'active' }, $inc: { tokenVersion: 1 } });
    if (!result.matchedCount) return res.status(409).json({ success: false, error: 'not_suspended' });
    evictOwner(target._id);
    bumpOwnerVersion(target._id);
    logger.event('user_unsuspended', { reqId: req.id, by: String(req.userId), userId: String(target._id) });
    return res.json({ success: true, user: { _id: target._id, status: 'active' } });
  } catch (error) { return next(error); }
}

async function deleteUser(req, res, next) {
  try {
    const target = await loadTarget(req, res);
    if (!target) return undefined;
    const completed = await retireAccount(target._id, { reqId: req.id, by: req.userId });
    logger.event('user_force_deleted', { reqId: req.id, by: String(req.userId), userId: String(target._id), completed });
    if (completed) return res.json({ success: true, deleted: true });
    return res.status(202).json({ success: true, deleted: false, message: 'Deletion is queued for cleanup' });
  } catch (error) { return next(error); }
}

async function mailBudget(_req, res, next) {
  try { return res.json({ success: true, ...(await mailBudgetStatus()) }); } catch (error) { return next(error); }
}

// Destructive actions ask for the password again; the check is good for ten minutes.
async function reauth(req, res, next) {
  try {
    const user = await User.findOne({ _id: req.userId });
    if (!user || !(await user.matchPassword(req.body?.password))) {
      logger.event('admin_reauth_failed', { reqId: req.id, userId: String(req.userId) });
      return res.status(401).json({ success: false, error: 'credentials_invalid' });
    }
    const at = new Date();
    await User.updateOne({ _id: user._id }, { $set: { adminReauthAt: at } });
    logger.event('admin_reauth', { reqId: req.id, userId: String(user._id) });
    return res.json({ success: true, reauthAt: at });
  } catch (error) { return next(error); }
}

module.exports = { overview, listInvites, createInvite, revokeInvite, getSettings, updateSettings, listUsers, suspendUser, unsuspendUser, deleteUser, mailBudget, reauth, generateInviteCode, INVITE_ALPHABET, INVITE_CODE_LENGTH };
