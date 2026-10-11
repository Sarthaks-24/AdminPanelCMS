// Per-email-domain daily signup cap (SEC5). Scripted signups of random addresses tend to share a domain (or a
// handful of throwaway ones); capping each domain per UTC day bounds how much of the mail budget one domain can
// take. SIGNUP_DOMAIN_DAILY_CAP=0 disables it. In process memory, so a restart resets the day's counts.
const { envNumber } = require('./envNumber');

const dailyCap = () => envNumber('SIGNUP_DOMAIN_DAILY_CAP');

let day = null;
const counts = new Map();

const domainOf = (email) => String(email).slice(String(email).lastIndexOf('@') + 1).toLowerCase();

// Takes one unit for the address's domain. Returns false (and takes nothing) when the domain is at its cap.
function takeSignupSlot(email, now = new Date()) {
  const cap = dailyCap();
  if (cap === 0) return true;
  const today = now.toISOString().slice(0, 10);
  if (today !== day) { day = today; counts.clear(); }
  const domain = domainOf(email);
  const used = counts.get(domain) || 0;
  if (used >= cap) return false;
  counts.set(domain, used + 1);
  if (counts.size > 100_000) counts.delete(counts.keys().next().value);
  return true;
}

// Gives the unit back when the signup ended without a new account (existing address, refused invite).
function releaseSignupSlot(email) {
  const domain = domainOf(email);
  const used = counts.get(domain) || 0;
  if (used > 1) counts.set(domain, used - 1); else counts.delete(domain);
}

function resetSignupDomainCounts() { counts.clear(); day = null; }

module.exports = { takeSignupSlot, releaseSignupSlot, resetSignupDomainCounts, domainOf };
