# API reference

The public, read-only content API that your sites call. Base URL for this deployment:

```
{{API_BASE}}
```

Every endpoint is `GET`, needs a key, and returns JSON. Only published content is ever served, and only what the key's App grants. New here? Start with the [quickstart](QUICKSTART.md).

## Authentication

Send your key as a bearer token on every request:

```bash
curl -H "Authorization: Bearer sk_live_…" {{API_BASE}}/projects
```

| Key | Prefix | Made for | Use it from | Shown |
| :--- | :--- | :--- | :--- | :--- |
| Secret | `sk_live_` | Apps of type **Build or server** | Build steps, servers, scripts | Once, when created |
| Publishable | `pk_live_` | Apps of type **Visitors' browsers** | Browser code on the origins you allow | Any time, in the dashboard |

- A key belongs to one App, and an App has at most 2 live keys so one can be rotated in without downtime.
- A key can be set to expire after 30, 90 or 365 days, or never. Revoking it, deleting its App, or deleting the account stops it at once.
- `?token=` in the URL is refused with `400 token_in_query`: keys belong in the header, never in logs.
- Keys are read-only. There is no write scope.

### Browsers and origins

A publishable key sent **with an `Origin` header** (every browser request) must come from an origin on the App's allowed list, or the App must allow `*`. Otherwise the answer is `403 origin_not_allowed`. Requests without an `Origin` header (curl, servers) are not origin-checked, which is why a publishable key is public by nature: the App's grant is the only thing protecting the content.

Preflight `OPTIONS` requests are answered `204` with `Authorization`, `Content-Type` and `If-None-Match` allowed. `ETag`, `Retry-After`, `RateLimit` and `RateLimit-Policy` are exposed to browser code.

A secret key used from a browser gets no CORS headers, so the browser cannot read the response. Keep secret keys in build or server code.

## The envelope

Success:

```json
{ "data": … }
```

Error:

```json
{ "error": "section_disabled", "message": "The projects section is not enabled for this App", "requestId": "req_8f3c1d2e", "section": "projects" }
```

`data` is an array for lists and an object for singletons. `error` is a stable snake-case code; `message` is for humans and may change. `section` is present only on `section_disabled`. Every `/v1` response, success or error, has this shape, including those from the rate limiter and the `404` for an unknown path.

## Endpoints

| Endpoint | `data` | Query parameters |
| :--- | :--- | :--- |
| `/v1/app` | `{ name, type, enabledSections }` for the key's App | |
| `/v1/profile` | one object | |
| `/v1/resume` | one object | |
| `/v1/socials` | array | |
| `/v1/skills` | array | `category` (one name, case-insensitive) |
| `/v1/skills/categories` | object: category name → array of skills | |
| `/v1/projects` | array | `stack` (one technology, case-insensitive; `tag` is an alias), `featured=true` |
| `/v1/projects/:slug` | one object | |
| `/v1/experience` | array | |
| `/v1/education` | array | |
| `/v1/certifications` | array | |
| `/v1/fs` | a tree of files built from every enabled section | |

Each endpoint except `/v1/app` needs its section enabled in the App; otherwise `403 section_disabled`. Any other path under `/v1` answers `404 not_found`.

`/v1/app` always works for a valid key and tells you what the App can read. It is the simplest way to confirm a key from a script; the dashboard's **Check this App** does the same without spending a request.

### Singletons

`/v1/profile` answers `404 not_configured` until the profile has been saved at least once; `/v1/resume` answers `404 not_configured` until a résumé link exists. Neither ever returns `200` with `null`.

### Which items a list returns

Each list section in an App has a mode:

| Mode | Items | Order |
| :--- | :--- | :--- |
| `all` | every published item | by `order`; certifications by `issueDate`, newest first |
| `featured` | published items with `featured: true` | by `order` |
| `selected` | the published items picked in the App | the order they were picked in |

The query parameters filter within that set. Skills can additionally be restricted to chosen categories in the App.

### Which fields each item carries

`_id` plus the App's field list for that section, or the section's defaults when the list is empty. The columns per section, the opt-in fields and the fields that are never served are in [Content fields](CONTENT_FIELDS.md).

### Examples

`GET /v1/app`

```json
{ "data": { "name": "portfolio-site", "type": "protected", "enabledSections": ["profile", "skills", "projects"] } }
```

`GET /v1/projects?featured=true`

```json
{
  "data": [
    {
      "_id": "6710a1f2c9e4b2a7d3f01234",
      "title": "Realtime Board",
      "slug": "realtime-board",
      "mode": "solo",
      "role": "Lead engineer",
      "shortDescription": "Collaborative whiteboard with presence.",
      "keyMetric": "<15ms latency",
      "highlights": ["CRDT sync", "WebSocket fan-out"],
      "caseStudyBody": "# Realtime Board\n\n…",
      "stack": ["React", "Node.js", "Redis"],
      "thumbnail": "",
      "links": { "github": "https://github.com/you/realtime-board", "live": "", "demo": "" },
      "order": 0,
      "featured": true
    }
  ]
}
```

