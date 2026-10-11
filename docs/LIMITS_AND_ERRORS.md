# Limits & errors

What the service lets one account do during the beta, what each error means, and how to fetch so that you never meet a limit.

<!-- OWNER-APPROVAL: pricing sentence -->
Free during the beta; any paid plan will be announced 30 days ahead.

## Account limits

| What | Limit |
| :--- | :--- |
| Apps per account | 10 |
| Items per section (projects, skills, experience, …) | 100 |
| Live keys per App | 2, so a key can be rotated without downtime |
| Field sizes | Per-field caps, listed in [Content fields](CONTENT_FIELDS.md#field-caps) |

Exceeding one of these in the dashboard answers `403 quota_exceeded`; nothing on `/v1` is affected.

## Rate limits

Limits are per minute or per second, and every limited response says so.

| Scope | Limit | When exceeded |
| :--- | :--- | :--- |
| Per IP address, before the key is checked | 300 requests / minute | `429 rate_limited` |
| Per secret key (`sk_live_`) | 600 requests / minute | `429 rate_limited` |
| Per publishable key (`pk_live_`) | 120 requests / minute **per key and visitor IP**, and 3,000 / minute per key in total | `429 rate_limited` |
| Per account, uncached requests only | 10 per second, with a short burst allowance | `429 rate_limited` + `Retry-After` |
| Whole service, uncached requests only | shared bucket | `503 busy` + `Retry-After: 1` |
| Unknown keys | shared pre-database bucket | `503 busy` + `Retry-After: 1` |

**Cached responses are free.** The service keeps each response for about 60 seconds and drops it the moment you edit the content or the App. A request that is served from that cache, or answered `304 Not Modified` because you sent `If-None-Match`, does not count against the per-account or service-wide limits. Only the per-key and per-IP limits see every request.

`/v1/fs` counts as one uncached request per enabled section, because it assembles all of them.

Every `/v1` response carries draft-7 `RateLimit` and `RateLimit-Policy` headers describing the per-key limit, and every `429` or `503` carries `Retry-After` in seconds.

## Fetch at build time first

The limits above are sized for sites that fetch at **build time** with a secret key: one request per section per build, which is a handful of requests a day. A browser that fetches on every page view with a publishable key spends the key's limit on every visitor, and a scraped publishable key can be used by anyone until you revoke it.

If a build gets `429` or `503`:

1. Read `Retry-After` and wait that many seconds; then retry the same request. Both are transient.
2. Fetch the lists one after another, not all at once, and fetch each list once. `/v1/projects` already returns every published project; there is no need to fetch `/v1/projects/:slug` for each one.
3. Send `If-None-Match` with the `ETag` you last saw. A `304` is free and costs no quota.

Browser code should handle `429` by backing off, never by retrying in a loop.

## Error decoder

Every error is JSON: `{ "error": "<code>", "message": "<human text>", "requestId": "<id>" }`, with `section` added for `section_disabled`. The `X-Request-Id` header carries the same id; quote it when asking for help.

| What you see | What it means | Fix |
| :--- | :--- | :--- |
| `403 section_disabled` (with `section`) | The named section is off for this App. Not an empty section: a refusal. | Open the App and enable the section. |
| `403 origin_not_allowed` (curl), or `TypeError: Failed to fetch` in a browser | A publishable key was used from an origin that is not on the App's list. A browser cannot read the error body, so it reports a network failure; check the status code in the Network tab. | Add the site's exact `https://` origin to the App's allowed origins. |
| `403 token_type_mismatch` | The key is the wrong kind for the App it belongs to, for example a key minted before the App's type was changed. | Create a new key in the App; revoke the old one. |
| `401 token_missing` | No `Authorization: Bearer …` header. | Send the key in the header on every request. |
| `401 token_invalid` | The key is mistyped, revoked, expired, or its App is gone. | Check for whitespace and the `sk_live_`/`pk_live_` prefix; create a new key if it was revoked. |
| `401 account_unavailable` | The account that owns the key is suspended or deleted. | Contact [support email], quoting the `requestId`. |
| `400 token_in_query` | The key was sent as `?token=`, which would land in logs. | Send it as `Authorization: Bearer …`, never in the URL. |
| `400 bad_request` | A query parameter has the wrong shape (for example `featured=yes`). | Compare with the [API reference](API_REFERENCE.md). |
| `404 not_found` | No published project has that slug, or the path does not exist under `/v1`. | Check the slug in the dashboard and that it is published. |
| `404 not_configured` | `/v1/profile` before the profile was ever saved, or `/v1/resume` before a resume link was added. | Save the profile or add the resume link once. |
| `429 rate_limited` | A per-key, per-IP or per-account limit was hit; the `message` names which. | Wait for `Retry-After`; fetch at build time; fetch each list once. |
| `503 busy` | The service as a whole is at its uncached-request ceiling. | Retry after `Retry-After` seconds (usually 1). Builds should honour it automatically. |
| `500 internal` | Something failed on our side. The `requestId` is logged. | Retry once; if it persists, report the `requestId`. |
| `200 { "data": [] }` | The section is on but nothing in it is published. | Publish the items, or check the App's item mode (`featured` or `selected` may match nothing). |
| `200 { "data": { … } }` missing a field you expected | The App's field list doesn't include it, or it is an opt-in field. | Add the field to the App's list; see [Content fields](CONTENT_FIELDS.md). |

Error bodies are always readable from curl and from server code. From a **browser**, a `401` or `403 origin_not_allowed` arrives without CORS headers and surfaces as `Failed to fetch`; every other error, including `403 section_disabled` and `429`, is readable once the origin check has passed.

## Availability

The service runs as a single deployment during the beta: best effort, no SLA. Content is backed up daily. Because every response is cached for about 60 seconds and your sites fetch at build time, a short interruption rarely reaches a visitor; a build that hits it should retry.

Your data is yours: export everything as JSON or delete your account from **Settings** at any time. Deleting the account revokes every key immediately.
