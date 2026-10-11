const { isRealMailKey } = require('./mailer');
const { envNumber } = require('./envNumber');

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// What stops production account mail from working, in operator terms (CB-01). One predicate for three
// callers: validateEnv at boot (fatal unless SIGNUP_MODE=closed), the superadmin's "open signup" switch
// (409 mail_not_ready) and getSignupMode() (signup stays closed while any problem remains). Every account
// email names who runs the service and where to write, so a missing identity counts like a missing key.
function mailReadinessProblems(env = process.env) {
  const problems = [];
  if (!isRealMailKey(env.RESEND_MAIL_KEY)) problems.push('RESEND_MAIL_KEY is missing or still the placeholder: no verification or password-reset email can be sent');
  else if (!env.RESEND_FROM_EMAIL) problems.push('RESEND_FROM_EMAIL must be set to a sender on a domain verified with Resend');
  else if (/@resend\.dev>?$/i.test(env.RESEND_FROM_EMAIL)) problems.push('RESEND_FROM_EMAIL is the Resend test sender, which only delivers to your own address; use an address on your verified domain');
  if (!String(env.OPERATOR_NAME || '').trim()) problems.push('OPERATOR_NAME is empty: account emails must say who runs the service');
  const support = String(env.SUPPORT_EMAIL || '').trim();
  if (!support) problems.push('SUPPORT_EMAIL is empty: account emails must give an address to write to');
  else if (!EMAIL.test(support)) problems.push(`SUPPORT_EMAIL is not a plain email address (got "${support}")`);
  const cap = envNumber('MAIL_DAILY_CAP', env);
  if (cap - Math.min(envNumber('MAIL_RESET_RESERVE', env), cap) <= 0) problems.push('MAIL_DAILY_CAP leaves nothing after MAIL_RESET_RESERVE: no verification email can be sent');
  return problems;
}

module.exports = { mailReadinessProblems };
