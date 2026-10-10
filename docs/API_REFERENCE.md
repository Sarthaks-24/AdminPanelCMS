# API reference

The server exposes two APIs from one process.

| API | Base path | Who calls it | Authentication | Access |
| :--- | :--- | :--- | :--- | :--- |
| Public content API | `/v1` | Your websites and servers | App token (`pk_live_...` or `sk_live_...`) | Read-only, published content only |
| Dashboard API | `/api` | The dashboard in `client/` | Session cookie | Read and write, the signed-in account's own data |

In development both live at `http://localhost:5000`.

---

# Part 1: Public content API (`/v1`)

## Quick start

```bash
curl -H "Authorization: Bearer pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
     http://localhost:5000/v1/projects
```

```js
const res = await fetch('https://api.example.com/v1/projects?featured=true', {
  headers: { Authorization: `Bearer ${PUBLISHABLE_KEY}` },
});
const projects = await res.json();
```

A token belongs to one App. The App decides which sections are served, which items, and which fields. Only items marked **Published** are ever returned.

## Tokens

| Type | Prefix | Issued for | Use it from | Stored as |
| :--- | :--- | :--- | :--- | :--- |
| Publishable | `pk_live_` | `static` Apps | Browsers and static sites | Plain value (you can view it again in the dashboard) |
| Secret | `sk_live_` | `protected` Apps | Servers only | SHA-256 hash (shown once at creation) |

- Send the token in the `Authorization: Bearer <token>` header. A `?token=` query parameter is rejected with `400 token_in_query`.
- An App can have at most two active tokens. Tokens can expire after 30, 90 or 365 days, or never.
- Revoking a token, deleting its App, or deleting the account stops it working.

## Browser access (CORS)

- **Publishable tokens:** if the request has an `Origin` header, it must be in the App's allowed origins, or the App must allow `*`. Otherwise the response is `403 origin_not_allowed`. Requests without an `Origin` header (curl, servers) are not origin-checked, so treat a publishable token as public.
- **Secret tokens:** responses carry no CORS headers, so browsers cannot read them.
- Preflight `OPTIONS` requests are always answered `204`. Allowed request headers: `Authorization`, `Content-Type`, `If-None-Match`.

## Caching

Every successful response has an `ETag` and `Cache-Control: max-age=60` (`public` for publishable tokens, `private` for secret tokens). Send `If-None-Match` to get `304 Not Modified`.

The server also keeps responses in memory for up to 60 seconds, and drops them as soon as the account's content or App settings change, so a new request after an edit returns fresh data. Browsers and CDNs may still hold a copy for up to 60 seconds.

## Rate limits

| Scope | Limit | Response when exceeded |
| :--- | :--- | :--- |
| Per IP, before authentication | 300 requests / minute | `429 rate_limited` |
| Per publishable token | 60 requests / minute | `429 rate_limited` |
| Per secret token | 600 requests / minute | `429 rate_limited` |
| Per account | 12 requests / second | `429 rate_limited`, `Retry-After: 1` |
| Whole server | 25 requests / second | `503 busy`, `Retry-After: 1` |

`RateLimit` and `RateLimit-Policy` headers are included.

## Endpoints

All are `GET`. Each needs its section enabled in the App, otherwise `403 section_disabled`.

| Endpoint | Returns | Query parameters |
| :--- | :--- | :--- |
| `/v1/app` | `{ name, type, enabledSections }` for the token's App | |
| `/v1/profile` | Profile object, or `null` if none exists | |
| `/v1/resume` | Resume object, or `null` | |
| `/v1/socials` | Array | |
| `/v1/skills` | Array | `category` (exact name, case-insensitive) |
| `/v1/skills/categories` | Object mapping category name to an array of skills | |
| `/v1/projects` | Array | `stack` or `tag` (one technology, case-insensitive), `featured=true` |
| `/v1/projects/:slug` | One project, or `404 not_found` | |
| `/v1/experience` | Array | |
| `/v1/education` | Array | |
| `/v1/certifications` | Array | |
| `/v1/fs` | Virtual filesystem tree built from every enabled section | |

