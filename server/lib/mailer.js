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
function isConfigured() { return Boolean(transport || (isRealMailKey(process.env.RESEND_MAIL_KEY) && process.env.RESEND_FROM_EMAIL)); }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function template(message) {
  if (message.template === 'token-expiry') {
    const details = message.tokens.map(({ label, prefix, expiresAt }) =>
      `<li>${escapeHtml(label || 'Untitled token')} (${escapeHtml(prefix)}…), expires ${escapeHtml(new Date(expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' }))}</li>`).join('');
    const textDetails = message.tokens.map(({ label, prefix, expiresAt }) =>
      `- ${label || 'Untitled token'} (${prefix}…), expires ${new Date(expiresAt).toISOString().slice(0, 10)}`).join('\n');
    const intro = 'One or more of your API tokens will expire soon. Create a replacement from the dashboard if you still need access.';
    return { html: `<p>${intro}</p><ul>${details}</ul><p>This reminder does not include the token values.</p>`, text: `${intro}\n\n${textDetails}\n\nThis reminder does not include the token values.` };
  }
  const action = message.template === 'verification' ? 'Choose your password' : 'Reset your password';
  const intro = message.template === 'verification'
    ? 'Confirm your email address and choose a password to finish creating your account. The link works for 24 hours.'
    : message.template === 'account-exists'
      ? 'Someone tried to register with this email address, but an account already exists. If that was you, sign in, or use the link below to reset your password.'
      : 'We received a request to reset your account password. The link works for one hour.';
  const url = escapeHtml(message.url);
  return {
    html: `<p>${intro}</p><p><a href="${url}">${action}</a></p><p>If you did not request this, you can ignore this email.</p>`,
    text: `${intro}\n\n${action}: ${message.url}\n\nIf you did not request this, you can ignore this email.`,
  };
}

async function sendMail(message) {
  if (transport) {
    await transport.send(message);
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

async function sendVerification(user, token) {
  return sendMail({ to: user.email, subject: 'Finish creating your account', template: 'verification', url: link('/admin/verify-email', token) });
}

async function sendPasswordReset(user, token) {
  return sendMail({ to: user.email, subject: 'Reset your password', template: 'password-reset', url: link('/admin/reset-password', token) });
}

async function sendAccountExistsNotice(user, token) {
  return sendMail({ to: user.email, subject: 'Account registration requested', template: 'account-exists', url: link('/admin/reset-password', token) });
}

async function sendTokenExpiryWarning(user, tokens) {
  if (!tokens?.length) return { delivered: false };
  return sendMail({
    to: user.email,
    subject: `API token${tokens.length === 1 ? '' : 's'} expiring soon`,
    template: 'token-expiry',
    tokens: tokens.map(({ label, prefix, expiresAt }) => ({ label, prefix, expiresAt })),
  });
}

module.exports = { setMailTransport, isConfigured, isRealMailKey, sendVerification, sendPasswordReset, sendAccountExistsNotice, sendTokenExpiryWarning };
