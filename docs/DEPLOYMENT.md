# Deployment reference

**Step-by-step first deploy: see [../DEPLOYMENT.md](../DEPLOYMENT.md).** This page is the operator reference behind it: topology, the production values, probes, limits and rollback.

The product is a hosted, multi-tenant service: there is **one** deployment, run by the owner, and everyone else signs up to it. Read [ENVIRONMENT.md](ENVIRONMENT.md) first; this page assumes you know what the `MODE` switch does.

## Supported deploy paths

| Path | API | Dashboard | Files |
| :--- | :--- | :--- | :--- |
| Render | Docker web service from `server/Dockerfile`, one paid always-on instance | Render static site (rewrite to `index.html`, headers set in the Blueprint) | `render.yaml` (Blueprint for both) |
| Railway + a static host | Railway service from `server/Dockerfile`: one replica, no sleep, health check `/readyz`, 20 s draining | Cloudflare Pages or Netlify building `client/`, or a second Railway service from `deploy/web.Dockerfile` | `server/railway.json`, `deploy/web.Dockerfile` + `deploy/Caddyfile` |
| One VPS | `api` container from `server/Dockerfile` | `web` container: `deploy/web.Dockerfile` (Caddy) serving the apex and proxying `api.<apex>`, with automatic HTTPS | `deploy/vps/docker-compose.yml`, `deploy/vps/Caddyfile` |

All three read the same inputs: `MODE=prod` plus the plain server names (or `server/.env` on the VPS), and the `VITE_*` build inputs (or `client/.env`). The Caddy images send the same security headers as Pages and Netlify: `deploy/headers-to-caddy.mjs` converts the build's `dist/_headers`.

## What gets deployed

| Piece | What it is | How it runs |
| :--- | :--- | :--- |
| API | `server/` (Express) | One always-on container built from `server/Dockerfile`. Serves `/api/*` (dashboard, cookie session) and `/v1/*` (public, bearer token). |
| Dashboard and public site | `client/` (React) | Static files from `npm run build` (`client/dist`) with the SPA fallback. |
| Database | MongoDB Atlas | A production project and cluster of its own. M0 is enough for the beta. |
| Backups | GitHub Actions | `.github/workflows/backup.yml`, nightly, encrypted, 30-day retention. |
| Checks | GitHub Actions | `.github/workflows/ci.yml` on every push. |

The API does not serve the dashboard files; they are two deployables.

## Topology

```
users / consumers                 owner's tenants' sites
      │                                   │
      ▼                                   ▼
<apex>  (static host or Caddy)       api.<apex>  (DNS only, "grey cloud")
  client/dist + SPA fallback               │ one hop (the platform's router or Caddy)
      │  XHR to api.<apex>/api             ▼
      └──────────────────────────►  one container: node server.js
                                       /api  /v1  /livez  /readyz
                                           │
                                           ▼
                                   Atlas prod cluster (own project, own users)
```