`GET /v1/skills/categories`

```json
{ "data": { "Languages": [ { "_id": "…", "name": "Go", "category": "Languages", "proficiency": "Expert", "yearsOfExperience": 6, "featured": true, "order": 0 } ] } }
```

## The filesystem view: `/v1/fs`

The same granted content as a tree, for terminal-style sites. Enable **Filesystem view** on the App. Only sections the App has enabled appear, with the same item modes and field lists as the JSON endpoints.

```
/
├── about/             bio.txt, background.md, contact.json      (profile)
├── skills/            <category>.json                           (skills)
├── projects/          <slug>.md, index.json                     (projects)
├── experience/        <n>-<company>.txt                         (experience)
├── education/         <institution>.txt                         (education)
├── certifications/    <title>.txt                               (certifications)
├── socials.json                                                 (socials)
└── resume.pdf         a link to resumeUrl                       (resume)
```

- Directories have `children`. Files have `path`, `mimeType`, `content` (a string, or a JSON value for `.json` files) and `size` in bytes. `resume.pdf` has a `targetUrl` instead of `content` and appears only when the App serves `resumeUrl`.
- File names are derived from titles and slugs. When two items would produce the same name, the second gets `-2`, the third `-3`, and so on, so every path in the tree is unique.
- `contact.json` carries the email only when the App serves the profile's `email` field.
- `/v1/fs` counts as one uncached request per enabled section against the account's budget, so fetch it once per build and keep the tree.

```json
{
  "data": {
    "name": "/", "type": "directory", "path": "/",
    "children": [
      { "name": "about", "type": "directory", "path": "/about", "children": [
        { "name": "bio.txt", "type": "file", "path": "/about/bio.txt", "mimeType": "text/plain", "content": "…", "size": 84 }
      ] },
      { "name": "socials.json", "type": "file", "path": "/socials.json", "mimeType": "application/json", "content": [ … ], "size": 212 }
    ]
  }
}
```

## Headers

| Header | On | Meaning |
| :--- | :--- | :--- |
| `X-Request-Id` | every response | The id also found in error bodies. Send your own `X-Request-Id` and it is echoed back. |
| `ETag` | every `200` | Changes whenever the body changes. Send it back as `If-None-Match` to get `304 Not Modified`, which is free. |
| `Cache-Control: private, max-age=60` | every `200` | Your own HTTP cache may keep the response for a minute; shared caches must not. |
| `Vary: Authorization, Origin` | every `200` | A cache must key on the key and the origin. |
| `RateLimit`, `RateLimit-Policy` | every response | Draft-7 rate-limit headers for the per-key limit: remaining requests and the window. |
| `Retry-After` | `429`, `503` | Seconds to wait before retrying. |

The service also keeps each response for about 60 seconds and drops it the moment the content or the App changes, so an edit is visible within a minute at most, and usually at once.

## Status codes and error codes

| Status | `error` | Meaning |
| :--- | :--- | :--- |
| 200 | | Success; the body is `{ data }`. |
| 304 | | Not modified; your `If-None-Match` matched. No body. |
| 400 | `token_in_query` | The key was sent as `?token=`. |
| 400 | `bad_request` | A query parameter has the wrong shape. |
| 401 | `token_missing` | No `Authorization: Bearer` header. |
| 401 | `token_invalid` | Malformed, unknown, expired or revoked key, or its App is gone. |
| 401 | `account_unavailable` | The owning account is suspended or deleted. |
| 403 | `origin_not_allowed` | Publishable key used from an origin the App does not allow. |
| 403 | `section_disabled` | The section is off for this App; `section` names it. |
| 403 | `token_type_mismatch` | The key's kind does not match its App's type. |
| 404 | `not_found` | No published project with that slug, or no such path under `/v1`. |
| 404 | `not_configured` | `/v1/profile` or `/v1/resume` before they were ever saved. |
| 429 | `rate_limited` | A rate limit was exceeded; see `Retry-After` and `RateLimit`. |
| 503 | `busy` | The service is at its uncached-request ceiling; retry after `Retry-After` (usually 1 s). |
| 500 | `internal` | An unexpected failure on our side; the `requestId` is logged. |

What each one means for your code, and the limits themselves, are in [Limits & errors](LIMITS_AND_ERRORS.md).

## Dashboard API

The dashboard you sign into talks to a separate, session-authenticated API under `/api`. It is not for your sites: it can write, it needs a cookie and a CSRF header, and its shapes may change between releases. It is documented alongside the server code in the repository for anyone running or contributing to the service.
