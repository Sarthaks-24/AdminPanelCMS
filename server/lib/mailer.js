const { Resend } = require('resend');

// Tests may inject a transport; normal server delivery uses the server-only Resend key.
let transport = null;
let resendClient = null;

function setMailTransport(next) {
  if (next !== null && typeof next?.send !== 'function') throw new TypeError('Mail transport must expose send(message)');
  transport = next;
}

// The example placeholder (re_xxxxxxxxx) is not a key; treating it as one would accept signups whose emails can never send.
const isRealMailKey = (key) => { const value = String(key || '').trim(); return value.length > 3 && !/^re_x+$/i.test(value); };

// NF-17: MAIL_TRANSPORT=console prints each email (recipient, subject, text with its links) to stdout instead
// of sending it, so the email-first signup can be walked locally. Development also falls back to it when no
// Resend key is set. Never in production: validateEnv refuses MAIL_TRANSPORT=console there, and this ignores it.
const MAIL_TRANSPORTS = ['resend', 'console'];
function consoleMailActive(env = process.env) {
  if (env.NODE_ENV === 'production') return false;
  const chosen = String(env.MAIL_TRANSPORT || '').trim().toLowerCase();
  if (chosen) return chosen === 'console';
  return env.NODE_ENV === 'development' && !isRealMailKey(env.RESEND_MAIL_KEY);
}
function isConfigured() { return Boolean(transport || consoleMailActive() || (isRealMailKey(process.env.RESEND_MAIL_KEY) && process.env.RESEND_FROM_EMAIL)); }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

// Who the mail is from, in the reader's terms. Every account email carries the product name, who runs
// it, a support address and why the reader got it, so a "choose your password" link from a stranger
// does not read as phishing. Read per send, so tests and a config reload see the current values.
function brand() {
  const product = String(process.env.PRODUCT_NAME || '').trim() || 'Portfolio Control';
  const operator = String(process.env.OPERATOR_NAME || '').trim() || product;
  const support = String(process.env.SUPPORT_EMAIL || '').trim();
  return { product, operator, support };
}

const REASONS = {
  verification: (product) => `someone (hopefully you) started creating an account on ${product} with this address`,
  'password-reset': (product) => `someone asked to reset the password of the account on ${product} that uses this address`,
  'account-exists': (product) => `someone tried to create an account on ${product} with this address, which already has one`,
  'token-expiry': (product) => `your account on ${product} has API keys with an expiry date`,
};

// Inline styles only: mail clients drop <style> blocks. Neutral colours that read on light and dark clients.
function layout({ product, operator, support }, reason, bodyHtml) {
  const supportLine = support ? ` Questions? Write to <a href="mailto:${escapeHtml(support)}" style="color:#4b5563">${escapeHtml(support)}</a>.` : '';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1f2937;font-size:15px;line-height:1.6">`
    + `<p style="margin:0 0 24px;font-size:17px;font-weight:600;color:#111827">${escapeHtml(product)}</p>`
    + bodyHtml
    + `<hr style="margin:32px 0 16px;border:0;border-top:1px solid #e5e7eb">`
    + `<p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280">You got this email because ${escapeHtml(reason)}. ${escapeHtml(product)} is run by ${escapeHtml(operator)}.${supportLine}</p>`
    + `</div>`;
}

function textFooter({ product, operator, support }, reason) {
  return `\n\n--\nYou got this email because ${reason}. ${product} is run by ${operator}.${support ? ` Questions? Write to ${support}.` : ''}`;
}

