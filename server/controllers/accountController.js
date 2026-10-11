const User = require('../models/User');
const App = require('../models/App');
const ApiToken = require('../models/ApiToken');
const EmailToken = require('../models/EmailToken');
const Invite = require('../models/Invite');
const Profile = require('../models/Profile');
const Resume = require('../models/Resume');
const Project = require('../models/Project');
const Skill = require('../models/Skill');
const Social = require('../models/Social');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Certification = require('../models/Certification');
const { evictOwner, bumpOwnerVersion } = require('../lib/cache');
const logger = require('../lib/logger');

const CONTENT_MODELS = { profile: Profile, resume: Resume, projects: Project, skills: Skill, socials: Social, experience: Experience, education: Education, certifications: Certification };
const CASCADE_MODELS = [ApiToken, App, Profile, Resume, Project, Skill, Social, Experience, Education, Certification];

async function exportAccount(req, res, next) {
  try {
    const owner = req.userId;
    const [user, content, apps, tokens] = await Promise.all([
      User.findOne({ _id: owner }).select('_id email emailVerifiedAt acceptedTermsAt acceptedTermsVersion acceptedPrivacyAt acceptedPrivacyVersion createdAt').lean(),
      Promise.all(Object.entries(CONTENT_MODELS).map(async ([key, Model]) => [key, await Model.find({ owner }).lean()])),
      App.find({ owner }).lean(),
      ApiToken.find({ owner }).select('_id app type prefix label expiresAt revokedAt lastUsedAt createdAt').lean(),
    ]);
    const safeContent = Object.fromEntries(content);
    res.set('Content-Disposition', 'attachment; filename="account-export.json"');
    return res.json({ exportedAt: new Date().toISOString(), user, content: safeContent, apps, tokens });
  } catch (error) { return next(error); }
}

async function cascadeDeletedOwner(ownerId) {
  // The account is marked deleted before this cascade, so it cannot authenticate or access data.
  // These owner-scoped deletes are idempotent; the sweep can safely retry after any interruption.
  for (const Model of CASCADE_MODELS) await Model.deleteMany({ owner: ownerId });
  await EmailToken.deleteMany({ user: ownerId });
  await Invite.updateMany({ usedBy: ownerId }, { $set: { usedBy: null } });
  await User.deleteOne({ _id: ownerId, status: 'deleted' });
}

// The operator's own role must survive: the last superadmin can neither be deleted nor suspended.
async function isLastSuperadmin(user) {
  if (user.role !== 'superadmin') return false;
  const others = await User.countDocuments({ _id: { $ne: user._id }, role: 'superadmin', status: 'active' });
  return others === 0;
}

// Marks the account deleted, cuts every session and token, then runs the cascade. Shared by self-service
// deletion and the superadmin force delete. Returns true when the cascade completed in this call.
async function retireAccount(userId, { reqId, by } = {}) {
  await User.updateOne({ _id: userId, status: { $ne: 'deleted' } }, { $set: { status: 'deleted' }, $inc: { tokenVersion: 1 } });
  evictOwner(userId);
  bumpOwnerVersion(userId);
  try {
    await cascadeDeletedOwner(userId);
    logger.event('account_deleted', { reqId, userId: String(userId), by: by ? String(by) : 'self' });
    return true;
  } catch (error) {
    // The status change immediately blocks access; the idempotent sweep finishes a failed cascade.
    logger.error({ err: error, reqId, userId: String(userId) }, 'account cascade failed; the sweep will retry');
    return false;
  }
}

async function deleteAccount(req, res, next) {
  try {
    const password = req.body?.password;
    const user = await User.findOne({ _id: req.userId });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, error: 'credentials_invalid' });
    }
    if (await isLastSuperadmin(user)) {
      return res.status(400).json({ success: false, error: 'last_superadmin', message: 'Grant another account the superadmin role before deleting this one' });
    }
    const completed = await retireAccount(user._id, { reqId: req.id });
    if (completed) return res.json({ success: true, deleted: true });
    return res.status(202).json({ success: true, deleted: false, message: 'Deletion is queued for cleanup' });
  } catch (error) { return next(error); }
}

module.exports = { exportAccount, deleteAccount, cascadeDeletedOwner, retireAccount, isLastSuperadmin };
