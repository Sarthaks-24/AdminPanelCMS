# Architecture

How the system is put together and why. Internal reference; for the consumer-facing endpoint contract see [API_REFERENCE.md](API_REFERENCE.md), for schemas see [DATA_MODEL.md](DATA_MODEL.md).

## The idea

A hosted, multi-tenant content API. One account (a tenant) holds one body of professional content. Each **App** is a named, read-only view of that content for one consumer: which sections, which items, which fields. A consumer reads its view through the public `/v1` API with the App's key. Edit once in the dashboard; every connected site sees the change within the cache window.

```
                 ┌──────────────────────────┐
  tenant ──────► │  Dashboard (client/)     │   React SPA, static host
                 └────────────┬─────────────┘
                              │  /api   session cookie, read + write
                              ▼
                 ┌──────────────────────────┐
                 │  API server (server/)    │   Express, ONE process
                 │   /api  dashboard API    │
                 │   /v1   public API       │
                 │   /livez /readyz probes  │
                 └──────┬───────────┬───────┘
                        │           ▲
                        ▼           │  /v1   App key, read-only, published only
                 ┌────────────┐     │
                 │  MongoDB   │   the tenant's sites, servers, CLIs, widgets
                 └────────────┘
```

Consumers never get database credentials and cannot write. The owner's own Portfolio is just another tenant and reads through `/v1`.

## Repository layout

```
server/
  server.js            entry: load env, validate, connect, load the active-token set, listen, drain on SIGTERM
  app.js               Express app (exported separately so tests can use it)
  Dockerfile           node:20-alpine image, non-root, HEALTHCHECK on /livez
  config/              loadEnv.js (MODE switch), db.js, limits.js
  routes/              one router per resource, plus v1.js
  controllers/         request handlers
  middleware/          sessions, tokens, rate limits, CORS, sanitising, errors
  models/              Mongoose schemas
  plugins/ownerGuard.js   tenant-isolation guard
  lib/                 shared logic (cache, applyInclude, logger, mailer, legal, ...)
  scripts/             operational commands (npm run ...)
  tests/               Vitest + Supertest + in-memory MongoDB
client/
  src/lib/apiBase.js   resolves the public /v1 base from /api/auth/config
  src/api/client.js    Axios instance (dashboard API base URL is resolved in vite.config.js)
  src/content/         site copy, docs IA
  src/context/         AuthContext, ThemeContext
  src/pages/public/    landing, docs, legal
  src/pages/auth/      signup, check-email, verify (sets the password), password reset
  src/pages/admin/     dashboard screens, lazy-loaded
  src/components/admin/ shared pieces (Modal, toasts, states, route guard)
.github/workflows/     ci.yml, backup.yml
docs/                  operator docs (this set) and consumer docs
```

## Request pipeline

### `/api` (dashboard)

Order is set in `server/app.js`:

1. `trust proxy` from `TRUST_PROXY_HOPS`, then `helmet` security headers.
2. `pino-http` request logging with a request id (`req.id`, echoed as `X-Request-Id`).
3. `/livez` (process up) and `/readyz` (Mongo ping), mounted **before** any limiter so monitors are never rate-limited. `/api/health` is an alias of `/livez`.
4. `/v1` router, mounted before the dashboard CORS so its own CORS rules apply.
5. Dashboard CORS: only `CLIENT_ORIGIN`, with credentials.
6. JSON body parser, 256 KB; malformed JSON → `400 bad_request`, oversize → `413 payload_too_large`; `req.body` defaults to `{}`.
7. `/api` rate limit: 600 requests per 15 minutes per IP, plus per-route auth limiters (login on `email+ip`, forgot-password cooldown, resend-verification per `email+ip`).
8. `sanitizeMongoInput`: strips `$`-prefixed, dotted and prototype keys from bodies and queries.
9. Resource routers.
10. JSON 404, then the error handler, which honours `err.status`, never emits a stack, and logs 5xx with the request id.

### `/v1` (public)

