const flattenPaths = require('./flattenPaths');

module.exports = async function upsertSingleton(Model, owner, rawFields) {
  const fields = flattenPaths(rawFields);
  const options = { upsert: true, returnDocument: 'after', runValidators: true, setDefaultsOnInsert: true };
  try {
    return await Model.findOneAndUpdate({ owner }, { $set: fields }, options);
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Model.findOneAndUpdate({ owner }, { $set: fields }, { ...options, upsert: false });
  }
};
