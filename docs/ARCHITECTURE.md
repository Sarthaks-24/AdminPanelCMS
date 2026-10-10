# Architecture

How the system is put together and why. For endpoint details see [API_REFERENCE.md](API_REFERENCE.md); for schemas see [DATA_MODEL.md](DATA_MODEL.md).

## The idea

One account holds one body of portfolio content. Each **App** is a named view of that content for one consumer: which sections, which items, which fields. A consumer reads its view through the public `/v1` API with the App's token.

```
                 ┌──────────────────────────┐
  you  ────────► │  Dashboard (client/)     │   React SPA
                 └────────────┬─────────────┘
                              │  /api   session cookie, read + write
                              ▼
                 ┌──────────────────────────┐
                 │  API server (server/)    │   Express, one process
                 │   /api  dashboard API    │
                 │   /v1   public API       │
                 └──────┬───────────┬───────┘
                        │           ▲
                        ▼           │  /v1   App token, read-only, published only
                 ┌────────────┐     │
                 │  MongoDB   │   your sites and servers
                 └────────────┘
```

Consumers never get database credentials and cannot write.

## Repository layout

```
server/
  server.js            entry: load env, validate, connect, listen
  app.js               Express app (exported separately so tests can use it)
  config/              loadEnv.js (MODE switch), db.js, limits.js
  routes/              one router per resource, plus v1.js
  controllers/         request handlers
  middleware/          sessions, tokens, rate limits, CORS, sanitising, errors
  models/              Mongoose schemas
  plugins/ownerGuard.js   tenant-isolation guard
  lib/                 shared logic (see below)
  scripts/             operational commands (npm run ...)
  tests/               Vitest + Supertest + in-memory MongoDB
client/
  src/api/client.js    Axios instance (API base URL is resolved in vite.config.js)
  src/context/         AuthContext, ThemeContext
  src/pages/admin/     dashboard screens
  src/pages/auth/      signup, verification, password reset
  src/components/admin/ shared pieces (toasts, states, route guard)
docs/
```

## Request pipeline

Order matters and is set in `server/app.js`:

1. `trust proxy` from `TRUST_PROXY_HOPS`, then `helmet` security headers.
2. `/v1` router, mounted before the dashboard CORS so its own CORS rules apply.
3. Dashboard CORS: only `CLIENT_ORIGIN`, with credentials.
4. JSON body parser, 256 KB.
5. `/api` rate limit: 600 requests per 15 minutes per IP.
6. `sanitizeMongoInput`: strips `$`-prefixed, dotted and prototype keys from bodies and queries.
7. Resource routers.
8. JSON 404, then the error handler.

## Tenant isolation

Every account's data shares the same collections, separated by an `owner` field. Three layers keep them apart:

1. **Derivation.** The owner is never taken from request input. Dashboard handlers use the id from the verified session; `/v1` handlers use the owner of the App that the token belongs to.
2. **`ownerGuard`.** A Mongoose plugin on every owned schema throws if any query runs without a concrete owner id in its filter. A forgotten filter fails loudly instead of returning someone else's data.
3. **Checks.** `npm run lint:security` rejects raw collection access and unscoped bulk writes in source; `tests/isolation.test.js` exercises cross-account reads and writes for every resource.

The guard proves a query is scoped to *an* owner; it relies on layer 1 to make that the *right* owner.

Writes pass through an allowlist (`pickWritable` / `pickFields` with `WRITABLE_FIELDS`), so a request cannot set `owner`, `role` or any unlisted field.

Most collection resources share one implementation, `lib/scopedCrud.js`, which is why several controllers are a few lines long.

## Sessions (dashboard)