`/v1/app` is always available and is a good connection test.

### Item selection and order

Each collection section in an App has a mode:

| Mode | Items returned | Order |
| :--- | :--- | :--- |
| `all` | Every published item | By `order`; certifications by `issueDate`, newest first |
| `featured` | Published items with `featured: true` | By `order` |
| `selected` | The published items picked in the App | The order they were picked in |

For skills, an App can additionally restrict the section to chosen categories.

### Fields

Every item includes `_id` plus the fields the App exposes for that section. If the App has no field selection, the defaults apply.

| Section | Fields available | Not in the defaults |
| :--- | :--- | :--- |
| Profile | `name`, `initials`, `headline`, `shortBio`, `aboutMarkdown`, `email`, `location.city`, `location.country`, `location.isRemoteAvailable`, `statusText`, `isAvailableForHire`, `terminalUser`, `terminalHost`, `bootGreeting`, `metrics` | `email` |
| Resume | `resumeUrl`, `driveUrl`, `fileName`, `version`, `lastUpdated`, `summaryText` | `driveUrl` |
| Project | `title`, `slug`, `mode`, `role`, `shortDescription`, `keyMetric`, `highlights`, `caseStudyBody`, `stack`, `teammates`, `thumbnail`, `links.github`, `links.live`, `links.demo`, `order`, `featured`, `lastUpdated` | `teammates`, `lastUpdated` |
| Skill | `name`, `category`, `proficiency`, `yearsOfExperience`, `featured`, `order` | |
| Social | `platform`, `label`, `url`, `username`, `icon`, `order`, `featured` | |
| Experience | `company`, `role`, `employmentType`, `period`, `startDate`, `endDate`, `isCurrent`, `location`, `companyUrl`, `description`, `achievements`, `technologies`, `order`, `featured` | |
| Education | `institution`, `degree`, `fieldOfStudy`, `period`, `startDate`, `endDate`, `grade`, `location`, `achievements`, `order`, `featured` | |
| Certification | `title`, `issuer`, `issueDate`, `expirationDate`, `credentialId`, `credentialUrl`, `skills`, `order`, `featured` | |

`phone`, `owner`, `visibility` and timestamps are never served.

Two things to handle on your side:

- `aboutMarkdown` and `caseStudyBody` are Markdown written by the account owner and are served as-is. Sanitise the HTML you render from them.
- Saving a profile email creates a published "Email" social link (`mailto:`). Excluding `email` from the profile fields does not hide that link; unpublish or deselect it in the socials section.

### Example responses

`GET /v1/app`

```json
{ "name": "Portfolio site", "type": "static", "enabledSections": ["profile", "skills", "projects"] }
```

`GET /v1/projects`

```json
[
  {
    "_id": "6710a1f2c9e4b2a7d3f01234",
    "title": "Realtime Board",
    "slug": "realtime-board",
    "mode": "solo",
    "role": "Lead Engineer",
    "shortDescription": "Collaborative whiteboard with presence.",
    "keyMetric": "<15ms latency",
    "highlights": ["CRDT sync", "WebSocket fan-out"],
    "caseStudyBody": "# Realtime Board\n\n...",
    "stack": ["React", "Node.js", "Redis"],
    "thumbnail": "",
    "links": { "github": "https://github.com/you/realtime-board", "live": "", "demo": "" },
    "order": 0,
    "featured": true
  }
]
```

`GET /v1/fs`

A tree of nodes. Directories have `children`; files have `content` (a string, or a JSON value for `.json` files), `mimeType` and `size`. `resume.pdf` has a `targetUrl` instead of `content` and `size`, and appears only when the App exposes `resumeUrl`. `about/` appears only once a profile exists, and `contact.json` contains the email only if the App exposes the `email` field.

