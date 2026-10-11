const ApiToken = require('../models/ApiToken');
const cache = require('./cache');
const logger = require('./logger');

// How often the set is re-read from the database. The hooks keep it current inside this process;
// the re-sync catches writes that skipped them (a script, a restore, a second process during a deploy).
const RESYNC_INTERVAL_MS = 60_000;

let loading = null;

// Fills the active-token hash set from every unrevoked token and drops hashes that are no longer
// unrevoked in the database. Runs at boot (server.js), every RESYNC_INTERVAL_MS, and lazily from the
// /v1 middleware through ensureActiveTokensLoaded() (also in tests, where server.js never runs).
async function loadActiveTokens() {
  if (loading) return loading;
  loading = (async () => {
    // Only hashes present before the read can be dropped: a key created while the cursor runs was added
    // by its save hook and must survive even if the cursor missed it.
    const before = new Set(cache.activeTokens.keys());
    const seen = new Set();
    // ownerGuard-exemption: active-token hash set boot load reads only hash, owner and app of unrevoked tokens.
    // It is a cross-tenant read by design (the set must know every live token) and it exposes nothing but
    // the ids the /v1 auth path already resolves per request; no tenant content is touched.
    const cursor = await ApiToken.collection.find({ revokedAt: null }, { projection: { hash: 1, owner: 1, app: 1 } });
    for await (const doc of cursor) {
      const hash = String(doc.hash);
      if (!before.has(hash)) cache.badTokenCache.delete(hash);
      cache.addActiveToken(hash, doc.owner, doc.app);
      seen.add(hash);
    }
    let removed = 0;
    for (const hash of before) if (!seen.has(hash)) { cache.evictTokenByHash(hash); removed += 1; }
    cache.markActiveTokensReady(true);
    return { count: seen.size, removed };
  })().finally(() => { loading = null; });
  return loading;
}

// Resolves true when the set can be trusted. On a failed load /v1 falls back to the database path
// (still behind the pre-DB bucket) rather than rejecting every token.
async function ensureActiveTokensLoaded() {
  if (cache.activeTokensLoaded()) return true;
  try { await loadActiveTokens(); return true; }
  catch (err) { logger.error({ err }, 'active token set load failed; falling back to database lookups'); return false; }
}

// Periodic re-sync; a failed pass keeps the current set and is retried on the next tick.
function startActiveTokenResync(intervalMs = RESYNC_INTERVAL_MS) {
  const timer = setInterval(() => {
    loadActiveTokens()
      .then(({ count, removed }) => { if (removed) logger.info({ count, removed }, 'active token set re-synced'); })
      .catch((err) => logger.error({ err }, 'active token set re-sync failed'));
  }, intervalMs);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}

module.exports = { loadActiveTokens, ensureActiveTokensLoaded, startActiveTokenResync, RESYNC_INTERVAL_MS };