- Sign-in issues a JWT (`{ sub, tv }`, 7 days) in an httpOnly cookie named `session`. JavaScript cannot read it.
- `requireSession` verifies it on every request, loads the user, and compares `tv` with the user's `tokenVersion`. Logout, password change, password reset and account deletion increment `tokenVersion`, which ends every outstanding session at once.
- **CSRF:** cookie-authenticated writes must carry `X-Requested-With: XMLHttpRequest`. A custom header forces a CORS preflight, which only `CLIENT_ORIGIN` passes.
- `requireVerifiedSession` additionally requires a verified email and guards all writes. `requireSuperAdmin` additionally requires the `superadmin` role.
- Passwords are bcrypt hashes. Login compares against a dummy hash for unknown emails so timing does not reveal which accounts exist; signup and password recovery always return the same response.

## Tokens and the public API

`/v1` middleware order: CORS preflight, per-IP limit, body parser, sanitiser, `requireToken`, per-token limit, per-account limit, global limit.

`requireToken`:

1. Rejects tokens in the query string and anything not shaped like a token.
2. Looks the token up by SHA-256 hash, then loads its App and checks the owner is active. Results are cached in memory for 60 seconds; unknown tokens are negatively cached.
3. For publishable tokens, checks the `Origin` header against the App's allowed origins and sets the CORS response headers.

A section handler then:

1. Returns `403 section_disabled` if the App has not enabled it.
2. Serves from the response cache if present.
3. Otherwise loads the owner's published documents for that section (`lib/loadOwnerData.js`), projects them through the App's settings (`lib/applyInclude.js`), computes an ETag, caches and responds.

`applyInclude` is the core of the product: it filters to published items, applies the section mode (`all`, `featured`, `selected`), and copies only fields that are both selected by the App and on the public allowlist. `/v1/fs` runs the same projection and reshapes the result into a file tree (`lib/buildFsTree.js`). The dashboard's App preview calls the same functions, so it shows exactly what `/v1` serves.

### Cache invalidation

Every content or App write calls `onContentChanged(ownerId)`, which bumps that owner's version number and evicts their cached responses. The version is part of each cache key, so stale entries can never be served after an edit. Token revocation and App deletion evict the token cache directly.

## State that lives in memory

| State | Where |
| :--- | :--- |
| Rate-limit counters (`/api`, auth routes, `/v1`) | `express-rate-limit` default store; `middleware/v1Limiters.js` |
| Token, bad-token and response caches | `lib/cache.js` |
| Per-owner cache versions | `lib/cache.js` |
| Invite-guess guard | `lib/inviteGuard.js` |
| Content-quota lock | `lib/contentQuota.js` |

All of it resets on restart and none is shared between processes. The service is therefore designed to run as **a single instance**. The App and token quotas are the exception: they are enforced by unique database indexes and are safe across processes.

## Accounts and signup

Signup is governed by a mode: `invite`, `open` or closed. The default comes from `SIGNUP_MODE`; a superadmin can override it in the dashboard, stored in the `settings` collection. In production signup is additionally blocked until `LEGAL_POLICIES_APPROVED=true`.

New accounts can sign in immediately but are read-only until they follow the emailed verification link. Email is sent through Resend (`lib/mailer.js`); verification and reset tokens are random 256-bit values stored only as hashes and usable once.

## Configuration

A single `MODE` variable selects development or production values and sets `NODE_ENV`. `lib/validateEnv.js` stops the server on unsafe settings. See [ENVIRONMENT.md](ENVIRONMENT.md).

## Dashboard client

A Vite-built React single-page app using React Router, Tailwind CSS and Axios.

- `AuthContext` asks `/api/auth/verify` on load to learn whether a session exists; `ProtectedRoute` guards `/admin/*`.
- `api/client.js` sends credentials and the CSRF header on every request and redirects to the login page on `401`.
- `ThemeContext` applies one of 20 colour themes through CSS variables and remembers the choice in `localStorage`.
- The client has no automated tests; `npm run lint` (oxlint) and `npm run build` are its checks.

## Testing

`server/tests/` runs against `mongodb-memory-server` bound to `127.0.0.1`; the setup refuses to run against any non-local host. Suites cover authentication and sessions, cross-tenant isolation, the owner guard and its lint, Apps and tokens, the `/v1` API (limits, CORS, ETags, caching), signup and invites, the account lifecycle, mail, URL validation, input sanitising and startup configuration.
