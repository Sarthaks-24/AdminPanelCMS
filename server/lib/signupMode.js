const Setting = require('../models/Setting');

const MODES = ['closed', 'invite', 'open'];
const KEY = 'signupMode';

// A production deploy keeps signup closed until the legal documents are approved, whatever the dashboard says.
const legalBlocked = () => process.env.NODE_ENV === 'production' && process.env.LEGAL_POLICIES_APPROVED !== 'true';

// Env SIGNUP_MODE, defaulting to closed. Unknown values also mean closed.
function envMode(env = process.env) {
  const mode = String(env.SIGNUP_MODE || 'closed').trim().toLowerCase();
  return MODES.includes(mode) ? mode : 'closed';
}

// The superadmin's dashboard choice wins (including `closed`); the SIGNUP_MODE env var is the default until one is saved.
async function getSignupSetting() {
  const stored = await Setting.findOne({ key: KEY }).select('value').lean();
  const dashboard = MODES.includes(stored?.value) ? stored.value : null;
  return { dashboard, env: envMode(), effective: dashboard || envMode() };
}

// Returns 'invite' | 'open', or null when signup is closed.
async function getSignupMode() {
  if (legalBlocked()) return null;
  const { effective } = await getSignupSetting();
  return effective === 'closed' ? null : effective;
}

async function setSignupMode(mode, userId) {
  if (!MODES.includes(mode)) throw new TypeError('Unsupported signup mode');
  await Setting.updateOne({ key: KEY }, { $set: { value: mode, updatedBy: userId } }, { upsert: true });
}

module.exports = { MODES, envMode, getSignupMode, getSignupSetting, setSignupMode, legalBlocked };
