import axios from 'axios';

// Chosen at build time by vite.config.js from VITE_MODE and the VITE_*_API_URL settings.
const baseURL = import.meta.env.VITE_RESOLVED_API_URL;

// The session lives in an httpOnly cookie the server sets; scripts (and XSS) can never read it.
export const api = axios.create({
  baseURL,
  withCredentials: true,
  // A blackholed host would otherwise hang until the browser gives up, which on the public pages
  // means the signup-mode probe never settles and the nav never finishes deciding what to show.
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
    // Required by the server for cookie-authenticated writes (CSRF defence).
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Response interceptor: a 401 on a dashboard page means the session ended (expired, signed out in
// another tab, password changed). AuthContext hears the event, clears the user, and ProtectedRoute
// sends the visitor to /login with a way back, without a full page reload.
export const SESSION_EXPIRED_EVENT = 'pc:session-expired';

// The 401 codes that mean "your session is gone" (server/middleware/requireSession.js). Any other 401
// with a code, such as credentials_invalid from a mistyped re-auth password, is an answer to that one
// request: it must not sign the user out (FE-01).
export const SESSION_ERROR_CODES = new Set(['auth_required', 'invalid_session', 'session_expired', 'account_inactive', 'invalid_token_type']);

/** True when an axios error says the session ended: a 401 with a session code, or with no code at all. */
export function endsSession(error) {
  if (error?.response?.status !== 401) return false;
  const code = error.response.data?.error;
  return typeof code !== 'string' || !code || SESSION_ERROR_CODES.has(code);
}

// A successful write to a content section. The sidebar listens and refreshes its counts.
export const CONTENT_CHANGED_EVENT = 'pc:content-changed';
const CONTENT_PATH = /^\/?(profile|socials|skills|projects|experience|education|certifications|resume)(\/|$)/;

api.interceptors.response.use(
  (response) => {
    const { method, url } = response.config || {};
    if (method && method !== 'get' && CONTENT_PATH.test(url || '') && typeof window !== 'undefined') window.dispatchEvent(new Event(CONTENT_CHANGED_EVENT));
    return response;
  },
  (error) => {
    // The startup session probe expects a 401 when signed out and must not trigger a redirect.
    if (endsSession(error) && !error.config?.skipAuthRedirect && window.location.pathname.startsWith('/dashboard')) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);
