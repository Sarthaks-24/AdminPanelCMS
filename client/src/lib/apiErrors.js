/**
 * One decoder for every error the dashboard can show.
 *
 * Two shapes arrive here:
 *  - `/v1` (the public API a tenant's own apps call): `{ error, message, requestId, section? }`
 *  - `/api` (this dashboard):                        `{ success:false, error, message?, details?, resource?, limit? }`
 * plus axios network errors (no `response` at all) and the browser's `TypeError: Failed to fetch`.
 *
 * Every entry says what went wrong and where to fix it, in the product's own words.
 * The same table is mirrored in docs/LIMITS_AND_ERRORS.md, so keep the copy in step.
 */

const SECTION_LABELS = {
  profile: 'Profile', resume: 'Résumé', socials: 'Links', skills: 'Skills', projects: 'Projects',
  experience: 'Work experience', education: 'Education', certifications: 'Certifications', fs: 'File tree',
};

const SECTION_ROUTES = {
  profile: '/admin/profile', resume: '/admin/resume', socials: '/admin/socials', skills: '/admin/skills',
  projects: '/admin/projects', experience: '/admin/experience', education: '/admin/education',
  certifications: '/admin/certifications',
};

const appRoute = (appId) => (appId ? `/admin/apps/${appId}` : '/admin/apps');

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
    message: 'Your browser blocked the response. Usually your site’s origin isn’t on this App’s list, or the key is wrong. Check the status in the Network tab.',
    fix: { label: 'Allowed origins', to: appRoute(ctx.appId) },
  }),
  token_missing: (body, ctx) => keyProblem(ctx),
  token_invalid: (body, ctx) => keyProblem(ctx),
  account_unavailable: () => ({
    title: 'Account unavailable',
    message: 'This account is suspended or being deleted, so its keys no longer answer. Contact support if that is a surprise.',
    fix: { label: 'Account', to: '/admin/account' },
  }),
  account_inactive: () => V1.account_unavailable(),
  token_in_query: (body, ctx) => keyProblem(ctx),
  token_type_mismatch: (body, ctx) => ({
    title: 'Wrong kind of key',
    message: 'This key doesn’t match where the App fetches from: Build or server Apps take a secret key (sk_), Visitors’ browsers Apps take a publishable key (pk_).',
    fix: { label: 'Keys', to: appRoute(ctx.appId) },
  }),
  not_configured: (body, ctx) => (ctx.path?.includes('/resume')
    ? { title: 'No résumé yet', message: 'You haven’t saved a résumé link yet.', fix: { label: 'Résumé', to: '/admin/resume' } }
    : { title: 'No profile yet', message: 'You haven’t saved a profile yet.', fix: { label: 'Profile', to: '/admin/profile' } }),
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
    message: `Something broke on our side. Try again; if it keeps happening, tell us the request id${body.requestId ? ` ${body.requestId}` : ''}.`,
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
    fix: { label: 'Account', to: '/admin/account' },
  }),
  conflict: (body) => ({
    title: 'Already exists',
    message: body.message || 'Something with that name or slug already exists. Pick another.',
    fix: null,
  }),
  rate_limited: () => ({
    title: 'Slow down',
    message: 'Too many requests from this device. Wait a minute and try again.',
    fix: null,
  }),
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
  invite_locked: () => ({
    title: 'Too many attempts',
    message: 'Too many invite attempts from this network. Try again in an hour.',
    fix: null,
  }),
  internal: (body) => V1.internal(body),
};

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
 * @param {{ appId?: string, path?: string, fallback?: string }} [ctx]
 * @returns {{ code: string|null, status: number|null, title: string, message: string, fix: {label:string,to:string}|null, requestId: string|null, section: string|null }}
 */
export function describeApiError(errOrResponse, ctx = {}) {
  const { status, body, headers, network, browserBlocked } = unwrap(errOrResponse);
  const retryAfter = retryAfterSeconds(headers);
  const context = { ...ctx, retryAfter };

  if (browserBlocked) {
    return { code: 'origin_not_allowed', status: null, ...V1.origin_not_allowed(body, context), requestId: null, section: null };
  }
  if (network) {
    return { code: 'network', status: null, ...NETWORK, requestId: null, section: null };
  }

  const code = typeof body.error === 'string' ? body.error : null;
  const describe = code && (V1[code] || API[code]);
  let described;
  if (describe) described = describe(body, context);
  else if (status === 401) described = keyProblem(context);
  else if (status === 429) described = API.rate_limited(body, context);
  else if (status === 503) described = V1.busy(body, context);
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
