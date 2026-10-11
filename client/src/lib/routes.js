/**
 * Where the tenant dashboard and the account pages live.
 *
 * Tenants used to work under /admin/* (self-hosted-CMS vocabulary). The dashboard is now /dashboard/*
 * and the account pages sit at the top level. Old /admin/* links (bookmarks, emails already sent)
 * still work: `legacyAdminTarget` maps them, and the router redirects with the query and hash kept.
 */

export const DASHBOARD = '/dashboard';
export const LOGIN = '/login';

const ACCOUNT_PAGES = new Set(['login', 'signup', 'check-email', 'verify-email', 'forgot-password', 'reset-password']);

/** `/admin/<anything>` → its new home. Returns the path only; callers add the search and hash. */
export function legacyAdminTarget(pathname) {
  const rest = String(pathname || '').replace(/^\/admin\/?/, '').replace(/\/+$/, '');
  if (!rest || rest === 'dashboard') return DASHBOARD;
  if (ACCOUNT_PAGES.has(rest)) return `/${rest}`;
  return `${DASHBOARD}/${rest}`;
}
