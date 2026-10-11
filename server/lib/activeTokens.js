const ApiToken = require('../models/ApiToken');
const cache = require('./cache');
const logger = require('./logger');

let loading = null;

// Fills the active-token hash set from every unrevoked token. Runs once at boot (server.js); the
// /v1 middleware calls ensureActiveTokensLoaded() as a safety net (and in tests, where server.js never runs).
async function loadActiveTokens() {
  if (loading) return loading;
  loading = (async () => {
    // ownerGuard-exemption: active-token hash set boot load reads only hash, owner and app of unrevoked tokens.
    // It is a cross-tenant read by design (the set must know every live token) and it exposes nothing but
    // the ids the /v1 auth path already resolves per request; no tenant content is touched.
    const cursor = await ApiToken.collection.find({ revokedAt: null }, { projection: { hash: 1, owner: 1, app: 1 } });
    let count = 0;
    for await (const doc of cursor) { cache.addActiveToken(doc.hash, doc.owner, doc.app); count += 1; }
    cache.markActiveTokensReady(true);
    return count;
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

module.exports = { loadActiveTokens, ensureActiveTokensLoaded };
