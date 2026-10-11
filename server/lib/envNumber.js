// Numeric settings read from the environment (CB-14). Blank or unset means the default, and a value that is
// not a number also keeps the default, so a typo (`=10m`, `=fifty`) never switches a guard off. Only an
// explicit 0 disables the settings that allow it. validateEnv reports the typo: fatal in production, a
// warning in development. `guard` names what an explicit 0 turns off, for the production DISABLED line.
const NUMERIC_ENV = {
  MAIL_DAILY_CAP: { fallback: 95 },
  MAIL_RESET_RESERVE: { fallback: 20 },
  MAX_ACCOUNTS: { fallback: 0 },
  SIGNUP_DOMAIN_DAILY_CAP: { fallback: 50, guard: 'the per-domain signup cap' },
  STORAGE_CHECK_INTERVAL_MINUTES: { fallback: 10, integer: false, guard: 'the storage guard' },
  SWEEP_DELETED_INTERVAL_HOURS: { fallback: 6, integer: false, guard: 'the deleted-account sweep' },
  TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS: { fallback: 24, integer: false, guard: 'API key expiry notices' },
  DB_STORAGE_CAP_BYTES: { fallback: 512 * 1024 * 1024, min: 1 },
  STORAGE_BLOCK_PERCENT: { fallback: 90, integer: false, min: 1 },
  STORAGE_WARN_PERCENT: { fallback: 70, integer: false, min: 1 },
  SHUTDOWN_DELAY_MS: { fallback: 5000 },
  TRUST_PROXY_HOPS: { fallback: 0 },
  INVITE_FAILURE_LIMIT: { fallback: 2000, min: 1 },
  INVITE_IP_FAILURE_LIMIT: { fallback: 10, min: 1 },
  BCRYPT_MAX_CONCURRENT: { fallback: 4, min: 1 },
  ALERT_429_PER_MINUTE: { fallback: 100, min: 1 },
  ALERT_TOKEN_INVALID_PER_MINUTE: { fallback: 30, min: 1 },
};

const rawValue = (name, env) => String(env[name] ?? '').trim();

function parse(name, env) {
  const rule = NUMERIC_ENV[name];
  const raw = rawValue(name, env);
  if (raw === '') return { value: rule.fallback, blank: true };
  const number = Number(raw);
  const valid = Number.isFinite(number) && number >= (rule.min ?? 0) && (rule.integer === false || Number.isInteger(number));
  return valid ? { value: number } : { value: rule.fallback, invalid: true, raw };
}

// The value to use: the setting, or its default when blank or invalid.
function envNumber(name, env = process.env) { return parse(name, env).value; }

function numericEnvProblems(env = process.env) {
  const problems = [];
  for (const [name, rule] of Object.entries(NUMERIC_ENV)) {
    const { invalid, raw } = parse(name, env);
    if (!invalid) continue;
    const kind = rule.integer === false ? 'a number' : 'a whole number';
    problems.push(`${name} must be ${kind} of at least ${rule.min ?? 0}, or blank for the default ${rule.fallback} (got "${raw}")`);
  }
  return problems;
}

// Guards an operator switched off with an explicit 0.
function disabledGuards(env = process.env) {
  return Object.entries(NUMERIC_ENV)
    .filter(([name, rule]) => rule.guard && rawValue(name, env) !== '' && Number(rawValue(name, env)) === 0)
    .map(([name, rule]) => `${name}=0: ${rule.guard} is DISABLED`);
}

module.exports = { NUMERIC_ENV, envNumber, numericEnvProblems, disabledGuards };