```
/
├── about/            bio.txt, background.md, contact.json     (profile)
├── skills/           <category>.json                          (skills)
├── projects/         <slug>.md, index.json                    (projects)
├── experience/       <n>-<company>.txt                        (experience)
├── education/        <institution>.txt                        (education)
├── certifications/   <title>.txt                              (certifications)
└── resume.pdf        link to resumeUrl                        (resume)
```

```json
{
  "name": "/", "type": "directory", "path": "/",
  "children": [
    { "name": "about", "type": "directory", "path": "/about", "children": [
      { "name": "bio.txt", "type": "file", "path": "/about/bio.txt", "mimeType": "text/plain", "content": "...", "size": 84 }
    ] }
  ]
}
```

A directory appears only if its section is enabled. File names are derived from titles, so two items with the same name produce two files with the same path.

## Errors

Errors are JSON: `{ "success": false, "error": "<code>", "message": "..." }`.

| Status | `error` | Meaning |
| :--- | :--- | :--- |
| 400 | `token_in_query` | Token was sent as `?token=` |
| 401 | `token_missing` | No `Authorization: Bearer` header |
| 401 | `token_invalid` | Malformed, unknown, expired or revoked token, or its App/account is gone |
| 403 | `origin_not_allowed` | Publishable token used from an origin the App does not allow |
| 403 | `section_disabled` | Section is not enabled for this App (`section` names it) |
| 404 | `not_found` | Project slug does not exist or is not published |
| 429 | `rate_limited` | A rate limit was exceeded |
| 503 | `busy` | The whole server is at its request ceiling; retry after a second |

Two responses do not follow that shape, so do not rely on `error` always being present: an unknown path returns `404 { "success": false, "message": "API route not found" }`, and an unexpected server failure returns `500 { "success": false, "message": "Internal Server Error", "stack": null }` in production (in development the real message and stack trace are included). A malformed or oversized JSON body currently also produces that `500` rather than a `400` or `413`.

---

# Part 2: Dashboard API (`/api`)

This API serves the dashboard. It is documented for contributors; external sites should use `/v1`.

## Conventions

- **Session:** signing in sets an httpOnly cookie named `session` (a JWT, 7 days). Send requests with credentials.
- **CSRF:** any non-`GET` request authenticated by the cookie must include `X-Requested-With: XMLHttpRequest`, otherwise `403 csrf_rejected`.
- **CORS:** only the origin in `CLIENT_ORIGIN` is allowed, with credentials.
- **Verified email:** all content, App and token writes require a verified email, otherwise `403 email_unverified`. Unverified accounts can sign in and read.
- **Ownership:** every read and write is limited to the signed-in account. Another account's id, or a malformed id, returns `404`. Two exceptions: the skills bulk endpoints skip ids that are not yours and report `matchedCount` or `deletedCount`, and an App whose `include` lists ids you do not own is rejected with `400 validation_failed`.
- **Bodies:** JSON, 256 KB maximum. Fields outside each resource's writable list are dropped silently.
- **Limits:** 600 requests per 15 minutes per IP across `/api`, plus the per-route limits noted below.
- **Quotas:** 100 items per collection and 10 Apps per account; exceeding one returns `403 quota_exceeded`.

An `Authorization: Bearer <session JWT>` header is also accepted in place of the cookie (the test suite uses it); the CSRF header is not required on that path. API tokens are rejected here with `401 invalid_token_type`.

Error shape: `{ "success": false, "error": "<code>", "message": "..." }`. Treat both fields as optional. Many coded errors have no `message` (for example `not_found`, `credentials_invalid`, `invite_invalid`, `quota_exceeded`), and some responses carry only `message` and no `error` code: failed sign-in (`400`, `401`), a missing or invalid resume (`404`, `400`), unknown routes (`404`), a few bulk-request validation errors, and unexpected `500`s. The general `/api` rate limit answers `429` with a plain-text body. Common codes: `auth_required`, `invalid_session`, `session_expired`, `account_inactive` (401); `csrf_rejected`, `email_unverified`, `admin_required`, `quota_exceeded` (403); `not_found` (404); `validation_error` with a `fields` array (400); `conflict` for a duplicate value such as a project slug (409); `rate_limited` (429).

