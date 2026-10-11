const Setting = require('../models/Setting');

// Daily outbound mail budget. The counter lives in Setting key `mail:YYYY-MM-DD` and is advanced with an
// atomic, filtered $inc so concurrent sends cannot overshoot the cap. The last MAIL_RESET_RESERVE units of
// the cap are spendable only by password-reset mail, so a signup flood cannot lock existing users out.
const nonNegativeInt = (value, fallback) => {
  const number = Number(value);
  return value !== undefined && value !== '' && Number.isInteger(number) && number >= 0 ? number : fallback;
};
const dailyCap = () => nonNegativeInt(process.env.MAIL_DAILY_CAP, 500);
const resetReserve = () => Math.min(nonNegativeInt(process.env.MAIL_RESET_RESERVE, 50), dailyCap());
const dayOf = (now = new Date()) => now.toISOString().slice(0, 10);
const keyFor = (day) => `mail:${day}`;

// Returns true when one unit was reserved, false when the day's budget is spent.
async function reserveMail({ reset = false, now = new Date() } = {}) {
  const limit = reset ? dailyCap() : dailyCap() - resetReserve();
  if (limit <= 0) return false;
  const key = keyFor(dayOf(now));
  await Setting.updateOne({ key }, { $setOnInsert: { value: 0 } }, { upsert: true });
  const result = await Setting.updateOne({ key, value: { $lt: limit } }, { $inc: { value: 1 } });
  return result.modifiedCount === 1;
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
