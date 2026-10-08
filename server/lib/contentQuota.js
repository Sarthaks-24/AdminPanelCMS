const LIMITS = require('../config/limits');

// The current API process, response cache, and rate-limit stores are single-instance.
// This lock closes count-then-create races inside that process. Revisit it before
// running multiple API workers or replicas; distributed deployments need a shared
// atomic reservation store rather than a process-local mutex.
const lockTails = new Map();

async function withOwnerModelLock(key, action) {
  const previous = lockTails.get(key) || Promise.resolve();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const tail = previous.then(() => gate);
  lockTails.set(key, tail);

  await previous;
  try {
    return await action();
  } finally {
    release();
    if (lockTails.get(key) === tail) lockTails.delete(key);
  }
}

async function withContentQuota(Model, ownerId, amount, create) {
  const key = `${String(ownerId)}:${Model.modelName}`;
  return withOwnerModelLock(key, async () => {
    const count = await Model.countDocuments({ owner: ownerId });
    if (count + amount > LIMITS.itemsPerCollection) return { allowed: false };
    return { allowed: true, value: await create() };
  });
}

module.exports = { withContentQuota };