`server/routes/v1.js`, in this order. The order is the capacity design: a forged key costs no database call, a cache hit costs no limiter budget, and only misses are charged.

| # | Middleware | What it does |
| :--- | :--- | :--- |
| 1 | request id | `X-Request-Id` echoed or generated; present on every `/v1` response including errors |
| 2 | `v1Cors` | Preflight and CORS headers for publishable keys |
| 3 | preAuth IP limiter | 300/min per IP (IPv6 /48) → `429 rate_limited` |
| 4 | sanitize query | strips Mongo operators from the query string (`/v1` has **no JSON body parser**) |
| 5 | token format + active-hash set | rejects a key in the query string (`400 token_in_query`), a malformed key, and any key whose SHA-256 is not in the in-memory **active-token set** (`401 token_invalid`) with zero database calls |
| 6 | `requireToken` with pre-DB bucket | token cache lookup; a miss that needs Mongo passes a 20/s global bucket first (`503 busy`), then loads the token, App and owner; checks owner status (`401 account_unavailable` for suspended or deleted), key type vs App type (`403 token_type_mismatch`) and, for `pk_`, the `Origin` allowlist (`403 origin_not_allowed`) |
| 7 | `tokenLimiter` | `pk_`: 120/min per key + IP and 3,000/min per key; `sk_`: 600/min per key |
| 8 | cache lookup | key = owner version + App + path + normalised query; a hit answers here with `ETag` (or `304`) and is **not** charged below |
| 9 | section check | `403 section_disabled` (with `section`) when the App has not enabled it |
| 10 | owner miss limiter | 10 units/s per owner, token bucket with burst; `/fs` costs one unit per enabled section |
| 11 | global miss bucket | 40 units/s across the process → `503 busy`, `Retry-After: 1` |
| 12 | single-flight load | concurrent misses for the same key share one `loadOwnerData` promise |
| 13 | `applyInclude` | projects the owner's published documents through the App's `include` |
| 14 | size check | responses over 1 MB are refused; bodies over 256 KB are served but not cached |
| 15 | cache set | serialised body stored by bytes (64 MB bound), ~60 s TTL |
| 16 | response | `{data}` envelope, `ETag`, `Cache-Control: private, max-age=60`, `Vary: Authorization, Origin` |

The router has its own 404 (`404 not_found`, v1 shape, CORS headers) and error handler (`500 internal`, request id, no stack).

### The `/v1` contract (frozen 2026-10-11)

- Success: `{ "data": <object|array> }`. `/v1/app` → `{data:{name,type,enabledSections}}`; `/v1/skills/categories` → `{data:{<category>:[...]}}`; lists are arrays inside `data`.
- Error: `{ "error": "<snake_code>", "message": "<human>", "requestId": "<id>" }`, plus `section` on `section_disabled` or `fields` on validation. The same shape for limiter, token, 404 and 500 responses.
- Singletons never return `200 null`: `/v1/profile` is `404 not_configured` until the tenant saves the profile (`Profile.configured`), `/v1/resume` until a resume exists.
- `Cache-Control: private` for both key types: the URL carries no tenant, so a shared or URL-keyed cache would leak between tenants.
- Additive changes ship within `/v1`; removals need `/v2` with `Deprecation`/`Sunset` headers and six months' notice.

