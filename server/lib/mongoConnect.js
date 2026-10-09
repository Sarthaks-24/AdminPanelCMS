const mongoose = require('mongoose');

const DEFAULT_DB = 'Portfolio_db';
const DOH_ENDPOINTS = ['https://cloudflare-dns.com/dns-query', 'https://dns.google/resolve'];

async function dohQuery(name, type) {
  let lastError;
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const response = await fetch(`${endpoint}?name=${encodeURIComponent(name)}&type=${type}`, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      return Array.isArray(body.Answer) ? body.Answer : [];
    } catch (error) { lastError = error; }
  }
  throw new Error(`DNS-over-HTTPS lookup failed: ${lastError?.message || 'unknown error'}`);
}

// Rebuilds the standard (non-SRV) connection string a mongodb+srv:// URI stands for,
// reading the SRV and TXT records over HTTPS when the system resolver cannot.
async function standardUriFromSrv(uri, query = dohQuery) {
  const url = new URL(uri);
  const srvName = `_mongodb._tcp.${url.hostname}`;
  const [srv, txt] = await Promise.all([query(srvName, 'SRV'), query(url.hostname, 'TXT').catch(() => [])]);
  // Same rule the driver applies: every target must sit under the cluster's parent domain.
  const parent = url.hostname.split('.').slice(1).join('.');
  const hosts = srv
    .map((record) => String(record.data).trim().split(/\s+/))
    .filter((parts) => parts.length >= 4)
    .map(([, , port, target]) => `${target.replace(/\.$/, '')}:${port}`)
    .filter((hostPort) => hostPort.split(':')[0].endsWith(`.${parent}`));
  if (!hosts.length) throw new Error('No valid MongoDB hosts were returned for this cluster');

  const params = new URLSearchParams(url.search);
  for (const record of txt) {
    for (const [key, value] of new URLSearchParams(String(record.data).replace(/^"|"$/g, '').replace(/"\s*"/g, ''))) {
      if (!params.has(key)) params.set(key, value);
    }
  }
  if (!params.has('tls') && !params.has('ssl')) params.set('tls', 'true');
  const auth = url.username ? `${url.username}${url.password ? `:${url.password}` : ''}@` : '';
  return `mongodb://${auth}${hosts.join(',')}${url.pathname === '/' ? '' : url.pathname}?${params.toString()}`;
}

const isSrv = (uri) => typeof uri === 'string' && uri.startsWith('mongodb+srv://');
const isSrvLookupFailure = (uri, error) => isSrv(uri) && /querySrv|queryTxt/i.test(String(error?.message));

// The database a URI targets: its own path, else MONGODB_DB, else the project default.
// Without this a URI that lacks a database name would silently use `test`.
function databaseNameFor(uri) {
  try {
    const fromPath = decodeURIComponent(new URL(uri).pathname.replace(/^\//, '').split('/')[0]);
    if (fromPath) return fromPath;
  } catch { /* fall through to the default */ }
  return process.env.MONGODB_DB || DEFAULT_DB;
}

function withDatabaseName(uri, options) {
  if (options.dbName) return options;
  try {
    const pathname = new URL(uri).pathname;
    if (pathname && pathname !== '/') return options;
  } catch { return options; }
  return { ...options, dbName: databaseNameFor(uri) };
}

async function connectMongo(uri, options = {}, { query = dohQuery, log = console } = {}) {
  const connectOptions = withDatabaseName(uri, options);
  try {
    return await mongoose.connect(uri, connectOptions);
  } catch (error) {
    if (!isSrvLookupFailure(uri, error)) throw error;
    log.warn('[MongoDB] SRV lookup failed on this network; resolving the cluster over DNS-over-HTTPS instead.');
    await mongoose.disconnect().catch(() => {});
    return mongoose.connect(await standardUriFromSrv(uri, query), connectOptions);
  }
}

module.exports = { connectMongo, standardUriFromSrv, isSrvLookupFailure, withDatabaseName, databaseNameFor };