- **The SPA on the apex, the API on `api.<apex>`.** `CLIENT_ORIGIN=https://<apex>`, `PUBLIC_API_URL=https://api.<apex>`, `VITE_SITE_DOMAIN=<apex>`, `VITE_PROD_API_URL=https://api.<apex>`. `api.<apex>` serves both `/api` and `/v1`; `PUBLIC_API_URL` is what the dashboard shows as the base of every `/v1` call.
- **Same site is the only supported layout.** The session cookie is `SameSite=Lax`, so the dashboard and the API must share a registrable domain. Free platform hostnames (`*.onrender.com`, `*.up.railway.app`, `*.pages.dev`) are each their own site: the production boot refuses such a pair, and `SameSite=None` is not a fix (Safari and other browsers block it). Add your own domain before the first sign-in.
- **DNS only for `api.`** (no Cloudflare proxy). Nothing may cache `/v1` by URL: the URL carries no tenant, so a URL-keyed cache would serve one tenant's data to another. Responses already say `Cache-Control: private`. A proxy would also add a hop that `TRUST_PROXY_HOPS` has to account for.
- **`TRUST_PROXY_HOPS=1`**: the platform's router (or Caddy on the VPS) is the one proxy between the visitor and Node. Too low and every visitor shares one IP, so the rate limits lock everyone out together; too high and callers can forge their IP.
- **Run exactly one API instance**, never scale-to-zero and never two replicas. Rate limits, the response cache, the active-token set, the invite guard and the content-quota lock all live in process memory ([ARCHITECTURE.md](ARCHITECTURE.md#state-that-lives-in-memory)). A second instance doubles every limit and keeps revoked tokens alive on the other one. Render's free instances sleep, so use a paid one.

## Production database

1. Create a **new Atlas project** for production, separate from the project the dev cluster lives in, and a cluster in it (M0 is fine).
2. Create two database users, both scoped to the production database only:
   - the **API user**, `readWrite` on `Portfolio_prod`, used by the container;
   - the **backup user**, `read` on `Portfolio_prod`, used only by the backup workflow.
3. Allow network access from the container platform's egress and from GitHub Actions (Atlas M0 cannot restrict by IP meaningfully for either; `0.0.0.0/0` with strong passwords is the honest setting).
4. Build the connection strings with the database name in the path: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/Portfolio_prod?retryWrites=true&w=majority`.

**The sibling Portfolio never gets this credential.** The hosted service's production database and users exist only in this Atlas project and are known only to the container's environment and the Actions secrets. The owner's Portfolio becomes tenant #1 later and reads through `/v1` with an `sk_` key like everyone else. No read-only "reporting" user either: a read-only user still reads every tenant's drafts.

Do not reuse the development database, the development cluster or any development password.

## Production values

### API

Set these in the **container platform's environment settings** (on the VPS, the `PROD_*` block of `server/.env`). Use the plain names with `MODE=prod`.

```env
MODE=prod
MONGODB_URI=mongodb+srv://api_user:<password>@<cluster>.mongodb.net/Portfolio_prod?retryWrites=true&w=majority
JWT_SECRET=<new 32+ character random string, not the dev one>
INVITE_CODE_PEPPER=<another 32+ character random string, different from JWT_SECRET; keep it stable>
CLIENT_ORIGIN=https://example.com
PUBLIC_API_URL=https://api.example.com
TRUST_PROXY_HOPS=1
SESSION_COOKIE_SAMESITE=lax
SIGNUP_MODE=closed
LEGAL_POLICIES_APPROVED=false
RESEND_MAIL_KEY=<live key>
RESEND_FROM_EMAIL=Portfolio Control <no-reply@example.com>
PRODUCT_NAME=Portfolio Control
OPERATOR_NAME=<legal name, same as VITE_SITE_OPERATOR>
SUPPORT_EMAIL=support@example.com
LOG_LEVEL=info
```

- `PUBLIC_API_URL` is **required** and must be on the same site as `CLIENT_ORIGIN`; the boot refuses anything else.
- `INVITE_CODE_PEPPER` is required: invite codes are hashed with it instead of `JWT_SECRET`, so the signing key can be rotated after an incident without killing outstanding invites.
- `LEGAL_POLICIES_APPROVED` stays `false` until the Terms, Privacy and Acceptable Use pages are final and reviewed; with `false`, production signup returns `503 signup_unavailable` whatever the mode says. `SIGNUP_MODE=closed` is the default anyway; set it explicitly so the intent is visible.
- Mail: `RESEND_FROM_EMAIL` on a domain verified in Resend, plus `OPERATOR_NAME` and `SUPPORT_EMAIL`. With signup `closed` a gap here is only a warning, but signup cannot be opened from the panel (`409 mail_not_ready`) until it is fixed; with signup not `closed` it is fatal at boot. See [Mail readiness](ENVIRONMENT.md#mail-readiness).
- `MAIL_DAILY_CAP` / `MAIL_RESET_RESERVE` default to 95 / 20 (the Resend free tier). Leave `MAIL_TRANSPORT` unset; `console` is refused.
- Turnstile is optional. Set **both** keys of your own widget or neither, and add the dashboard hostname to the widget; test keys are refused.

### Dashboard build

Set in the static host's build environment (on the VPS, `client/.env`):

```env
NODE_VERSION=22
VITE_MODE=prod
VITE_PROD_API_URL=https://api.example.com
VITE_SITE_DOMAIN=example.com
VITE_SITE_OPERATOR=<legal name>
VITE_SITE_JURISDICTION=<country or state>
VITE_SITE_SUPPORT_EMAIL=support@example.com
VITE_SITE_HOSTING_PROVIDER=<who runs the servers>
VITE_SITE_BACKUP_PROVIDER=<where backups are stored>
VITE_SITE_LOG_PROVIDER=<where logs are kept>
```

The prod build fails while `VITE_PROD_API_URL`, `VITE_SITE_DOMAIN`, `VITE_SITE_OPERATOR` or `VITE_SITE_JURISDICTION` is missing or malformed. `VITE_PROD_API_URL` may be the bare origin or end in `/api`. Run `npm run check:launch` from `client/` before the first invite: it also fails on the three provider values and on any placeholder or `example.com` value.

| Setting (Pages / Netlify) | Value |
| :--- | :--- |
| Root directory | `client` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Node | 22 (`client/.node-version`) |

The build reads `../server/contract` and `../docs`, so the host must check out the whole repository. It generates `dist/_headers` (CSP with the API origin, frame and transport headers), the same CSP as a `<meta>` in `index.html` for hosts that ignore `_headers` (Render static sites, Caddy), and `dist/.well-known/security.txt` for `VITE_SITE_DOMAIN`. `client/public/_redirects` sends every unknown path to `index.html`, so `/dashboard/apps`, `/docs/api` and `/verify-email?token=…` work on a hard reload. There is deliberately **no `404.html`**: on Cloudflare Pages its presence turns off the SPA fallback, and the SPA's own not-found page handles unknown paths. Render's Blueprint and the Caddyfiles implement the same fallback.

Custom domain: the apex, HTTPS on, and it must equal `CLIENT_ORIGIN` exactly (no trailing slash).

## Bootstrap: indexes and the first superadmin

```bash
npm run production:prepare
```

Run it from `server/` **only** this way, preferably from the API platform's shell. If you run it locally (with `MODE=prod` and `PROD_MONGODB_URI` set temporarily), the database it prints must match the API's boot line. It runs the data-safety checks, asks you to type the database name, creates indexes without dropping anything, then creates a verified superadmin (password typed without echo, 12+ characters) or promotes an existing verified account. `npm run setup` under `MODE=prod` refuses without `--confirm-db` because it resets a password; don't use it, `admin` or `superadmin:grant` for the bootstrap.

Set `MODE=dev` again as soon as it is done, and remove the production URI from your laptop once the container and the workflow have it.

## The API container

What `server/Dockerfile` does: `node:22-alpine` pinned by digest (Node 22 LTS; Dependabot proposes digest bumps), `npm ci --omit=dev`, includes `contract/` (the legal versions shared with the client), runs as the unprivileged `node` user, exposes `PORT` 5000, has a Docker `HEALTHCHECK` on `/livez`, and starts `node server.js` under `tini` so SIGTERM reaches Node.

```bash
cd server
docker build -t cms-api .
docker run --rm -p 5000:5000 --env-file prod.env cms-api   # prod.env: the plain names above; keep it out of git
```

Probes:

| Path | Answers | Use it for |
| :--- | :--- | :--- |
| `GET /livez` | `200` as soon as the process is up | the container health check, restarts |
| `GET /readyz` | `200` when Mongo answers a ping (shared across calls for 3 s), `503` otherwise; body is only `{status}` | the platform's readiness / traffic gate (Render and Railway use it) |
| `GET /api/health` | alias of `/livez`, kept for older monitors | |

Both probes are mounted before the `/api` rate limiter, so a monitor can never be rate-limited into a false alarm.

Shutdown: on `SIGTERM` the server flips `/readyz` to `503`, waits `SHUTDOWN_DELAY_MS` (default 5000) so the load balancer stops routing to it, then stops accepting connections, lets in-flight requests finish, closes Mongo and exits. Give the platform a stop grace period of at least `SHUTDOWN_DELAY_MS` + 10 s (15 s with the default; the VPS compose file uses 20 s, Railway drains for 20 s).

The process logs one JSON line per request (pino) with a `reqId` that is also echoed as `X-Request-Id`, so a consumer's error report can be matched to a log line. Logs go to stdout only: point the platform's log drain at a sink with retention and set up the alerts in [OPERATIONS.md](OPERATIONS.md#alerts). It starts with `[Env] MODE=prod · database Portfolio_prod`. If it exits with `Invalid configuration`, the message lists what to fix.

## Smoke test

From `client/`, against the real hosts:

```bash
npm run smoke -- https://example.com https://api.example.com
```

`scripts/smoke-deploy.mjs` checks that the API's `publicApiBase` is allowed by the dashboard's CSP `connect-src`, that a CORS preflight from the dashboard origin is answered with credentials, that the SPA deep links (`/verify-email?token=x`, `/reset-password`, `/dashboard/apps`) answer `200` HTML, that the two hosts are not cross-site, and that `/v1/projects` without a key answers `401` JSON. It prints PASS/FAIL per check and exits 1 on any failure.

Then by hand:

1. Open the dashboard, sign in as the superadmin, reload. Staying signed in proves the cookie settings.
2. Fill in the profile and save it (that sets `configured`), add one project and publish it.
3. Create an App of type "Build or server", create a secret key, open the App's Connect panel and copy the snippet. Run its `check` (the dashboard calls `POST /api/apps/:id/check`) and expect no warnings.
4. From outside, with the real public URL:

```bash
curl -i -H "Authorization: Bearer sk_live_..." https://api.example.com/v1/app
```

Expect `200`, an `ETag`, `Cache-Control: private, max-age=60`, an `X-Request-Id`, and a body shaped `{"data":{"name":"...","type":"protected","enabledSections":[...]}}`. Then `/v1/projects` should return `{"data":[...]}` with the published project. A disabled section answers `403 {"error":"section_disabled",...}`.

5. Trigger "Forgot password" for your own account and confirm the email arrives and the link opens the dashboard.
6. `curl https://api.example.com/readyz` returns `200`.

## Backups and CI

1. In the repository settings add the Actions secrets `PROD_MONGODB_URI` (the **backup** user), `BACKUP_PASSPHRASE`, `BACKUP_REMOTE_DESTINATION`, `RCLONE_CONFIG`, and optionally `BACKUP_HEARTBEAT_URL` ([ENVIRONMENT.md](ENVIRONMENT.md#backup-workflow-secrets-github-actions)).
2. Run "Nightly backup" by hand once from the Actions tab and read its log: it should print `Encrypted backup complete`, the off-host prune line, the storage line and, if set, the heartbeat.
3. Pull that archive down and run the restore drill ([OPERATIONS.md](OPERATIONS.md#restore-drill)); paste the `RESTORE DRILL OK` line into the drill log.
4. Confirm CI is green on the deployed commit.

## Launch checklist

Done in this order; nothing below is optional before the first stranger signs up.

- [ ] One product name; the domain bought; apex and `api.` records created.
- [ ] New production Atlas project and cluster; API user and backup user; **every dev secret rotated** and the `.env.backup-*` files deleted ([OPERATIONS.md](OPERATIONS.md#secrets-rotation)).
- [ ] CI green (`server` and `client` jobs).
- [ ] Container deployed, one instance, `TRUST_PROXY_HOPS=1`, `/livez` and `/readyz` answering, SIGTERM grace period set.
- [ ] Dashboard built with `VITE_MODE=prod` and the `VITE_SITE_*` values; `npm run check:launch` green; `CLIENT_ORIGIN` matches.
- [ ] `PUBLIC_API_URL` set; the Connect panel shows `https://api.<apex>/v1/...`.
- [ ] Resend sending domain verified; `RESEND_FROM_EMAIL` on it; `OPERATOR_NAME` and `SUPPORT_EMAIL` set (the Superadmin panel shows no mail problem).
- [ ] `INVITE_CODE_PEPPER` set (different from `JWT_SECRET`).
- [ ] Log drain with retention attached, alerts on the `alert` field wired, uptime monitor on `/readyz` ([OPERATIONS.md](OPERATIONS.md#alerts)).
- [ ] `SIGNUP_MODE=closed`, `LEGAL_POLICIES_APPROVED=false` until legal is approved.
- [ ] Nightly backup ran once by hand; one restore drill logged.
- [ ] `npm run smoke` green, and the smoke test above passed from the public URL, including a `/v1` `200` with the `{data}` envelope.
- [ ] The abort path rehearsed ([OPERATIONS.md](OPERATIONS.md#abort-invite-1)).
- [ ] Only then: legal pages approved → `LEGAL_POLICIES_APPROVED=true` → signup `invite`.

## Limits the deployment enforces

These are the numbers every doc and UI quotes (contract §1). They are fairness limits across tenants on one instance, not promises of capacity.

| Limit | Value |
| :--- | :--- |
| Pre-auth, per IP (IPv6 /48) | 1,200 requests/min (at least twice the `sk_` limit, so one build server can reach its key limit) |
| Publishable key `pk_` | 120/min per key + IP, and 3,000/min per key in total |
| Secret key `sk_` | 600/min per key |
| Per-owner miss budget | 10 units/s; only cache misses count, a hit or `304` is free; `/v1/fs` costs one unit per enabled section |
| Global miss bucket | 40 units/s, then `503 busy` with `Retry-After: 1` |
| Token-lookup pre-DB bucket | 20/s for tokens not in the active set, then `503 busy` |
| Response cache TTL | 15 min server-side, invalidated on every write, stale-if-busy; browsers may keep a copy 60 s (`ETag` + `Cache-Control: private, max-age=60`) |
| Per account | 10 Apps, 100 items per section, 2 live keys per App, field caps in [DATA_MODEL.md](DATA_MODEL.md#field-caps) |
| Mail | `MAIL_DAILY_CAP` 95/day with a 20 reset reserve; `SIGNUP_DOMAIN_DAILY_CAP` 50 new signups per email domain per day |
| Login | 30 failed attempts per IP (IPv6 /56) per 15 min, 10 per IP + email per 15 min, 50 per email across all IPs per hour; at most `BCRYPT_MAX_CONCURRENT` (4) password checks at once, then `503 busy` |
| Storage | at `STORAGE_BLOCK_PERCENT` (90%) of `DB_STORAGE_CAP_BYTES`, signup closes and content writes answer `503 storage_full` |
| Request body (`/api`) | 256 KB; `/v1` accepts no body |

Rate-limited responses carry `Retry-After`; on `/v1` only the per-key limit sends the draft-7 `RateLimit` headers.

## Opening signup to other people

Signup is off in production until all of these are true:

1. `LEGAL_POLICIES_APPROVED=true`, after the Terms, Privacy and Acceptable Use pages are final and their versions (`server/contract/legal.json`, shared by the server and the client build) are the ones the signup form records.
2. Mail is ready: a live `RESEND_MAIL_KEY`, a sender on a verified domain, `OPERATOR_NAME` and `SUPPORT_EMAIL`. Until then the panel answers `409 mail_not_ready` and lists what to fix.
3. The signup mode is `invite` or `open`: `SIGNUP_MODE`, or a superadmin's choice in the dashboard, which wins.

Mint the first invite codes (12 characters) in the Superadmin panel; `npm run invite -- --count 5` also works. Signup is email-first: the person enters only their email, follows the link, and chooses the password on the verify page; accounts that never verify are purged after 48 hours.

## Rolling back

- A bad release of the API: redeploy the previous image digest (Render and Railway keep earlier deploys; on the VPS, check out the previous commit and `docker compose up -d --build`). The in-memory caches start empty, which is harmless.
- A bad release of the dashboard: roll back to the previous deploy in the static host's UI, or rebuild the previous commit.
- Something wrong after the first invite: follow [Abort invite #1](OPERATIONS.md#abort-invite-1).
- A leaked `JWT_SECRET`: change it and restart. Every session ends; API tokens and outstanding invite codes are unaffected (invites are hashed with `INVITE_CODE_PEPPER`, which production requires).
- A leaked API key: the owner revokes it in the App's key list; it stops working within a minute (browsers may keep a copy for up to 60 s).
- A leaked database password: rotate it in Atlas, update the container environment and `PROD_MONGODB_URI`, redeploy, run the backup workflow by hand.
- A bad data change: follow the production restore runbook ([OPERATIONS.md](OPERATIONS.md#production-restore)). It covers re-applying account deletions made after the backup and rolling back one tenant only.
