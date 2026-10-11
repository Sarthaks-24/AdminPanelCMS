// Response headers browser code may read on /v1 (CORS Access-Control-Expose-Headers).
const V1_EXPOSE_HEADERS = 'ETag, Retry-After, RateLimit, RateLimit-Policy, X-Request-Id';

// The one error shape every /v1 response uses (contract §1):
//   { error: '<snake_code>', message: '<human>', requestId: '<id>', ...extra }
// `extra` carries the optional `section` (403 section_disabled), `param` (400 bad_request) or `fields`.
// An error answered before the origin check (token_missing, token_invalid, account_unavailable,
// origin_not_allowed, the pre-auth 429, the pre-DB 503) would otherwise carry no CORS headers and
// reach browser code as an opaque "Failed to fetch". Errors carry no tenant content, so a browser
// request (one with an Origin) may always read them; successful responses keep the per-App origin rule.
function v1Error(res, status, code, message, extra = {}) {
  const origin = res.req?.get?.('origin');
  if (origin && !res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Expose-Headers', V1_EXPOSE_HEADERS);
    res.setHeader('Vary', 'Authorization, Origin');
  }
  return res.status(status).json({ error: code, message, requestId: res.req?.id, ...extra });
}

module.exports = { v1Error, V1_EXPOSE_HEADERS };
