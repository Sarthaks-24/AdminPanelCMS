const { isRealMailKey } = require('./mailer');
const { envMode } = require('./signupMode');

// Same cluster and database counts as the same target even with different credentials or query options.
// A URI with no database in its path lands on MONGODB_DB or the project default, so that is what gets compared.
function mongoTarget(uri, env) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^/?]+))?/i.exec(String(uri || ''));
  if (!match) return String(uri || '');
  return `${match[1]}/${match[2] || env.MONGODB_DB || 'Portfolio_db'}`.toLowerCase();
}
const PLACEHOLDER_SECRETS = ['super_secret_jwt_key_at_least_32_characters_long_replace_me'];

// PUBLIC_API_URL is shown to tenants as the base of their /v1 calls, so it must be a bare https origin.
function publicApiProblem(value, production) {
  let url;
  try { url = new URL(value); } catch { return 'PUBLIC_API_URL must be a valid URL, for example https://api.example.com'; }
  if (production && url.protocol !== 'https:') return 'PUBLIC_API_URL must be an https URL in production';
  if (url.pathname !== '/' || url.search || url.hash || value.endsWith('/')) return 'PUBLIC_API_URL must be a bare origin with no path or trailing slash, for example https://api.example.com';
  return null;
}

// Fail fast on unsafe configuration instead of booting with a guessable signing key.
// Returns non-fatal warnings; the caller decides how to print them.
function validateEnv(env = process.env) {
  const problems = [];
  const warnings = [];
  const production = env.NODE_ENV === 'production';
  const secret = env.JWT_SECRET || '';
  if (secret.length < 32) problems.push('JWT_SECRET must be set to a random value of at least 32 characters');
  else if (PLACEHOLDER_SECRETS.includes(secret) || /replace_me|changeme|your_.*_here/i.test(secret)) problems.push('JWT_SECRET is still the example placeholder; generate a random secret');
  if (!env.MONGODB_URI) problems.push('MONGODB_URI must be set');
  // CORS compares origins as exact strings, so a trailing slash or path would silently block the dashboard.
  if (env.CLIENT_ORIGIN) {
    let origin = null;
    try { origin = new URL(env.CLIENT_ORIGIN).origin; } catch { /* not a URL */ }
    if (origin !== env.CLIENT_ORIGIN) problems.push('CLIENT_ORIGIN must be a bare origin exactly as the browser sends it, such as https://cms.example.com (lowercase, no trailing slash, path or default port)');
  }
  // Optional (the dashboard derives the /v1 base from its own API URL when blank), but never wrong.
  if (env.PUBLIC_API_URL) {
    const problem = publicApiProblem(String(env.PUBLIC_API_URL).trim(), production);
    if (problem) problems.push(problem);
  }
  if (production) {
    try {
      if (new URL(env.CLIENT_ORIGIN || '').protocol !== 'https:') problems.push('CLIENT_ORIGIN must be an https URL in production (it is used in emailed reset/verify links)');
    } catch { problems.push('CLIENT_ORIGIN must be a valid https URL in production'); }
    // Production must not share its database or signing key with development.
    if (env.JWT_SECRET && env.DEV_JWT_SECRET === env.JWT_SECRET) problems.push('JWT_SECRET for production must differ from DEV_JWT_SECRET');
    if (env.MONGODB_URI && env.DEV_MONGODB_URI && mongoTarget(env.DEV_MONGODB_URI, env) === mongoTarget(env.MONGODB_URI, env)) problems.push('MONGODB_URI for production must differ from DEV_MONGODB_URI (same cluster and database)');
    // Without a name in the path the driver falls back to a default database that development may also be using.
    if (env.MONGODB_URI && !/^mongodb(\+srv)?:\/\/[^/?]+\/[^/?]+/.test(env.MONGODB_URI)) problems.push('MONGODB_URI must include the database name in production, for example .../Portfolio_prod');
    // Left at the default behind a proxy, every visitor shares one IP and the rate limits lock everyone out together.
    if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '') problems.push('TRUST_PROXY_HOPS must be set explicitly in production (0 if Node is reached directly, 1 behind one reverse proxy)');
    // With signup open, a dead mail path silently kills every verification; with signup closed it only degrades resets.
    const mailProblems = [];
    if (!isRealMailKey(env.RESEND_MAIL_KEY)) mailProblems.push('RESEND_MAIL_KEY is missing or still the placeholder: no verification or password-reset email can be sent');
    else if (!env.RESEND_FROM_EMAIL) mailProblems.push('RESEND_FROM_EMAIL must be set to a sender on a domain verified with Resend');
    else if (/@resend\.dev>?$/i.test(env.RESEND_FROM_EMAIL)) mailProblems.push('RESEND_FROM_EMAIL is the Resend test sender, which only delivers to your own address; use an address on your verified domain');
    if (envMode(env) === 'closed') warnings.push(...mailProblems);
    else problems.push(...mailProblems.map((text) => `${text} (fatal while SIGNUP_MODE is ${envMode(env)}; set SIGNUP_MODE=closed to boot without mail)`));
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  return { warnings };
}

module.exports = validateEnv;