The numbers are listed once in [DEPLOYMENT.md](DEPLOYMENT.md#limits-the-deployment-enforces) and quoted everywhere else.

## Tenant isolation

Every account's data shares the same collections, separated by an `owner` field. Three layers keep them apart:

1. **Derivation.** The owner is never taken from request input. Dashboard handlers use the id from the verified session; `/v1` handlers use the owner of the App that the key belongs to.
2. **`ownerGuard`.** A Mongoose plugin on every owned schema throws if any query runs without a concrete owner id in its filter. A forgotten filter fails loudly instead of returning someone else's data. The throw is logged with the request id.
3. **Checks.** `npm run lint:security` rejects raw collection access and unscoped bulk writes in source; `tests/isolation.test.js` exercises cross-account reads and writes for every resource.

The guard proves a query is scoped to *an* owner; it relies on layer 1 to make that the *right* owner.

Writes pass through an allowlist (`pickWritable` / `pickFields` with `WRITABLE_FIELDS`), so a request cannot set `owner`, `role`, `status` or any unlisted field. Most collection resources share one implementation, `lib/scopedCrud.js`.

## Sessions and accounts

- **Email-first signup.** `POST /api/auth/signup` takes an email and the consent flags only (no password) and always answers the same generic `200`. The account is created with `passwordHash: null`; the verification link leads to `POST /api/auth/verify-email {token, password}`, which consumes the token atomically, sets the password and `emailVerifiedAt`, bumps `tokenVersion` and signs the person in. Whoever proves the email chooses the password, which is what closes the pre-registration hijack. Accounts that never verify are purged after 48 hours by the sweep.
- **Login** refuses an account with no password or no verified email with the same generic `401 credentials_invalid`. The limiter is keyed on `email+ip`, so a stranger cannot lock a known address out.
- Sign-in issues a JWT (`{ sub, tv }`, HS256 pinned, 7 days) in an httpOnly cookie named `session`. `requireSession` verifies it on every request, loads the user, checks `status === 'active'` and compares `tv` with `tokenVersion`. Logout, password change, password reset, suspension and deletion increment `tokenVersion`, which ends every session at once. **Password reset does not revoke API keys**: a routine reset must not take a tenant's sites offline.
- **CSRF:** cookie-authenticated writes must carry `X-Requested-With: XMLHttpRequest`. The custom header forces a CORS preflight, which only `CLIENT_ORIGIN` passes.
- `requireVerifiedSession` guards all writes; `requireSuperAdmin` guards `/api/admin/*`.
- **Suspension.** A superadmin flips `User.status` to `suspended`: `tokenVersion` is bumped and the owner's cached tokens are evicted, so sessions end and every key answers `401 account_unavailable` on the next request. Content is kept; `unsuspend` restores it without re-issuing keys. `requireSession` and `requireToken` both reject any non-`active` status.
- **Consent.** Signup stores `acceptedTermsAt`, `acceptedTermsVersion`, `acceptedPrivacyAt`, `acceptedPrivacyVersion` from the constants in `lib/legal.js`.
- Passwords are bcrypt hashes. Login compares against a dummy hash for unknown emails so timing does not reveal which accounts exist; signup and password recovery always return the same response.
- **Signup mode** is `closed` (default), `invite` or `open`: the superadmin's dashboard choice wins over `SIGNUP_MODE`. In production signup is additionally blocked until `LEGAL_POLICIES_APPROVED=true`. Invites are 12-character base32 codes with a per-IP failure cap and a global guard.
- **Mail budget.** Every outbound mail passes an atomic `$inc` on the `Setting` key `mail:YYYY-MM-DD` against `MAIL_DAILY_CAP`; a reserve (`MAIL_RESET_RESERVE`) is spendable only by password-reset mail. Over budget, signup and resend answer `503 mail_budget`; forgot-password still answers the generic `200` and logs the drop. Every send failure is logged.

## Keys, Apps and projection

`requireToken` resolves a key to its App and owner (cached 60 s, negative-cached for unknown hashes that pass the active set). A section handler then checks the App has enabled the section, serves from cache, or loads the owner's published documents for that section (`lib/loadOwnerData.js`), projects them through the App's settings (`lib/applyInclude.js`), computes an ETag, caches and responds.

`applyInclude` is the core of the product: it filters to published items, applies the section mode (`all`, `featured`, `selected`), and copies only fields that are both selected by the App and on the public allowlist (`PUBLIC_FIELDS`; `phone`, `owner`, `visibility` and timestamps are never exposable). `/v1/fs` runs the same projection and reshapes the result into a de-duplicated file tree (`lib/buildFsTree.js`). The dashboard's App preview and `POST /api/apps/:id/check` call the same functions, so they show exactly what `/v1` serves.

### Cache invalidation

Every content or App write calls `onContentChanged(ownerId)`, which bumps that owner's version number and evicts their cached responses. The version is part of each cache key, so a stale entry can never be served after an edit. Key revocation calls `evictTokenByHash`, App deletion evicts each of its keys, an App type change revokes the other kind of key, and suspension or deletion calls `evictOwner`; all of these also update the active-token set. An `ApiToken` post-save hook keeps the set current for new keys.

## State that lives in memory

| State | Where |
| :--- | :--- |
| Active-token hash set (`Map<hash,{owner,app}>`), loaded at boot | `lib/cache.js` |
| Token cache, negative-token cache | `lib/cache.js` |
| Response cache (byte-bounded, 64 MB) and single-flight map | `lib/cache.js` |
| Per-owner cache versions, `lastUsedAt` write throttle | `lib/cache.js` |
| Rate-limit counters: `/api`, auth routes, `/v1` IP, per-key, owner miss bucket, global miss bucket, pre-DB bucket | `express-rate-limit` memory store; `middleware/v1Limiters.js` |
| Invite-guess guard (per IP and global) | `lib/inviteGuard.js` |
| Content-quota lock | `lib/contentQuota.js` |
| Deleted/unverified sweep timer | `lib/sweepDeleted.js` |

All of it resets on restart and none of it is shared between processes. **The service runs as exactly one instance.** A second replica would halve every limit, serve stale responses after an edit and keep a revoked key alive on the other process. Redis is the trigger-gated answer if a second instance is ever genuinely needed (master plan, Phase C). The App and key quotas are the exception: they are enforced by unique database indexes and are safe across processes.

## Observability

- `pino` structured logs to stdout at `LOG_LEVEL`; one line per request with `reqId`, method, path, status, duration, owner id where known. Security events (`login_failed`, `signup`, `invite_failed`, `token_revoked`, `suspend`, mail failures, ownerGuard throws) are logged as named events.
- `/livez` and `/readyz` for the platform; the Docker `HEALTHCHECK` uses `/livez`.
- SIGTERM: the server stops listening, drains in-flight requests, closes Mongo and exits, so a deploy drops nothing.
- No error tracker, metrics or audit collection yet (master plan, Phase B).

## Configuration

A single `MODE` variable selects development or production values and sets `NODE_ENV`. `lib/validateEnv.js` stops the server on unsafe settings (including a `PUBLIC_API_URL` that is not `https:` without a path, and a test mail sender while signup is open). See [ENVIRONMENT.md](ENVIRONMENT.md).

## Dashboard client

A Vite-built React single-page app using React Router, Tailwind CSS and Axios, served statically.

- `AuthContext` asks `/api/auth/verify` on load to learn whether a session exists; `ProtectedRoute` guards `/admin/*`. All dashboard and auth pages are lazy-loaded behind a `RouteErrorBoundary`, so landing visitors do not download the dashboard.
- `api/client.js` sends credentials and the CSRF header on every request and redirects to the login page on `401`.
- `lib/apiBase.js` reads `publicApiBase` from `/api/auth/config` and derives the `/v1` base shown in every snippet; the client never hardcodes the public host.
- The App editor's Connect panel shows the base URL and a build-time `sk_` snippet first; `POST /api/apps/:id/check` replaces any in-browser "test connection".
- `ThemeContext` applies one of four visible colour themes through CSS variables and remembers the choice in `localStorage` (guarded with try/catch for blocked storage).
- The client has no unit tests; `npm run lint` (oxlint) and `npm run build` are its checks, and one Playwright path (landing → signup → first `/v1` 200) is the planned end-to-end check.

## Testing

`server/tests/` runs against `mongodb-memory-server` bound to `127.0.0.1`; the setup refuses to run against any non-local host. Suites cover authentication and sessions (including email-first signup and suspension), cross-tenant isolation, the owner guard and its lint, Apps and keys, the `/v1` API (envelope, limits, CORS, ETags, caching, 404 shape), signup modes and invites, the account lifecycle, mail budget, URL validation, input sanitising and startup configuration. CI runs the suite on every push.
