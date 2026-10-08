// Phase 1 placeholder. Phase 3 will increment the owner's content version here.
async function onContentChanged(ownerId) {
  if (!ownerId) throw new TypeError('onContentChanged requires an owner id');
}

module.exports = { onContentChanged };
