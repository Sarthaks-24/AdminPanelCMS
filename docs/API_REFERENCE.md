# API reference

The read-only content API your sites call. Base URL:

```
{{API_BASE}}
```

Every path below starts with `/v1` and is appended to that base as written: `{{API_BASE}}` + `/v1/projects` is `{{API_BASE}}/v1/projects`. Every endpoint is `GET`, needs a key, and returns JSON. Only published content is ever served, and only what the key's App grants. New here? Start with the [quickstart](QUICKSTART.md).

## Authentication

Send your key as a bearer token on every request:

```bash
curl -H "Authorization: Bearer sk_live_…" {{API_BASE}}/v1/projects
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

Preflight `OPTIONS` requests are answered `204` with `Authorization`, `Content-Type`, `If-None-Match` and `X-Request-Id` allowed. `ETag`, `Retry-After`, `RateLimit`, `RateLimit-Policy` and `X-Request-Id` are exposed to browser code. Every error response to a browser request carries CORS headers for its origin, so browser code can read the error code.

A secret key used from a browser gets no CORS headers on a successful response, so the browser cannot read it. Keep secret keys in build or server code.

## The envelope

Success:

```json
{ "data": … }
```

Error:

```json
{ "error": "section_disabled", "message": "The projects section is not enabled for this App", "requestId": "3f2b8c1e-7a4d-4e0b-9c6a-2d5e8f1a0b7c", "section": "projects" }
```

`data` is an array for lists and an object for singletons. `error` is a stable snake-case code; `message` is for humans and may change. `section` is present only on `section_disabled`, and `param` (the query parameter at fault) only on `bad_request`. Every `/v1` response, success or error, has this shape, including those from the rate limiter and the `404` for an unknown path.

## Endpoints

| Endpoint | `data` | Query parameters |
| :--- | :--- | :--- |
| `/v1/app` | `{ name, type, enabledSections }` for the key's App | |
| `/v1/profile` | one object | |
| `/v1/resume` | one object | |
| `/v1/socials` | array | |
| `/v1/skills` | array | `category` (one name, case-insensitive) |
| `/v1/skills/categories` | object: category name → array of skills | |
| `/v1/projects` | array | `stack` (one technology, case-insensitive; `tag` is an alias), `featured` (`true` or `false`) |
| `/v1/projects/:slug` | one object | |
| `/v1/experience` | array | |
| `/v1/education` | array | |
| `/v1/certifications` | array | |
| `/v1/fs` | a tree of files built from every enabled section | |

Each endpoint except `/v1/app` needs its section enabled in the App; otherwise `403 section_disabled`. Any other path under `/v1` answers `404 not_found`.

`/v1/app` always works for a valid key and tells you what the App can read. `type` is `protected` for an App of type **Build or server** (secret keys) and `static` for **Visitors' browsers** (publishable keys). `enabledSections` lists every section that is on, and includes `fs` when the filesystem view is enabled (the `/v1/fs` tree itself is built from the other sections only). It is the simplest way to confirm a key from a script; the dashboard's **Check this App** does the same without spending a request.

### Singletons

`/v1/profile` answers `404 not_configured` until the profile has been saved at least once; `/v1/resume` answers `404 not_configured` until a résumé link exists. Neither ever returns `200` with `null`.

### Which items a list returns

Each list section in an App has a mode:

| Mode | Items | Order |
| :--- | :--- | :--- |
| `all` | every published item | by `order`; certifications by `issueDate`, newest first |
| `featured` | published items with `featured: true` | by `order` |
| `selected` | the published items picked in the App | the order they were picked in |

The query parameters filter within that set; each may be given once, and `featured` must be `true` or `false`, or the answer is `400 bad_request` with `param` naming it. Unknown parameters are ignored. Skills can additionally be restricted to chosen categories in the App. Filters work on the stored values, so `stack`, `featured` and `category` filter correctly even when the App does not serve those fields.

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
| `ETag` | every `200` | Changes whenever the body changes. Send it back as `If-None-Match` to get `304 Not Modified`, which is free while the response is cached (see [Limits & errors](LIMITS_AND_ERRORS.md#rate-limits)). |
| `Cache-Control: private, max-age=60` | every `200` | Your own HTTP cache may keep the response for a minute; shared caches must not. |
| `Vary: Authorization, Origin` | every `200` | A cache must key on the key and the origin. |
| `RateLimit`, `RateLimit-Policy` | every response to a valid key | Draft-7 rate-limit headers for the key's own limit (600/min for a secret key, 120/min per visitor for a publishable key): remaining requests and the window. |
| `Retry-After` | `429`, `503` | Seconds to wait before retrying. |

The service keeps each response until the content or the App changes and serves the edit on the very next request; only your own HTTP cache (`max-age=60` above) can hold an older copy, for up to a minute.

## Status codes and error codes

| Status | `error` | Meaning |
| :--- | :--- | :--- |
| 200 | | Success; the body is `{ data }`. |
| 304 | | Not modified; your `If-None-Match` matched. No body. |
| 400 | `token_in_query` | The key was sent as `?token=`. |
| 400 | `bad_request` | A query parameter has the wrong shape; `param` names it. |
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

## Stability

- **Inside `/v1`, changes are additive only.** New endpoints, new optional query parameters, new fields and new error codes can appear at any time, so ignore fields and codes you don't recognise rather than failing on them.
- **Nothing documented here is removed or renamed inside `/v1`.** A breaking change ships as a new version (`/v2`), and `/v1` keeps answering for at least 90 days after `/v2` is announced.
- A field that is going away is announced before it goes: in the [changelog](CHANGELOG.md), and by email to accounts whose Apps serve it.
- Error `message` strings are for humans and may change at any time. Match on `error`, never on `message`.
- The limits in [Limits & errors](LIMITS_AND_ERRORS.md) may change during the beta; changes are posted in the [changelog](CHANGELOG.md).

## Dashboard API

The dashboard you sign into uses a separate, private API. It is not for your sites: it can write, needs a session cookie, and changes without notice.
