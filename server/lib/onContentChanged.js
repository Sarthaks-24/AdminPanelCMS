const { bumpOwnerVersion } = require('./cache');

async function onContentChanged(ownerId) {
  if (!ownerId) throw new TypeError('onContentChanged requires an owner id');
  bumpOwnerVersion(ownerId);
}

module.exports = { onContentChanged };