function template(message) {
  const who = brand();
  const reason = (REASONS[message.template] || REASONS.verification)(who.product);
  if (message.template === 'token-expiry') {
    const details = message.tokens.map(({ label, prefix, expiresAt }) =>
      `<li>${escapeHtml(label || 'Untitled key')} (${escapeHtml(prefix)}…), expires ${escapeHtml(new Date(expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' }))}</li>`).join('');
    const textDetails = message.tokens.map(({ label, prefix, expiresAt }) =>
      `- ${label || 'Untitled key'} (${prefix}…), expires ${new Date(expiresAt).toISOString().slice(0, 10)}`).join('\n');
    const intro = `One or more of your ${who.product} API keys will expire soon. Create a replacement from the dashboard if you still need access.`;
    const outro = 'This reminder does not include the key values.';
    return {
      html: layout(who, reason, `<p>${escapeHtml(intro)}</p><ul>${details}</ul><p>${outro}</p>`),
      text: `${intro}\n\n${textDetails}\n\n${outro}${textFooter(who, reason)}`,
    };
  }
  const action = message.template === 'verification' ? 'Choose your password' : 'Reset your password';
  const intro = message.template === 'verification'
    ? `Confirm your email address and choose a password to finish creating your ${who.product} account. The link works for 24 hours.`
    : message.template === 'account-exists'
      ? `Someone tried to register for ${who.product} with this email address, but an account already exists. If that was you, sign in, or use the link below to reset your password.`
      : `We received a request to reset the password of your ${who.product} account. The link works for one hour.`;
  const ignore = 'If you did not request this, you can ignore this email; nothing changes until the link is opened.';
  const url = escapeHtml(message.url);
  return {
    html: layout(who, reason, `<p>${escapeHtml(intro)}</p>`
      + `<p style="margin:24px 0"><a href="${url}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#1f2937;color:#ffffff;text-decoration:none;font-weight:600">${action}</a></p>`
      + `<p style="font-size:13px;color:#6b7280">Or paste this link into your browser:<br><span style="word-break:break-all">${url}</span></p>`
      + `<p>${escapeHtml(ignore)}</p>`),
    text: `${intro}\n\n${action}: ${message.url}\n\n${ignore}${textFooter(who, reason)}`,
  };
}

async function sendMail(message) {
  if (transport) {
    await transport.send(message);
    return { delivered: true };
  }
  if (consoleMailActive()) {
    const { text } = template(message);
    console.log(`[Mail:console] Not sent (MAIL_TRANSPORT=console)
To: ${message.to}
Subject: ${message.subject}

${text}
[Mail:console] end`);
    return { delivered: true };
  }
  const apiKey = process.env.RESEND_MAIL_KEY;
  if (!isRealMailKey(apiKey)) throw new Error('Resend email delivery is not configured');
  // No fallback sender: the Resend test address only delivers to the account owner, which would look like success.
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  if (!from) throw new Error('RESEND_FROM_EMAIL is not configured');
  if (!resendClient) resendClient = new Resend(apiKey);
  const content = template(message);
  const { data, error } = await resendClient.emails.send({
    from,
    to: [message.to],
    subject: message.subject,
    html: content.html,
    text: content.text,
  });
  if (error || !data?.id) throw new Error(`Resend email delivery failed${error?.message ? `: ${error.message}` : ''}`);
  return { delivered: true };
}

function link(path, token) {
  const base = process.env.CLIENT_ORIGIN;
  if (!base) throw new Error('CLIENT_ORIGIN is required for account email links');
  const url = new URL(path, base);
  url.searchParams.set('token', token);
  return url.toString();
}

// Client routes for the links. The dashboard also redirects the old /admin/* paths, so mail sent
// before this change still works.
const VERIFY_PATH = '/verify-email';
const RESET_PATH = '/reset-password';

async function sendVerification(user, token) {
  return sendMail({ to: user.email, subject: `Finish creating your ${brand().product} account`, template: 'verification', url: link(VERIFY_PATH, token) });
}

async function sendPasswordReset(user, token) {
  return sendMail({ to: user.email, subject: `Reset your ${brand().product} password`, template: 'password-reset', url: link(RESET_PATH, token) });
}

async function sendAccountExistsNotice(user, token) {
  return sendMail({ to: user.email, subject: `${brand().product}: someone tried to sign up with your email`, template: 'account-exists', url: link(RESET_PATH, token) });
}

async function sendTokenExpiryWarning(user, tokens) {
  if (!tokens?.length) return { delivered: false };
  return sendMail({
    to: user.email,
    subject: `${brand().product}: API key${tokens.length === 1 ? '' : 's'} expiring soon`,
    template: 'token-expiry',
    tokens: tokens.map(({ label, prefix, expiresAt }) => ({ label, prefix, expiresAt })),
  });
}

module.exports = { setMailTransport, isConfigured, isRealMailKey, consoleMailActive, MAIL_TRANSPORTS, sendVerification, sendPasswordReset, sendAccountExistsNotice, sendTokenExpiryWarning, renderMail: template };
