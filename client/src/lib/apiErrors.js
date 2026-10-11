/**
 * One decoder for every error the dashboard can show.
 *
 * Two shapes arrive here:
 *  - `/v1` (the public API a tenant's own apps call): `{ error, message, requestId, section? }`
 *  - `/api` (this dashboard):                        `{ success:false, error, message?, details?, resource?, limit? }`
 * plus axios network errors (no `response` at all) and the browser's `TypeError: Failed to fetch`.
 *
 * The two surfaces share some codes (`rate_limited`, `not_found`, `bad_request`, `internal`) with different
 * meanings, so the caller says which surface the error came from: `ctx.surface` is `'api'` (the
 * default: every dashboard request) or `'v1'` (a tenant's own app calling the public API, as shown in
 * ConnectPanel's lookup table). Each surface's table is tried first, then the other's.
 *
 * Every entry says what went wrong and where to fix it, in the product's own words.
 * The same table is mirrored in docs/LIMITS_AND_ERRORS.md, so keep the copy in step.
 */
import { SITE } from '../content/site';

const SECTION_LABELS = {
  profile: 'Profile', resume: 'Résumé', socials: 'Links', skills: 'Skills', projects: 'Projects',
  experience: 'Work experience', education: 'Education', certifications: 'Certifications', fs: 'File tree',
};

const SECTION_ROUTES = {
  profile: '/dashboard/profile', resume: '/dashboard/resume', socials: '/dashboard/socials', skills: '/dashboard/skills',
  projects: '/dashboard/projects', experience: '/dashboard/experience', education: '/dashboard/education',
  certifications: '/dashboard/certifications',
};

const appRoute = (appId) => (appId ? `/dashboard/apps/${appId}` : '/dashboard/apps');