## System

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/health` | none | `{ status, uptime, timestamp }`. Does not check the database. |

## Authentication (`/api/auth`)

| Method | Path | Auth | Body | Notes |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/login` | none | `email`, `password` | Sets the session cookie. Returns `{ user: { id, email, emailVerified, role } }`. 10 failed attempts per 15 minutes per IP and per email. |
| POST | `/logout` | cookie | | Needs the `X-Requested-With` header. Ends all of the account's sessions, on every device. |
| GET | `/verify` | session | | Returns the current user. Used by the dashboard on load. |
| GET | `/me` | session | | Current user including `acceptedTermsAt`. |
| GET | `/config` | none | | `{ signupEnabled, signupMode }` where mode is `invite`, `open` or `closed`. |
| POST | `/signup` | none | `email`, `password` (10+ chars), `acceptedTerms: true`, `acceptedPrivacy: true`, `inviteCode` in invite mode | Always answers `200` with the same message, whether or not the email was already registered. 5 per hour per IP and per email. |
| POST | `/verify-email` | none | `token` | Marks the email verified. Tokens last 24 hours and work once; otherwise `400 token_invalid`. Shares a limit of 5 per hour per IP with `/reset-password`. |
| POST | `/resend-verification` | session | | 5 per hour. |
| POST | `/forgot-password` | none | `email` | Always answers `200`. Reset tokens last 1 hour. 5 per hour per IP and per email. |
| POST | `/reset-password` | none | `token`, `newPassword` | Ends all existing sessions. `400 token_invalid` or `400 password_invalid` on failure. Shares the 5 per hour per IP limit with `/verify-email`. |
| POST | `/change-password` | session | `currentPassword`, `newPassword` | Ends other sessions and issues a new cookie. `401 credentials_invalid` if the current password is wrong. 5 per hour per account. |

Signup errors: `503 signup_unavailable` (signup closed, or legal approval missing in production), `503 email_unavailable` (no mail key in production), `400 invite_invalid`, `429 invite_locked`, `400 consent_required`, `400 validation_failed`.

## Content

All reads need a session; all writes need a verified session.

