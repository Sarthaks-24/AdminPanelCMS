const { MAIL_TRANSPORTS, consoleMailActive } = require('./mailer');
const { envMode, MODES } = require('./signupMode');
const { mailReadinessProblems } = require('./mailReadiness');
const { numericEnvProblems, disabledGuards, envNumber } = require('./envNumber');
const { provablyCrossSite } = require('./sameSite');

// Same cluster and database counts as the same target even with different credentials or query options.
// A URI with no database in its path lands on MONGODB_DB or the project default, so that is what gets compared.
function mongoTarget(uri, env) {
  const match = /^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)(?:\/([^/?]+))?/i.exec(String(uri || ''));
  if (!match) return String(uri || '');
  return `${match[1]}/${match[2] || env.MONGODB_DB || 'Portfolio_db'}`.toLowerCase();
}
const PLACEHOLDER_SECRETS = ['super_secret_jwt_key_at_least_32_characters_long_replace_me'];
// Cloudflare's documented always-pass / always-fail Turnstile test keys (1x..., 2x..., 3x... followed by zeros).
const TURNSTILE_TEST_KEY = /^[123]x0{20,}/i;
// The free Resend plan sends 100 emails a day; a higher cap lets the provider refuse first (BE-04).
const RESEND_FREE_DAILY = 100;

// CB-02: a typo in an enum must not be coerced silently (SIGNUP_MODE=invites used to mean closed, and
// LEGAL_POLICIES_APPROVED=TRUE kept signup shut). Blank means the default.
const ENUMS = {
  SIGNUP_MODE: { values: MODES, caseless: true },
  LEGAL_POLICIES_APPROVED: { values: ['true', 'false'] },
  SESSION_COOKIE_SAMESITE: { values: ['lax', 'strict', 'none'], caseless: true },
  MAIL_TRANSPORT: { values: MAIL_TRANSPORTS, caseless: true },
};
function enumProblems(env) {
  const problems = [];
  for (const [name, { values, caseless }] of Object.entries(ENUMS)) {
    const raw = String(env[name] ?? '').trim();
    if (raw && !values.includes(caseless ? raw.toLowerCase() : raw)) problems.push(`${name} must be one of ${values.join(', ')} or blank (got "${env[name]}")`);
  }
  return problems;
}

// X-06: the checks that protect data, shared by the server and the scripts that write to a production
// database (prepare-production-db, grant-superadmin, set-admin, create-invites). A script that skips them can
// write prod data into a dev database or hash invites with a key the server will not use.
function dataSafetyProblems(env = process.env) {
  const problems = [];
  if (!env.MONGODB_URI) problems.push('MONGODB_URI must be set');
  if (env.NODE_ENV !== 'production') return problems;
  // Production must not share its database with development.
  if (env.MONGODB_URI && env.DEV_MONGODB_URI && mongoTarget(env.DEV_MONGODB_URI, env) === mongoTarget(env.MONGODB_URI, env)) problems.push('MONGODB_URI for production must differ from DEV_MONGODB_URI (same cluster and database)');
  // Without a name in the path the driver falls back to a default database that development may also be using.
  if (env.MONGODB_URI && !/^mongodb(\+srv)?:\/\/[^/?]+\/[^/?]+/.test(env.MONGODB_URI)) problems.push('MONGODB_URI must include the database name in production, for example .../Portfolio_prod');
  // Invites get their own key (SEC20) so JWT_SECRET can be rotated after an incident without killing every invite.
  const pepper = env.INVITE_CODE_PEPPER || '';
  if (pepper.length < 32) problems.push('INVITE_CODE_PEPPER must be set in production to a random value of at least 32 characters (it hashes invite codes; keep it stable)');
  else if (pepper === env.JWT_SECRET) problems.push('INVITE_CODE_PEPPER must differ from JWT_SECRET');
  return problems;
}

