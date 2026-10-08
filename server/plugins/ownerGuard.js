const mongoose = require('mongoose');

function isValidOwner(owner) {
  return owner instanceof mongoose.Types.ObjectId
    || (typeof owner === 'string' && /^[a-f\d]{24}$/i.test(owner));
}

function ownerGuardPlugin(schema, { modelName = 'ContentModel' } = {}) {
  const guarded = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace',
    'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne',
    'countDocuments', 'distinct',
  ];

  for (const method of guarded) {
    schema.pre(method, { query: true, document: false }, function guardOwner() {
      const owner = this.getFilter()?.owner;
      if (!isValidOwner(owner)) {
        throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.${method} requires a concrete owner ObjectId`);
      }
    });
  }

  schema.pre('estimatedDocumentCount', function rejectEstimatedCount() {
    throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.estimatedDocumentCount is forbidden`);
  });

  schema.pre('insertMany', function guardInsertMany(docs) {
    if (docs.some((doc) => !doc || !isValidOwner(doc.owner))) {
      throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.insertMany requires owner on every document`);
    }
  });

  schema.pre('aggregate', function guardAggregate() {
    const match = this.pipeline()[0]?.$match;
    if (!match || !isValidOwner(match.owner)) {
      throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.aggregate must start with an owner match`);
    }
  });
}

async function scopedBulkWrite(Model, ownerId, operations, options = {}) {
  if (!isValidOwner(ownerId)) throw new Error('[CRITICAL INVARIANT VIOLATION] scopedBulkWrite requires ownerId');
  const owner = String(ownerId);
  for (const [index, operation] of operations.entries()) {
    const [action] = Object.keys(operation);
    const body = operation[action];
    if (!['insertOne', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'replaceOne'].includes(action)) {
      throw new Error(`[CRITICAL INVARIANT VIOLATION] bulkWrite op[${index}] has unsupported action`);
    }
    if (action === 'insertOne') {
      if (String(body.document?.owner) !== owner) throw new Error(`[CRITICAL INVARIANT VIOLATION] bulkWrite op[${index}] owner mismatch`);
      continue;
    }
    if (!body?.filter || String(body.filter.owner) !== owner) {
      throw new Error(`[CRITICAL INVARIANT VIOLATION] bulkWrite op[${index}] requires owner-scoped filter`);
    }
    if (action === 'replaceOne') {
      if (String(body.replacement?.owner) !== owner) throw new Error(`[CRITICAL INVARIANT VIOLATION] bulkWrite op[${index}] replacement owner mismatch`);
      continue;
    }
    const hasOwner = (value) => Array.isArray(value) ? value.some(hasOwner)
      : Boolean(value && typeof value === 'object' && Object.entries(value).some(([key, child]) => key === 'owner' || hasOwner(child)));
    if (hasOwner(body.update || {})) throw new Error(`[CRITICAL INVARIANT VIOLATION] bulkWrite op[${index}] attempts to change owner`);
  }
  // ownerGuard-implementation-exemption: validated scopedBulkWrite wrapper
  return Model.bulkWrite(operations, options);
}

module.exports = { ownerGuardPlugin, scopedBulkWrite, isValidOwner };