| Resource | Endpoints |
| :--- | :--- |
| Profile (one per account) | `GET /api/profile` (created with defaults on first read), `PUT /api/profile`, `PATCH /api/profile/availability` (`isAvailableForHire`, `statusText`) |
| Resume (one per account) | `GET /api/resume` (`404` until set), `PUT /api/resume` (`resumeUrl` required, https) |
| Projects | `GET /api/projects` (`?mode=solo\|team`, `?featured=true`), `GET /api/projects/:idOrSlug`, `POST /api/projects`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`, `PATCH /api/projects/reorder` |
| Skills | `GET /api/skills` (`?category=`, `?featured=true`) returns `{ skills, byCategory, total }`; `POST /api/skills` (one object, an array, or `{ skills: [...] }`, up to 50); `PUT /api/skills/:id`; `DELETE /api/skills/:id`; `PATCH /api/skills/bulk`; `POST /api/skills/bulk-delete` |
| Socials | `GET /api/socials` (`?featured=true\|false`), `POST`, `PUT /:id`, `DELETE /:id`, `PATCH /api/socials/reorder` |
| Experience | `GET /api/experience`, `POST`, `PUT /:id`, `DELETE /:id` |
| Education | `GET /api/education`, `POST`, `PUT /:id`, `DELETE /:id` |
| Certifications | `GET /api/certifications`, `POST`, `PUT /:id`, `DELETE /:id` |

Notes:

- Collection items have `visibility` (`draft` or `published`, default `draft`), `order` and `featured`. New items are placed last unless `order` is given, except skills, which get `order: 0` unless given.
- A project's `slug` is generated from its title when omitted and must be unique within the account.
- Reorder body: `{ "items": [{ "id": "...", "order": 0 }, ...] }`, up to 500 items. The whole request is refused if any id is not yours.
- `POST /api/skills` with more than 50 items returns `400 batch_too_large`.
- Skills bulk update body: either `{ "items": [{ "id": "...", ...fields }] }` or `{ "ids": [...], "updates": { ...fields } }`. Bulk delete body: `{ "ids": [...] }`.
- Unpublishing an item with `PUT /:id` removes it from every App's "selected" list. Unpublishing through the skills bulk update does not, and neither does deleting a single item; the skills bulk delete does.
- Field lists, types and limits are in [DATA_MODEL.md](DATA_MODEL.md).

## Apps and tokens (`/api/apps`)

All routes need a verified session.

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/api/apps` | List the account's Apps |
| POST | `/api/apps` | Create an App: `name`, `type` (`static` or `protected`), optional `allowedOrigins`, `include` |
| GET | `/api/apps/:id` | One App |
| PUT | `/api/apps/:id` | Update. `include` is merged into the existing settings rather than replaced. |
| DELETE | `/api/apps/:id` | Delete the App and revoke its tokens |
| GET | `/api/apps/:id/preview` | Exactly what `/v1` would serve for this App, all sections in one object (plus `fs` if enabled) |
| GET | `/api/apps/:id/tokens` | List tokens. Publishable tokens include their value; secret tokens only their prefix. |
| POST | `/api/apps/:id/tokens` | Create a token: optional `label`, `expiresInDays` (30, 90 or 365; any other value means it never expires). Returns `{ token, type, prefix, shownOnce }`. Expired tokens are revoked first to free a slot; with two active tokens it returns `403 quota_exceeded`. |
| DELETE | `/api/apps/:id/tokens/:tokenId` | Revoke a token |

`allowedOrigins`: up to 10 exact `https://` origins, or the single value `*`. `http://localhost` is accepted outside production. A static App with none defaults to `*`.

`include` has one key per section:

```json
{
  "profile":  { "enabled": true, "fields": ["name", "headline"] },
  "resume":   { "enabled": false },
  "projects": { "enabled": true, "mode": "selected", "ids": ["..."], "fields": ["title", "slug", "stack"] },
  "skills":   { "enabled": true, "mode": "all", "categories": ["Languages", "Frontend"] },
  "fs":       { "enabled": false }
}
```

Collection sections (`socials`, `skills`, `projects`, `experience`, `education`, `certifications`) take `enabled`, `mode` (`all`, `featured`, `selected`), `ids` and `fields`. `profile` and `resume` take `enabled` and `fields`. Invalid settings return `400 validation_failed` with a `details` array.

## Account (`/api/account`)

| Method | Path | Body | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/account/export` | | Downloads the account's content, Apps and token metadata as JSON. No password hash or token values. |
| DELETE | `/api/account` | `password` | Deletes the account and all its data, and stops its tokens. `401 credentials_invalid` on a wrong password. Answers `202` with `deleted: false` if cleanup was interrupted; access is already blocked and the sweep finishes it. |

The two share one limit of 5 requests per hour per account.

## Superadmin (`/api/admin`)

Needs a verified session whose role is `superadmin`, otherwise `403 admin_required`. The role can only be granted from the command line.

| Method | Path | Description |
| :--- | :--- | :--- |
| GET | `/api/admin/overview` | Totals (accounts, Apps, tokens, unused invites) and process health |
| GET | `/api/admin/settings` | Effective signup mode, where it comes from, and whether legal approval is blocking it |
| PUT | `/api/admin/settings` | `{ "signupMode": "invite" \| "open" }` |
| GET | `/api/admin/invites` | Latest 200 invites with usage. Codes are not retrievable. |
| POST | `/api/admin/invites` | `expiresInDays` (1 to 90, default 30), `maxUses` (1 to 1000, default 1). Returns the code once. |
| DELETE | `/api/admin/invites/:id` | Revoke an invite that still has uses left |