// For scripts: refuses to touch a production database while a data-safety check fails.
function assertDataSafety(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const problems = dataSafetyProblems(env);
  if (problems.length) throw new Error(`Refusing to run against production:\n - ${problems.join('\n - ')}`);
}

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
  problems.push(...dataSafetyProblems(env));
  problems.push(...enumProblems(env));
  // CB-14: a non-numeric limit keeps its default at runtime, but the operator meant something else.
  if (production) problems.push(...numericEnvProblems(env));
  else warnings.push(...numericEnvProblems(env));
  // CORS compares origins as exact strings, so a trailing slash or path would silently block the dashboard.
  if (env.CLIENT_ORIGIN) {
    let origin = null;
    try { origin = new URL(env.CLIENT_ORIGIN).origin; } catch { /* not a URL */ }
    if (origin !== env.CLIENT_ORIGIN) problems.push('CLIENT_ORIGIN must be a bare origin exactly as the browser sends it, such as https://cms.example.com (lowercase, no trailing slash, path or default port)');
  }
  // Required in production (below): it is the /v1 base URL the dashboard shows tenants. Never wrong when set.
  if (env.PUBLIC_API_URL) {
    const problem = publicApiProblem(String(env.PUBLIC_API_URL).trim(), production);
    if (problem) problems.push(problem);
  }
  if (production) {
    try {
      if (new URL(env.CLIENT_ORIGIN || '').protocol !== 'https:') problems.push('CLIENT_ORIGIN must be an https URL in production (it is used in emailed reset/verify links)');
    } catch { problems.push('CLIENT_ORIGIN must be a valid https URL in production'); }
    // Production must not share its signing key with development (the database check is in dataSafetyProblems).
    if (env.JWT_SECRET && env.DEV_JWT_SECRET === env.JWT_SECRET) problems.push('JWT_SECRET for production must differ from DEV_JWT_SECRET');
    // The dashboard shows this as the /v1 base URL tenants copy into their apps; a guess is wrong for every
    // split-host deploy. With one shared origin, set it to that origin.
    if (!env.PUBLIC_API_URL) problems.push('PUBLIC_API_URL must be set in production to the API origin tenants call, for example https://api.example.com');
    // FE-09: a Lax/Strict session cookie is never sent from a dashboard on another site, so sign-in cannot work.
    const sameSite = String(env.SESSION_COOKIE_SAMESITE || 'lax').trim().toLowerCase();
    if (sameSite === 'none') warnings.push('SESSION_COOKIE_SAMESITE=none: Safari and other browsers that block third-party cookies will not keep users signed in; put the dashboard and the API on one site instead');
    else if (env.PUBLIC_API_URL && env.CLIENT_ORIGIN && provablyCrossSite(env.CLIENT_ORIGIN, env.PUBLIC_API_URL)) {
      problems.push(`CLIENT_ORIGIN (${env.CLIENT_ORIGIN}) and PUBLIC_API_URL (${env.PUBLIC_API_URL}) are on different sites, so the SameSite=${sameSite} session cookie is never sent and nobody can stay signed in. Put both on one domain you own (for example app.example.com and api.example.com); free platform hostnames such as *.onrender.com or *.pages.dev are each their own site.`);
    }
    // X-02: Turnstile is on when the secret is set, but the widget needs the site key. Half a configuration makes
    // signup demand a captcha the dashboard cannot render (or shows a widget the server never checks).
    const secretKey = String(env.TURNSTILE_SECRET_KEY || '').trim();
    const siteKey = String(env.TURNSTILE_SITE_KEY || '').trim();
    if (secretKey && !siteKey) problems.push('TURNSTILE_SECRET_KEY is set but TURNSTILE_SITE_KEY is not: signup would demand a captcha the dashboard cannot render. Set both keys or neither.');
    if (siteKey && !secretKey) problems.push('TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is not: the dashboard would show a captcha the server never checks. Set both keys or neither.');
    // CB-18: Cloudflare's test keys pass (or fail) every challenge.
    if (TURNSTILE_TEST_KEY.test(secretKey) || TURNSTILE_TEST_KEY.test(siteKey)) problems.push('TURNSTILE_SECRET_KEY / TURNSTILE_SITE_KEY are Cloudflare test keys; use the keys of your Turnstile widget in production');
    if (String(env.MAIL_TRANSPORT || '').trim().toLowerCase() === 'console') problems.push('MAIL_TRANSPORT=console only prints email to the log and is for development; remove it (or set it to resend) in production');
    for (const guard of disabledGuards(env)) warnings.push(guard);
    // Left at the default behind a proxy, every visitor shares one IP and the rate limits lock everyone out together.
    if (env.TRUST_PROXY_HOPS === undefined || env.TRUST_PROXY_HOPS === '') problems.push('TRUST_PROXY_HOPS must be set explicitly in production (0 if Node is reached directly, 1 behind one reverse proxy)');
    // With signup open, a dead mail path silently kills every verification; with signup closed it only degrades
    // resets. The same check keeps the panel from opening signup later (CB-01, lib/mailReadiness.js).
    const mailProblems = mailReadinessProblems(env);
    if (envMode(env) === 'closed') warnings.push(...mailProblems.map((text) => `${text} (signup stays closed until this is fixed)`));
    else problems.push(...mailProblems.map((text) => `${text} (fatal while SIGNUP_MODE is ${envMode(env)}; set SIGNUP_MODE=closed to boot without mail)`));
    if (envNumber('MAIL_DAILY_CAP', env) > RESEND_FREE_DAILY) warnings.push(`MAIL_DAILY_CAP is ${envNumber('MAIL_DAILY_CAP', env)}, above the Resend free tier of ${RESEND_FREE_DAILY} a day: on the free plan Resend refuses mail before the budget and its alerts do`);
  } else {
    if (consoleMailActive(env)) warnings.push('Mail goes to the console: emails (with their links) are printed in this log, not sent. Set RESEND_MAIL_KEY and MAIL_TRANSPORT=resend to send for real.');
    if (Boolean(String(env.TURNSTILE_SECRET_KEY || '').trim()) !== Boolean(String(env.TURNSTILE_SITE_KEY || '').trim())) warnings.push('Only one of TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY is set: set both or neither (production refuses to boot this way)');
  }
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
  return { warnings };
}

module.exports = validateEnv;
module.exports.dataSafetyProblems = dataSafetyProblems;
module.exports.assertDataSafety = assertDataSafety;
