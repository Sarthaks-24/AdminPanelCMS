const Setting = require('../models/Setting');
const { mailReadinessProblems } = require('./mailReadiness');

const MODES = ['closed', 'invite', 'open'];
const KEY = 'signupMode';

// A production deploy keeps signup closed until the legal documents are approved, whatever the dashboard says.
const legalBlocked = () => process.env.NODE_ENV === 'production' && process.env.LEGAL_POLICIES_APPROVED !== 'true';

// In production, signup also stays closed while account mail cannot work (CB-01): the panel cannot open it
// (409 mail_not_ready) and a setting saved earlier does not take effect until the problems are fixed.
const mailBlocked = () => process.env.NODE_ENV === 'production' && mailReadinessProblems().length > 0;

// Env SIGNUP_MODE, defaulting to closed. Unknown values also mean closed (and are refused at boot, CB-02).
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
  if (legalBlocked() || mailBlocked()) return null;
  const { effective } = await getSignupSetting();
  return effective === 'closed' ? null : effective;
}

async function setSignupMode(mode, userId) {
  if (!MODES.includes(mode)) throw new TypeError('Unsupported signup mode');
  await Setting.updateOne({ key: KEY }, { $set: { value: mode, updatedBy: userId } }, { upsert: true });
}

module.exports = { MODES, envMode, getSignupMode, getSignupSetting, setSignupMode, legalBlocked, mailBlocked };
