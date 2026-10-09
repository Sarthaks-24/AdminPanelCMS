const mongoose = require('mongoose');

const MAX_BULK_ITEMS = 500;

// Builds deduped, validated reorder ops; null for malformed payloads.
function buildReorderOps(items, ownerId) {
  if (!Array.isArray(items) || items.length > MAX_BULK_ITEMS) return null;
  const seen = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object' || !mongoose.isValidObjectId(item.id) || !Number.isInteger(Number(item.order)) || Math.abs(Number(item.order)) > 1_000_000) continue;
    seen.set(String(item.id), Number(item.order));
  }
  return [...seen].map(([id, order]) => ({ updateOne: { filter: { _id: id, owner: ownerId }, update: { $set: { order } } } }));
}

// Reorders atomically from the caller's view: refuses the whole batch if any id isn't owned.
async function applyReorder(Model, ownerId, ops, scopedBulkWrite) {
  const ids = ops.map((op) => op.updateOne.filter._id);
  const owned = await Model.countDocuments({ _id: { $in: ids }, owner: ownerId });
  if (owned !== ids.length) return { ok: false };
  const result = await scopedBulkWrite(Model, ownerId, ops);
  return { ok: true, matchedCount: result.matchedCount };
}

module.exports = { buildReorderOps, applyReorder, MAX_BULK_ITEMS };
