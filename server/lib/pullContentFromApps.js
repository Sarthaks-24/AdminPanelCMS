const mongoose = require('mongoose');
const App = require('../models/App');
const { evictApp } = require('./cache');

const SECTIONS = {
  Social: 'socials', Skill: 'skills', Project: 'projects', Experience: 'experience',
  Education: 'education', Certification: 'certifications',
};

async function pullContentFromApps(ownerId, modelName, deletedItemId) {
  const section = SECTIONS[modelName];
  if (!section) throw new TypeError(`Unsupported app content model: ${modelName}`);
  const deletedItemIds = Array.isArray(deletedItemId) ? deletedItemId : [deletedItemId];
  const objectIds = [...new Set(deletedItemIds.map((id) => String(new mongoose.Types.ObjectId(id))))]
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!objectIds.length) return { acknowledged: true, modifiedCount: 0 };
  const path = `include.${section}.ids`;
  const filter = { owner: ownerId, [path]: { $in: objectIds } };
  const affected = await App.find(filter).select('_id').lean();
  const result = await App.updateMany(filter, { $pull: { [path]: { $in: objectIds } } });
  // C9: like an App edit in appsController, drop the cached token resolutions so /v1 re-reads the App's
  // include lists instead of serving the removed items' ids until the cache entry ages out.
  for (const app of affected) evictApp(app._id);
  return result;
}

module.exports = pullContentFromApps;
