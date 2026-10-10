// Settings whose value differs between local development and production. Each one is read from
// DEV_<NAME> or PROD_<NAME> according to MODE; a plain <NAME> (as hosting platforms set) is the fallback.
const MODE_KEYS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'CLIENT_ORIGIN',
  'TRUST_PROXY_HOPS',
  'SESSION_COOKIE_SAMESITE',
  'SIGNUP_MODE',
  'LEGAL_POLICIES_APPROVED',
  'RESEND_MAIL_KEY',
  'RESEND_FROM_EMAIL',
  'ADMIN_PASSWORD',
  'BACKUP_REMOTE_DESTINATION',
];

const ALIASES = { dev: 'dev', development: 'dev', prod: 'prod', production: 'prod' };
const NODE_ENV_FOR = { dev: 'development', prod: 'production' };

function resolveMode(env = process.env) {
  if (env.NODE_ENV === 'test') return 'test';
  const raw = String(env.MODE || '').trim().toLowerCase();
  if (raw) {
    const mode = ALIASES[raw];
    if (!mode) throw new Error(`MODE must be "dev" or "prod" (got "${env.MODE}")`);
    // A leftover NODE_ENV that disagrees would silently flip cookie and error-handling behaviour.
    if (env.NODE_ENV && env.NODE_ENV !== NODE_ENV_FOR[mode]) {
      throw new Error(`MODE=${mode} conflicts with NODE_ENV=${env.NODE_ENV}; remove NODE_ENV and let MODE set it`);
    }
    return mode;
  }
  if (env.NODE_ENV === 'production') return 'prod';
  if (env.NODE_ENV === 'development') return 'dev';
  throw new Error('MODE is not set; add MODE=dev or MODE=prod to server/.env');
}

// Copies the active mode's values onto the plain names the rest of the server reads, and pins NODE_ENV.
function applyMode(env = process.env) {
  const mode = resolveMode(env);
  if (mode === 'test') return mode;
  const [prefix, otherPrefix] = mode === 'prod' ? ['PROD_', 'DEV_'] : ['DEV_', 'PROD_'];
  for (const key of MODE_KEYS) {
    const value = env[prefix + key];
    if (value !== undefined && value !== '') env[key] = value;
    // A file that defines the other mode's value but leaves this one blank must not run on a stray plain value.
    else if (env[otherPrefix + key]) delete env[key];
  }
  env.NODE_ENV = NODE_ENV_FOR[mode];
  return mode;
}

module.exports = { MODE_KEYS, resolveMode, applyMode };
