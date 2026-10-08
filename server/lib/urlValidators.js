const MAX_URL_LENGTH = 2048;

function isOptionalString(value) {
  return value === undefined || value === null || value === '';
}

function isSafeHttpsUrl(value) {
  if (isOptionalString(value)) return true;
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSafeSocialUrl(value) {
  if (isOptionalString(value)) return true;
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return false;
  if (!value.toLowerCase().startsWith('mailto:')) return isSafeHttpsUrl(value);

  try {
    const url = new URL(value);
    const address = url.pathname;
    return url.protocol === 'mailto:'
      && /^[^\s@?]+@[^\s@?]+\.[^\s@?.]+$/.test(address)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

module.exports = { isSafeHttpsUrl, isSafeSocialUrl, MAX_URL_LENGTH };
