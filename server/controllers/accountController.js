const bcrypt = require('bcryptjs');
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

const CONTENT_MODELS = { profile: Profile, resume: Resume, projects: Project, skills: Skill, socials: Social, experience: Experience, education: Education, certifications: Certification };
const CASCADE_MODELS = [ApiToken, App, Profile, Resume, Project, Skill, Social, Experience, Education, Certification];

async function exportAccount(req, res, next) {
  try {
    const owner = req.userId;
    const [user, content, apps, tokens] = await Promise.all([
      User.findOne({ _id: owner }).select('_id email emailVerifiedAt acceptedTermsAt createdAt').lean(),
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

async function deleteAccount(req, res, next) {
  try {
    const password = req.body?.password;
    const user = await User.findOne({ _id: req.userId });
    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, error: 'credentials_invalid' });
    }
    await User.updateOne({ _id: user._id, status: 'active' }, { $set: { status: 'deleted' }, $inc: { tokenVersion: 1 } });
    evictOwner(user._id);
    bumpOwnerVersion(user._id);
    try {
      await cascadeDeletedOwner(user._id);
      return res.json({ success: true, deleted: true });
    } catch {
      // The status change immediately blocks access; the idempotent sweep finishes a failed cascade.
      return res.status(202).json({ success: true, deleted: false, message: 'Deletion is queued for cleanup' });
    }
  } catch (error) { return next(error); }
}

module.exports = { exportAccount, deleteAccount, cascadeDeletedOwner };
