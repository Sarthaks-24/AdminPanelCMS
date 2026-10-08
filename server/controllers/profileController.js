const Profile = require('../models/Profile');
const Social = require('../models/Social');
const pickFields = require('../lib/pickFields');
const { WRITABLE_FIELDS } = require('../lib/modelConstants');
const ownerForRequest = require('../lib/ownerForRequest');
const upsertSingleton = require('../lib/upsertSingleton');
const contentChanged = require('../lib/onContentChanged');

async function syncEmail(owner, email) {
  if (typeof email !== 'string' || !email.trim()) return;
  const value = email.trim().toLowerCase();
  const last = await Social.findOne({ owner }).sort({ order: -1 }).select('order').lean();
  await Social.findOneAndUpdate(
    { owner, platform: 'Email' },
    {
      $set: { label: value, url: `mailto:${value}`, username: value.split('@')[0], icon: 'mail', featured: true },
      $setOnInsert: { owner, platform: 'Email', order: (last?.order ?? -1) + 1, visibility: 'published' },
    },
    { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true },
  );
}

async function getProfile(req, res, next) {
  try {
    const owner = await ownerForRequest(req);
    if (!owner) return res.status(404).json({ success: false, message: 'Profile not found' });
    const profile = await Profile.findOne({ owner });
    const result = profile || await Profile.create({ owner });
    if (!profile) await contentChanged.onContentChanged(owner);
    const data = result.toObject();
    if (!req.userId) delete data.owner;
    return res.json(data);
  } catch (error) { return next(error); }
}

async function updateProfile(req, res, next) {
  try {
    const data = pickFields(req.body, WRITABLE_FIELDS.Profile);
    const profile = await upsertSingleton(Profile, req.userId, data);
    if (data.email) await syncEmail(req.userId, data.email);
    await contentChanged.onContentChanged(req.userId);
    return res.json(profile);
  } catch (error) { return next(error); }
}

async function updateAvailability(req, res, next) {
  try {
    const data = {};
    if (typeof req.body.isAvailableForHire === 'boolean') data.isAvailableForHire = req.body.isAvailableForHire;
    if (typeof req.body.statusText === 'string') data.statusText = req.body.statusText.slice(0, 500);
    const profile = await upsertSingleton(Profile, req.userId, data);
    await contentChanged.onContentChanged(req.userId);
    return res.json(profile);
  } catch (error) { return next(error); }
}

module.exports = { getProfile, updateProfile, updateAvailability };
