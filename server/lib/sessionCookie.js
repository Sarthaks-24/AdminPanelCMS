const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === 'production';
// `none` is needed only when the dashboard and API are on different sites; it requires HTTPS.
function sameSite() {
  const value = String(process.env.SESSION_COOKIE_SAMESITE || 'lax').toLowerCase();
  return ['lax', 'strict', 'none'].includes(value) ? value : 'lax';
}
const secure = () => isProduction() || sameSite() === 'none';
// Fixed name so changing environment settings never silently logs everyone out.
const cookieName = () => 'session';

// A SameSite=None cookie is a third-party cookie on the dashboard's pages. Browsers that block those
// (Chrome Incognito, for one) still keep a Partitioned (CHIPS) cookie; browsers without CHIPS ignore it.
const partitioned = () => sameSite() === 'none';

function attributes(extra = '', { partition = partitioned() } = {}) {
  return `Path=/; HttpOnly; SameSite=${sameSite()[0].toUpperCase()}${sameSite().slice(1)}${secure() ? '; Secure' : ''}${partition ? '; Partitioned' : ''}${extra}`;
}

// A partitioned and an unpartitioned cookie of the same name are separate cookies, so also expire any
// unpartitioned one set before Partitioned was added; otherwise a stale copy could be read first.
function clearLegacyCookie(res) {
  if (partitioned()) res.append('Set-Cookie', `${cookieName()}=; ${attributes('; Max-Age=0', { partition: false })}`);
}

function setSessionCookie(res, token) {
  res.append('Set-Cookie', `${cookieName()}=${token}; ${attributes(`; Max-Age=${SESSION_MS / 1000}`)}`);
  clearLegacyCookie(res);
}

function clearSessionCookie(res) {
  res.append('Set-Cookie', `${cookieName()}=; ${attributes('; Max-Age=0')}`);
  clearLegacyCookie(res);
}

function readSessionCookie(req) {
  const name = cookieName();
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim() || null;
  }
  return null;
}

module.exports = { setSessionCookie, clearSessionCookie, readSessionCookie };
