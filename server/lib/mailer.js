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
function isConfigured() { return Boolean(transport || isRealMailKey(process.env.RESEND_MAIL_KEY)); }

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
  const action = message.template === 'verification' ? 'Verify your email address' : 'Reset your password';
  const intro = message.template === 'verification'
    ? 'Confirm your email address to finish setting up your account.'
    : message.template === 'account-exists'
      ? 'Someone tried to register with this email address. If that was you, use the link below to set or reset your password.'
      : 'We received a request to reset your account password.';
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
  if (!resendClient) resendClient = new Resend(apiKey);
  const content = template(message);
  const { data, error } = await resendClient.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to: [message.to],
    subject: message.subject,
    html: content.html,
    text: content.text,
  });
  if (error || !data?.id) throw new Error('Resend email delivery failed');
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
  return sendMail({ to: user.email, subject: 'Verify your account', template: 'verification', url: link('/admin/verify-email', token) });
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
