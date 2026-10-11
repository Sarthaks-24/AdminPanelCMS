const logger = require('./logger');

// Optional Cloudflare Turnstile check on the public mail-sending endpoints (SEC5). It is on only when
// TURNSTILE_SECRET_KEY is set; the dashboard learns the site key from GET /api/auth/config and sends the widget's
// response as `captchaToken` in the JSON body.
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 5000;

const secret = () => String(process.env.TURNSTILE_SECRET_KEY || '').trim();
const isEnabled = () => Boolean(secret());
const siteKey = () => (isEnabled() ? String(process.env.TURNSTILE_SITE_KEY || '').trim() || null : null);

// Resolves { ok: true } or { ok: false, reason: 'missing' | 'failed' | 'unavailable' }.
async function verifyTurnstile(token, remoteip) {
  if (typeof token !== 'string' || !token || token.length > 2048) return { ok: false, reason: 'missing' };
  const body = new URLSearchParams({ secret: secret(), response: token });
  if (remoteip) body.set('remoteip', remoteip);
  try {
    const response = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const result = await response.json();
    if (result?.success === true) return { ok: true };
    return { ok: false, reason: 'failed', codes: Array.isArray(result?.['error-codes']) ? result['error-codes'].slice(0, 5) : [] };
  } catch (error) {
    return { ok: false, reason: 'unavailable', err: error?.message || String(error) };
  }
}

// Express middleware. A no-op while Turnstile is not configured. Fails closed when Cloudflare cannot be reached:
// these endpoints only send mail, so a short outage costs a retry, not an account.
async function requireTurnstile(req, res, next) {
  if (!isEnabled()) return next();
  try {
    const result = await verifyTurnstile(req.body?.captchaToken, req.ip);
    if (result.ok) return next();
    logger.event('captcha_rejected', { reqId: req.id, path: req.path, reason: result.reason, codes: result.codes, err: result.err });
    if (result.reason === 'unavailable') {
      return res.status(503).json({ success: false, error: 'captcha_unavailable', message: 'Verification is temporarily unavailable. Please try again in a minute.' });
    }
    return res.status(400).json({ success: false, error: result.reason === 'missing' ? 'captcha_required' : 'captcha_failed', message: 'Complete the verification challenge and try again.' });
  } catch (error) { return next(error); }
}

module.exports = { isEnabled, siteKey, verifyTurnstile, requireTurnstile, VERIFY_URL };
