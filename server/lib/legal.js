// Versions of the legal text the dashboard serves (client/src/pages/auth/LegalPage.jsx). Both tiers
// read them from server/contract/legal.json, so one edit there moves the server and the next client
// build together (CB-06). Bump a version whenever the text or one of its operator facts changes;
// signup stores the versions it accepted.
const { termsVersion, privacyVersion } = require('../contract/legal.json');

const TERMS_VERSION = termsVersion;
const PRIVACY_VERSION = privacyVersion;

module.exports = { TERMS_VERSION, PRIVACY_VERSION };
