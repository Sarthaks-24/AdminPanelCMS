const { isRealMailKey } = require('./mailer');

// Same cluster and database counts as the same target even with different credentials or query options.
// A URI with no database in its path lands on MONGODB_DB or the project default, so that is what gets compared.
function mongoTarget(uri, env) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^/?]+))?/i.exec(String(uri || ''));
  if (!match) return String(uri || '');
  return `${match[1]}/${match[2] || env.MONGODB_DB || 'Portfolio_db'}`.toLowerCase();
}
const PLACEHOLDER_SECRETS = ['super_secret_jwt_key_at_least_32_characters_long_replace_me'];

// Fail fast on unsafe configuration instead of booting with a guessable signing key.
// Returns non-fatal warnings; the caller decides how to print them.
function validateEnv(env = process.env) {
  const problems = [];
  const warnings = [];
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
  if (env.NODE_ENV === 'production') {
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
    if (!isRealMailKey(env.RESEND_MAIL_KEY)) warnings.push('RESEND_MAIL_KEY is missing or still the placeholder: signup is unavailable and password-reset emails will not be sent');
    else if (/@resend\.dev>?$/i.test(env.RESEND_FROM_EMAIL || 'onboarding@resend.dev')) warnings.push('RESEND_FROM_EMAIL is the Resend test sender; use an address on your verified domain');
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  return { warnings };
}

module.exports = validateEnv;
