const mongoose = require('mongoose');
const App = require('../models/App');

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
  return App.updateMany(
    { owner: ownerId },
    { $pull: { [`include.${section}.ids`]: { $in: objectIds } } },
  );
}

module.exports = pullContentFromApps;
