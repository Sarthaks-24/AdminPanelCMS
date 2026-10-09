const crypto = require('node:crypto');
const Invite = require('../models/Invite');
const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const { inviteDigest } = require('../lib/emailTokens');
const mongoose = require('mongoose');
const { getSignupSetting, setSignupMode, legalBlocked, MODES } = require('../lib/signupMode');
const { capacityFilter, usableInviteFilter, inviteUsage } = require('../lib/inviteUses');

async function overview(_req, res, next) {
  try {
    const owners = await User.find({ status: 'active' }).select('_id').lean();
    const ownerIds = owners.map((user) => user._id);
    const [apps, tokens, invites] = await Promise.all([
      Promise.all(ownerIds.map((owner) => App.countDocuments({ owner }))).then((values) => values.reduce((a, b) => a + b, 0)),
      Promise.all(ownerIds.map((owner) => ApiToken.countDocuments({ owner }))).then((values) => values.reduce((a, b) => a + b, 0)),
      Invite.countDocuments(usableInviteFilter()),
    ]);
    const memory = process.memoryUsage();
    return res.json({ success: true, totals: { activeAccounts: owners.length, apps, apiTokens: tokens, unusedInvites: invites }, performance: {
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
    if (!Number.isInteger(days) || days < 1 || days > 90) return res.status(400).json({ success: false, error: 'validation_failed', message: 'expiresInDays must be an integer from 1 to 90' });
    const maxUses = req.body?.maxUses === undefined ? 1 : req.body.maxUses;
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000) return res.status(400).json({ success: false, error: 'validation_failed', message: 'maxUses must be an integer from 1 to 1000' });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        const invite = await Invite.create({ codeHash: inviteDigest(code), createdBy: req.userId, maxUses, expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000) });
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
    return res.json({ success: true, revoked: true });
  } catch (error) { return next(error); }
}

async function settingsPayload() {
  const { dashboard, env, effective } = await getSignupSetting();
  return { signupMode: effective || 'closed', source: dashboard ? 'dashboard' : 'environment', environmentDefault: env || 'closed', blockedByLegalApproval: legalBlocked() };
}

async function getSettings(_req, res, next) {
  try { return res.json({ success: true, settings: await settingsPayload() }); } catch (error) { return next(error); }
}

async function updateSettings(req, res, next) {
  try {
    const mode = req.body?.signupMode;
    if (!MODES.includes(mode)) return res.status(400).json({ success: false, error: 'validation_failed', message: `signupMode must be one of: ${MODES.join(', ')}` });
    await setSignupMode(mode, req.userId);
    return res.json({ success: true, settings: await settingsPayload() });
  } catch (error) { return next(error); }
}

module.exports = { overview, listInvites, createInvite, revokeInvite, getSettings, updateSettings };
