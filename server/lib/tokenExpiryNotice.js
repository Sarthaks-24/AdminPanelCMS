const ApiToken = require('../models/ApiToken');
const User = require('../models/User');
const mailer = require('./mailer');
const { reserveMail, refundMail } = require('./mailBudget');
const logger = require('./logger');
const { envNumber } = require('./envNumber');

const DAY_MS = 24 * 60 * 60 * 1000;

function warningDays(env = process.env) {
  const days = Number(env.TOKEN_EXPIRY_WARNING_DAYS || 7);
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('TOKEN_EXPIRY_WARNING_DAYS must be an integer from 1 to 30.');
  return days;
}

// Emails each active owner about their API keys that expire within the warning window, once per key.
// It walks owners one at a time so every ApiToken query carries a concrete owner (ownerGuard has no bypass).
// Each mail takes a unit of the daily budget; when the budget is spent the rest wait for the next run.
async function notifyExpiringTokens({ now = new Date() } = {}) {
  const deadline = new Date(now.getTime() + warningDays() * DAY_MS);
  const result = { owners: 0, tokens: 0, failed: 0, deferred: 0 };
  const owners = User.find({ status: 'active', emailVerifiedAt: { $ne: null } }).select('_id email').lean().cursor();
  for await (const user of owners) {
    const group = await ApiToken.find({ owner: user._id, revokedAt: null, expiryWarningSentAt: null, expiresAt: { $gt: now, $lte: deadline } })
      .select('_id owner prefix label expiresAt').sort({ expiresAt: 1 }).lean();
    if (!group.length) continue;
    if (!(await reserveMail())) { result.deferred += group.length; continue; }
    try {
      await mailer.sendTokenExpiryWarning(user, group);
      await ApiToken.updateMany({ _id: { $in: group.map((token) => token._id) }, owner: user._id, expiryWarningSentAt: null }, { $set: { expiryWarningSentAt: new Date() } });
      result.owners += 1;
      result.tokens += group.length;
    } catch (error) {
      await refundMail();
      result.failed += group.length;
      logger.event('mail_failed', { template: 'token-expiry', userId: String(user._id), err: error?.message || String(error) });
    }
  }
  if (result.deferred) logger.alert('token_expiry_deferred', { tokens: result.deferred, reason: 'mail_budget' });
  return result;
}

// Daily in-process schedule next to the deleted-account sweep. Only an explicit TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS=0 disables it;
// it also stays off when mail is not configured (nothing could be sent).
function startExpiryNotices({ log = logger } = {}) {
  const hours = envNumber('TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS');
  if (hours <= 0) {
    if (process.env.NODE_ENV === 'production') log.warn({ event: 'token_expiry_notices_disabled' }, 'token expiry notices DISABLED: TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS=0');
    return null;
  }
  if (!mailer.isConfigured()) { log.warn({ event: 'token_expiry_notices_disabled' }, 'token expiry notices are off: mail is not configured'); return null; }
  warningDays();
  const run = async () => {
    try {
      const result = await notifyExpiringTokens();
      if (result.tokens || result.failed || result.deferred) log.info({ event: 'token_expiry_notices', ...result }, 'token expiry notices sent');
    } catch (error) { log.error({ err: error }, 'token expiry notices failed'); }
  };
  const first = setTimeout(run, 5 * 60_000);
  const timer = setInterval(run, hours * 60 * 60 * 1000);
  first.unref(); timer.unref();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = { notifyExpiringTokens, startExpiryNotices, warningDays };