function retryAfterSeconds(headers) {
  const raw = headers?.['retry-after'] ?? headers?.get?.('retry-after');
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The `/v1` codes from the API contract (§1). `ctx.appId` makes the fix links point into the right App. */
const V1 = {
  section_disabled: (body, ctx) => {
    const section = body.section;
    return {
      title: 'Section is off',
      message: `The ${SECTION_LABELS[section] || section || 'requested'} section is off for this App.`,
      fix: { label: 'Turn it on', to: appRoute(ctx.appId) },
    };
  },
  origin_not_allowed: (body, ctx) => ({
    title: 'Origin not allowed',
    message: 'This site’s origin isn’t on this App’s list of allowed origins. Add it (scheme and host, no path), or use a build-time fetch with a secret key.',
    fix: { label: 'Allowed origins', to: appRoute(ctx.appId) },
  }),
  token_missing: (body, ctx) => keyProblem(ctx),
  token_invalid: (body, ctx) => keyProblem(ctx),
  account_unavailable: () => ({
    title: 'Account unavailable',
    message: `This account is suspended or being deleted, so its keys no longer answer. If that is a surprise, email ${SITE.support.email}.`,
    fix: { label: 'Account', to: '/dashboard/account' },
  }),
  account_inactive: () => V1.account_unavailable(),
  token_in_query: (body, ctx) => keyProblem(ctx),
  token_type_mismatch: (body, ctx) => ({
    title: 'Wrong kind of key',
    message: 'This key doesn’t match where the App fetches from: Build or server Apps take a secret key (sk_), Visitors’ browsers Apps take a publishable key (pk_).',
    fix: { label: 'Keys', to: appRoute(ctx.appId) },
  }),
  not_configured: (body, ctx) => (ctx.path?.includes('/resume')
    ? { title: 'No résumé yet', message: 'You haven’t saved a résumé link yet.', fix: { label: 'Résumé', to: '/dashboard/resume' } }
    : { title: 'No profile yet', message: 'You haven’t saved a profile yet.', fix: { label: 'Profile', to: '/dashboard/profile' } }),
  not_found: () => ({
    title: 'Not found',
    message: 'No such endpoint or item. Check the URL ends in /v1/<section> and the slug matches a published item.',
    fix: { label: 'API reference', to: '/docs/api' },
  }),
  bad_request: (body) => ({
    title: 'Bad request',
    message: body.message || 'The request was malformed. Check the query string and the path.',
    fix: { label: 'API reference', to: '/docs/api' },
  }),
  rate_limited: (body, ctx) => {
    const text = String(body.message || '').toLowerCase();
    const wait = ctx.retryAfter ? ` Retry after ${ctx.retryAfter} s.` : '';
    if (text.includes('account')) {
      return {
        title: 'Account limit',
        message: `More than 10 uncached requests in one second. Fetch lists once, one after another.${wait}`,
        fix: { label: 'Snippet', to: appRoute(ctx.appId) },
      };
    }
    return {
      title: 'Key limit',
      message: `This key hit its per-minute limit. Browser keys are shared by every visitor; fetch at build time.${wait}`,
      fix: { label: 'Build snippet', to: appRoute(ctx.appId) },
    };
  },
  busy: (body, ctx) => ({
    title: 'Service busy',
    message: `The service is busy. Retry after ${ctx.retryAfter || 1} s; builds should honour Retry-After.`,
    fix: { label: 'Limits', to: '/docs/limits' },
  }),
  internal: (body) => ({
    title: 'Something broke on our side',
    message: `Something broke on our side. Try again; if it keeps happening, email ${SITE.support.email} with the request id${body.requestId ? ` ${body.requestId}` : ''}.`,
    fix: null,
  }),
};

function keyProblem(ctx) {
  return {
    title: 'Key problem',
    message: 'This key is missing, mistyped, revoked or expired. Send it as “Authorization: Bearer …”, never in the URL.',
    fix: { label: 'Keys', to: appRoute(ctx.appId) },
  };
}

/** The `/api` (dashboard) codes. */
const API = {
  validation_failed: (body) => ({
    title: 'Check the form',
    message: Array.isArray(body.details) && body.details.length
      ? body.details.join(' · ')
      : (body.message || 'Some fields didn’t pass validation. Check the highlighted ones and try again.'),
    fix: null,
  }),
  quota_exceeded: (body) => {
    const noun = body.resource === 'tokens' ? 'active keys for this App' : body.resource === 'apps' ? 'Apps' : (body.resource ? `${body.resource} items` : 'items in this section');
    return {
      title: 'Limit reached',
      message: body.message || `You’ve reached the limit of ${body.limit ?? 100} ${noun}. Delete or revoke one to add another.`,
      fix: { label: 'Limits', to: '/docs/limits' },
    };
  },
  email_unverified: () => ({
    title: 'Verify your email',
    message: 'Verify your email before changing content or creating keys. Check your inbox for the link, or resend it.',
    fix: { label: 'Account', to: '/dashboard/account' },
  }),
  conflict: (body) => ({
    title: 'Already exists',
    message: body.message || 'Something with that name or slug already exists. Pick another.',
    fix: null,
  }),
  rate_limited: (body) => (/domain/i.test(String(body.message || ''))
    ? { title: 'Domain limit', message: 'Too many signups from this email domain today. Try again tomorrow, or use another address.', fix: null }
    : { title: 'Slow down', message: 'Too many requests from this device. Wait a minute and try again.', fix: null }),
  busy: (body, ctx) => ({
    title: 'Service busy',
    message: `The service is busy. Try again in ${ctx.retryAfter || 'a few'} second${ctx.retryAfter === 1 ? '' : 's'}.`,
    fix: null,
  }),
  storage_full: () => ({
    title: 'Saving is paused',
    message: 'The service is out of storage space, so changes cannot be saved right now. Deleting items still works. Please try again later.',
    fix: null,
  }),
  invite_invalid: () => ({
    title: 'Invite not valid',
    message: 'That invite code is invalid or has expired. Codes are 12 characters; dashes and spaces are ignored.',
    fix: null,
  }),
  captcha_required: () => ({ title: 'Verification needed', message: 'Complete the verification check, then try again.', fix: null }),
  captcha_failed: () => ({ title: 'Verification failed', message: 'The verification check did not pass. Try it again.', fix: null }),
  captcha_unavailable: () => ({ title: 'Verification unavailable', message: 'Verification is temporarily unavailable. Please try again in a minute.', fix: null }),
  mail_budget: () => ({
    title: 'Email paused',
    message: 'We’ve sent today’s quota of emails. Try again tomorrow, or sign in if you already have an account.',
    fix: null,
  }),
  payload_too_large: () => ({
    title: 'Too large',
    message: 'That’s more than 256 KB. Shorten the text or remove an image URL.',
    fix: null,
  }),
  bad_request: (body) => ({
    title: 'Bad request',
    message: body.message || 'The request was malformed. Reload the page and try again.',
    fix: null,
  }),
  credentials_invalid: () => ({
    title: 'Sign-in failed',
    message: 'Invalid credentials or unverified email.',
    fix: null,
  }),
  not_found: (body) => ({
    title: 'Not found',
    message: body.message || 'That item no longer exists. It may have been deleted in another tab.',
    fix: null,
  }),
  mail_not_ready: (body) => {
    const reasons = [body.reasons, body.details].find((list) => Array.isArray(list) && list.length);
    return {
      title: 'Email is not ready',
      message: `Registration can’t be opened until the service can send verification email.${reasons ? ` ${reasons.join(' · ')}` : (body.message ? ` ${body.message}` : '')}`,
      fix: null,
    };
  },
  invite_locked: () => ({
    title: 'Too many attempts',
    message: 'Too many invite attempts from this network. Try again in an hour.',
    fix: null,
  }),
  internal: (body) => V1.internal(body),
};

/** A dashboard 401 without a code means the session ended, not that an API key is wrong. */
const SESSION_ENDED = {
  title: 'Signed out',
  message: 'Your session ended. Sign in again to continue.',
  fix: { label: 'Sign in', to: '/login' },
};

const BROWSER_FETCH_FAILED = (ctx) => ({
  title: 'Request never answered',
  message: 'The browser got no response. Usually a secret key (sk_) used in a browser, or a wrong host, or a network or DNS failure. Use a publishable key (pk_) in browsers and check the base URL.',
  fix: { label: 'Keys', to: appRoute(ctx.appId) },
});

const NETWORK = {
  title: 'Can’t reach the service',
  message: 'We couldn’t reach the service. Check your connection and try again.',
  fix: null,
};

/**
 * Normalise anything thrown or returned into `{ status, body, headers, network }`.
 * Accepts an axios error, a fetch Response-like `{ status, data|body, headers }`, or a raw body object.
 */
function unwrap(input) {
  if (!input) return { status: null, body: {}, headers: null, network: true };
  if (input.response) {
    const { status, data, headers } = input.response;
    return { status, body: data && typeof data === 'object' ? data : {}, headers, network: false };
  }
  if (input.isAxiosError || input.code === 'ERR_NETWORK' || input.code === 'ECONNABORTED') return { status: null, body: {}, headers: null, network: true };
  if (input instanceof TypeError && /fetch/i.test(input.message)) return { status: null, body: {}, headers: null, network: true, browserBlocked: true };
  if (typeof input.status === 'number') {
    const body = input.data ?? input.body ?? {};
    return { status: input.status, body: body && typeof body === 'object' ? body : {}, headers: input.headers, network: false };
  }
  if (typeof input === 'object' && (input.error || input.message)) return { status: null, body: input, headers: null, network: false };
  return { status: null, body: {}, headers: null, network: true };
}

/**
 * @param {unknown} errOrResponse axios error, fetch Response-like, or raw error body
 * @param {{ surface?: 'api'|'v1', appId?: string, path?: string, fallback?: string }} [ctx]
 * @returns {{ code: string|null, status: number|null, title: string, message: string, fix: {label:string,to:string}|null, requestId: string|null, section: string|null }}
 */
export function describeApiError(errOrResponse, ctx = {}) {
  const { status, body, headers, network, browserBlocked } = unwrap(errOrResponse);
  const retryAfter = retryAfterSeconds(headers);
  const context = { ...ctx, retryAfter };

  if (browserBlocked) {
    // /v1 errors carry CORS headers, so a readable 403/401 arrives as a response. A bare
    // "Failed to fetch" means the request never got an answer the browser would show.
    return { code: 'fetch_failed', status: null, ...BROWSER_FETCH_FAILED(context), requestId: null, section: null };
  }
  if (network) {
    return { code: 'network', status: null, ...NETWORK, requestId: null, section: null };
  }

  const code = typeof body.error === 'string' ? body.error : null;
  const v1 = ctx.surface === 'v1';
  const [first, second] = v1 ? [V1, API] : [API, V1];
  const describe = code && (first[code] || second[code]);
  let described;
  if (describe) described = describe(body, context);
  else if (status === 401) described = v1 ? keyProblem(context) : SESSION_ENDED;
  else if (status === 429) described = (v1 ? V1 : API).rate_limited(body, context);
  else if (status === 503) described = (v1 ? V1 : API).busy(body, context);
  else if (status === 413) described = API.payload_too_large(body, context);
  else if (status >= 500) described = V1.internal(body, context);
  else described = { title: 'Something went wrong', message: body.message || ctx.fallback || 'The request failed. Try again.', fix: null };

  return { code, status: status ?? null, ...described, requestId: body.requestId || null, section: body.section || null };
}

/** The one-line form for catch blocks that only hold a string. */
export function apiErrorMessage(errOrResponse, fallback) {
  const described = describeApiError(errOrResponse, { fallback });
  return described.message || fallback;
}

export const ERROR_SECTION_LABELS = SECTION_LABELS;
export const ERROR_SECTION_ROUTES = SECTION_ROUTES;
