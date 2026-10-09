const Setting = require('../models/Setting');

const MODES = ['invite', 'open'];
const KEY = 'signupMode';

// A production deploy keeps signup closed until the legal documents are approved, whatever the dashboard says.
const legalBlocked = () => process.env.NODE_ENV === 'production' && process.env.LEGAL_POLICIES_APPROVED !== 'true';

function envMode() {
  const mode = process.env.SIGNUP_MODE || 'invite';
  return MODES.includes(mode) ? mode : null;
}

// The superadmin's dashboard choice wins; the SIGNUP_MODE env var is the default until one is saved.
async function getSignupSetting() {
  const stored = await Setting.findOne({ key: KEY }).select('value').lean();
  const dashboard = MODES.includes(stored?.value) ? stored.value : null;
  return { dashboard, env: envMode(), effective: dashboard || envMode() };
}

async function getSignupMode() {
  if (legalBlocked()) return null;
  return (await getSignupSetting()).effective;
}

async function setSignupMode(mode, userId) {
  if (!MODES.includes(mode)) throw new TypeError('Unsupported signup mode');
  await Setting.updateOne({ key: KEY }, { $set: { value: mode, updatedBy: userId } }, { upsert: true });
}

module.exports = { MODES, getSignupMode, getSignupSetting, setSignupMode, legalBlocked };
