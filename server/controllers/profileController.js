const Profile = require('../models/Profile');
const Social = require('../models/Social');
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const upsertSingleton = require('../lib/upsertSingleton');
const contentChanged = require('../lib/onContentChanged');
const pullContentFromApps = require('../lib/pullContentFromApps');

const { EMAIL_PATTERN } = Profile;

// Mirrors the profile email into a Social row. The row is inserted as an unfeatured draft (A14):
// publishing an address is the owner's decision, and a later profile save never changes that decision.
async function syncEmail(owner, value) {
  const last = await Social.findOne({ owner }).sort({ order: -1 }).select('order').lean();
  await Social.findOneAndUpdate(
    { owner, platform: 'Email' },
    {
      $set: { label: value, url: `mailto:${value}`, username: value.split('@')[0], icon: 'mail' },
      $setOnInsert: { owner, platform: 'Email', order: (last?.order ?? -1) + 1, visibility: 'draft', featured: false },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
}

async function removeEmailSocial(owner) {
  const removed = await Social.findOneAndDelete({ owner, platform: 'Email' }).select('_id').lean();
  if (removed) await pullContentFromApps(owner, 'Social', removed._id);
}

// Dashboard read. A never-saved profile is answered with an unsaved blank object (configured:false)
// so that the dashboard can render the editor without the server writing anything (A13).
async function getProfile(req, res, next) {
  try {
    const owner = req.userId;
    const profile = await Profile.findOne({ owner });
    if (profile) return res.json(profile.toObject());
    const blank = new Profile({ owner }).toObject();
    delete blank._id;
    return res.json({ ...blank, configured: false });
  } catch (error) { return next(error); }
}

async function updateProfile(req, res, next) {
  try {
    const data = pickFields(req.body, WRITABLE_FIELDS.Profile);
    const hasEmail = Object.hasOwn(data, 'email');
    if (hasEmail) {
      if (typeof data.email !== 'string') return res.status(400).json({ success: false, error: 'validation_failed', fields: ['email'], message: 'Email must be a string' });
      data.email = data.email.trim().toLowerCase();
      // B11: validate before the upsert so a bad address never half-commits.
      if (data.email && (data.email.length > 254 || !EMAIL_PATTERN.test(data.email))) {
        return res.status(400).json({ success: false, error: 'validation_failed', fields: ['email'], message: 'Email address is invalid' });
      }
    }
    data.configured = true;
    const profile = await upsertSingleton(Profile, req.userId, data);
    if (hasEmail) {
      if (data.email) await syncEmail(req.userId, data.email);
      else await removeEmailSocial(req.userId);
    }
    await contentChanged.onContentChanged(req.userId);
    return res.json(profile);
  } catch (error) { return next(error); }
}

async function updateAvailability(req, res, next) {
  try {
    const body = req.body ?? {};
    const data = { configured: true };
    if (typeof body.isAvailableForHire === 'boolean') data.isAvailableForHire = body.isAvailableForHire;
    if (typeof body.statusText === 'string') data.statusText = body.statusText.slice(0, 200);
    const profile = await upsertSingleton(Profile, req.userId, data);
    await contentChanged.onContentChanged(req.userId);
    return res.json(profile);
  } catch (error) { return next(error); }
}

module.exports = { getProfile, updateProfile, updateAvailability };
