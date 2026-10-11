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
        const filter = this.getFilter() || {};
        const tokenHashLookup = modelName === 'ApiToken' && method === 'findOne'
          && /^[a-f\d]{64}$/i.test(filter.hash || '')
          && Object.keys(filter).every((key) => ['hash', 'revokedAt', '$or'].includes(key));
        if (tokenHashLookup) return;
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
    const pipeline = this.pipeline();
    const match = pipeline[0]?.$match;
    if (!match || !isValidOwner(match.owner)) {
      throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.aggregate must start with an owner match`);
    }
    // An owner $match only scopes this collection. These stages read or write other collections (or other
    // tenants' rows of this one) after the match, so they are refused anywhere in the pipeline, $facet included.
    const denied = findDeniedStage(pipeline);
    if (denied) throw new Error(`[CRITICAL INVARIANT VIOLATION] ${modelName}.aggregate may not use ${denied}`);
  });
}

const DENIED_AGGREGATE_STAGES = ['$lookup', '$unionWith', '$graphLookup', '$out', '$merge'];

function findDeniedStage(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeniedStage(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (DENIED_AGGREGATE_STAGES.includes(key)) return key;
    const found = findDeniedStage(child);
    if (found) return found;
  }
  return null;
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

module.exports = { ownerGuardPlugin, scopedBulkWrite, isValidOwner, DENIED_AGGREGATE_STAGES };
