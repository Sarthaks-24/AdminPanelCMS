const Setting = require('../models/Setting');
const logger = require('./logger');
const { burstAlert } = require('./alerts');
const { envNumber } = require('./envNumber');

// Daily outbound mail budget. The counter lives in Setting key `mail:YYYY-MM-DD` and is advanced with an
// atomic, filtered $inc so concurrent sends cannot overshoot the cap. The last MAIL_RESET_RESERVE units of
// the cap are spendable only by password-reset mail, so a signup flood cannot lock existing users out.
// Defaults (95 a day, 20 for resets) sit under the Resend free tier of 100 a day, so the provider never
// refuses before the budget does (BE-04). Blank means the default; see lib/envNumber.js.
const dailyCap = () => envNumber('MAIL_DAILY_CAP');
const resetReserve = () => Math.min(envNumber('MAIL_RESET_RESERVE'), dailyCap());
const dayOf = (now = new Date()) => now.toISOString().slice(0, 10);
const keyFor = (day) => `mail:${day}`;

// At most one exhaustion alert per budget kind every 10 minutes, however many requests are refused.
const exhausted = burstAlert('mail_budget_exhausted', { threshold: 1, windowMs: 10 * 60 * 1000 });

// Alerts fire on the exact unit that crosses a line, so each is logged once per day however many sends follow:
// half of the whole cap, half of the reset reserve (the reserve starts where the non-reset budget ends).
function alertOnThreshold(sent, day) {
  const cap = dailyCap();
  const reserve = resetReserve();
  const fields = { day, sent, cap, reserve };
  if (cap > 0 && sent === Math.max(1, Math.ceil(cap / 2))) logger.alert('mail_budget_half', fields);
  if (reserve > 0 && sent === cap - reserve + Math.max(1, Math.ceil(reserve / 2))) logger.alert('mail_reset_reserve_half', fields);
}

// Returns true when one unit was reserved, false when the day's budget is spent.
async function reserveMail({ reset = false, now = new Date() } = {}) {
  const limit = reset ? dailyCap() : dailyCap() - resetReserve();
  if (limit <= 0) return false;
  const day = dayOf(now);
  const key = keyFor(day);
  await Setting.updateOne({ key }, { $setOnInsert: { value: 0 } }, { upsert: true });
  const updated = await Setting.findOneAndUpdate({ key, value: { $lt: limit } }, { $inc: { value: 1 } }, { returnDocument: 'after' }).select('value').lean();
  if (!updated) {
    exhausted.hit(reset ? 'reset' : 'general', { day, cap: dailyCap(), reserve: resetReserve() });
    return false;
  }
  alertOnThreshold(Number(updated.value), day);
  return true;
}

// Gives a reserved unit back when no mail ended up being sent.
async function refundMail({ now = new Date() } = {}) {
  await Setting.updateOne({ key: keyFor(dayOf(now)), value: { $gt: 0 } }, { $inc: { value: -1 } });
}

async function mailBudgetStatus(now = new Date()) {
  const day = dayOf(now);
  const stored = await Setting.findOne({ key: keyFor(day) }).select('value').lean();
  return { day, sent: Number(stored?.value) || 0, cap: dailyCap(), reserve: resetReserve() };
}

// Per-recipient cooldown kept in process memory: at most one send every `gapMs` and `perDay` sends per
// rolling day for the same address. Only consulted for addresses that have an account, and the caller still
// answers with the generic response, so it reveals nothing to a stranger.
const recipients = new Map();
const DAY_MS = 24 * 60 * 60 * 1000;

function recipientAllowed(kind, email, { gapMs = 5 * 60 * 1000, perDay = 3, now = Date.now() } = {}) {
  const key = `${kind}:${String(email).toLowerCase()}`;
  const sends = (recipients.get(key) || []).filter((at) => now - at < DAY_MS);
  if (sends.length >= perDay || (sends.length && now - sends[sends.length - 1] < gapMs)) {
    recipients.set(key, sends);
    return false;
  }
  sends.push(now);
  recipients.set(key, sends);
  if (recipients.size > 50_000) recipients.delete(recipients.keys().next().value);
  return true;
}

function resetRecipientCooldowns() { recipients.clear(); }

module.exports = { reserveMail, refundMail, mailBudgetStatus, recipientAllowed, resetRecipientCooldowns, dailyCap, resetReserve };
