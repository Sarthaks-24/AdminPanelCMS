# Deployment guide

Internal guide for the operator. The product is a hosted, multi-tenant service: there is **one** deployment, run by the owner, and everyone else signs up to it. This page takes the repository from `MODE=dev` on your machine to that deployment. Read [ENVIRONMENT.md](ENVIRONMENT.md) first; this guide assumes you know what the `MODE` switch does.

## What gets deployed

| Piece | What it is | How it runs |
| :--- | :--- | :--- |
| API | `server/` (Express) | One always-on container built from `server/Dockerfile`. Serves `/api/*` (dashboard, cookie session) and `/v1/*` (public, bearer token). |
| Dashboard and public site | `client/` (React) | Static files from `npm run build` (`client/dist`) on Cloudflare Pages or Netlify with the SPA fallback. |
| Database | MongoDB Atlas | A production project and cluster of its own. M0 is enough for the beta. |
| Backups | GitHub Actions | `.github/workflows/backup.yml`, nightly, encrypted, 30-day retention. |
| Checks | GitHub Actions | `.github/workflows/ci.yml` on every push. |

The API does not serve the dashboard files; they are two deployables.

## Topology

```
users / consumers                 owner's tenants' sites
      │                                   │
      ▼                                   ▼
cms.<domain>  (Cloudflare Pages)     api.<domain>  (DNS only, "grey cloud")
  client/dist + _redirects                 │ one hop (the platform's router)
      │  XHR to api.<domain>/api           ▼
      └──────────────────────────►  one container: node server.js
                                       /api  /v1  /livez  /readyz
                                           │
                                           ▼
                                   Atlas prod cluster (own project, own users)
```

- **`api.<domain>` serves both `/api` and `/v1`.** `PUBLIC_API_URL=https://api.<domain>` is what the dashboard shows to users as the base of every `/v1` call.
- **DNS only for `api.`** (no Cloudflare proxy). Nothing may cache `/v1` by URL: the URL carries no tenant, so a URL-keyed cache would serve one tenant's data to another. Responses already say `Cache-Control: private`. A proxy would also add a hop that `TRUST_PROXY_HOPS` has to account for.
- **`TRUST_PROXY_HOPS=1`**: the platform's router is the one proxy between the visitor and Node. Too low and every visitor shares one IP, so the rate limits lock everyone out together; too high and callers can forge their IP.
- **Same site, two subdomains** (`cms.` + `api.`) keeps the session cookie `SameSite=Lax` and works in every browser. The one-origin alternative (the static host proxies `/api` and `/v1`) works too; unrelated domains with `SameSite=None` are unreliable in Safari and are not recommended.
- **Run exactly one API instance**, never scale-to-zero and never two replicas. Rate limits, the response cache, the active-token set, the invite guard and the content-quota lock all live in process memory ([ARCHITECTURE.md](ARCHITECTURE.md#state-that-lives-in-memory)). A second instance halves every limit and keeps revoked tokens alive on the other one.

## Step by step

### 1. Prepare the production database

1. Create a **new Atlas project** for production, separate from the project the dev cluster lives in, and a cluster in it (M0 is fine).
2. Create two database users, both scoped to the production database only:
   - the **API user**, `readWrite` on `Portfolio_prod`, used by the container;
   - the **backup user**, `read` on `Portfolio_prod`, used only by the backup workflow.
3. Allow network access from the container platform's egress and from GitHub Actions (Atlas M0 cannot restrict by IP meaningfully for either; `0.0.0.0/0` with strong passwords is the honest setting).
4. Build the connection strings with the database name in the path: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/Portfolio_prod?retryWrites=true&w=majority`.

**The sibling Portfolio never gets this credential.** The hosted service's production database and users exist only in this Atlas project and are known only to the container's environment and the Actions secrets. The owner's Portfolio becomes tenant #1 later and reads through `/v1` with an `sk_` key like everyone else. No read-only "reporting" user either: a read-only user still reads every tenant's drafts.

Do not reuse the development database, the development cluster or any development password.

### 2. Fill in the production values

Set these in the **container platform's environment settings**, not in a file. Use the plain names with `MODE=prod` (the `PROD_*` block in a local `server/.env` is only for running scripts against production from your machine, and can stay empty).

```env
MODE=prod
MONGODB_URI=mongodb+srv://api_user:...@<cluster>.mongodb.net/Portfolio_prod?retryWrites=true&w=majority
JWT_SECRET=<new 32+ character random string, not the dev one>
CLIENT_ORIGIN=https://cms.example.com
PUBLIC_API_URL=https://api.example.com
TRUST_PROXY_HOPS=1
SESSION_COOKIE_SAMESITE=lax
SIGNUP_MODE=closed
LEGAL_POLICIES_APPROVED=false
RESEND_MAIL_KEY=<live key>
RESEND_FROM_EMAIL=Portfolio Control <no-reply@example.com>
LOG_LEVEL=info
```

`LEGAL_POLICIES_APPROVED` stays `false` until the Terms, Privacy and Acceptable Use pages are the real ones and reviewed; with `false`, production signup returns `503 signup_unavailable` whatever the mode says. `SIGNUP_MODE=closed` is the default anyway; set it explicitly so the intent is visible.

`RESEND_FROM_EMAIL` must be on a domain you have verified in Resend. With signup `closed` a test sender is only a warning; the moment signup opens it is fatal at boot, because a real key plus the test sender makes every verification email fail silently.

For the dashboard build, set in the static host's build environment:

```env
VITE_MODE=prod
VITE_PROD_API_URL=https://api.example.com/api
```

### 3. Create indexes and the first superadmin

From `server/` on your machine, with `MODE=prod` and `PROD_MONGODB_URI` set (temporarily) in `server/.env`:

```bash
npm run production:prepare
```

The script prints the target host and database, asks you to type the database name, creates indexes without dropping anything, then asks for the superadmin email. It creates a verified superadmin (password typed without echo, 12+ characters) or promotes an existing verified account.

Set `MODE=dev` again as soon as it is done, and remove the production URI from your laptop once the container and the workflow have it.

### 4. Build and run the API container

```bash
cd server
docker build -t cms-api .
docker run --rm -p 5000:5000 --env-file <(printenv | grep -E '^(MODE|MONGODB_URI|JWT_SECRET|CLIENT_ORIGIN|PUBLIC_API_URL|TRUST_PROXY_HOPS|SESSION_COOKIE_SAMESITE|SIGNUP_MODE|LEGAL_POLICIES_APPROVED|RESEND_|LOG_LEVEL)') cms-api
```

What the image does: `node:20-alpine`, `npm ci --omit=dev`, runs as the unprivileged `node` user, exposes `PORT` 5000, has a Docker `HEALTHCHECK` on `/livez`, and starts `node server.js` under `tini` so SIGTERM reaches Node. Any platform that runs a container (Fly.io, Render, Railway, a VPS with Docker) works; pick an always-on plan with one instance.

Probes:

| Path | Answers | Use it for |
| :--- | :--- | :--- |
| `GET /livez` | `200` as soon as the process is up | the container health check, restarts |
| `GET /readyz` | `200` when Mongo answers a ping, `503` otherwise | the platform's readiness / traffic gate |
| `GET /api/health` | alias of `/livez`, kept for older monitors | |

Both probes are mounted before the `/api` rate limiter, so a monitor can never be rate-limited into a false alarm.

Shutdown: on `SIGTERM` the server stops accepting connections, lets in-flight requests finish (a few seconds), closes Mongo and exits. Give the platform a stop grace period of at least 10 seconds so deploys drop nothing.

The process logs one JSON line per request (pino) with a `reqId` that is also echoed as `X-Request-Id`, so a consumer's error report can be matched to a log line. It starts with `[Env] MODE=prod · database Portfolio_prod`. If it exits with `Invalid configuration`, the message lists what to fix.

### 5. Deploy the dashboard

Cloudflare Pages or Netlify, building from the repository:

| Setting | Value |
| :--- | :--- |
| Root directory | `client` |
| Build command | `npm ci && npm run build` |
| Output directory | `dist` |
| Environment | `VITE_MODE=prod`, `VITE_PROD_API_URL=https://api.example.com/api`, Node 20 |

`client/public/_redirects` is already in the repository and is copied into `dist`; it sends every unknown path to `index.html` so client-side routes such as `/admin/apps` and `/docs/api` work on a hard reload. Netlify reads it as is; on Cloudflare Pages it is also honoured (Pages supports `_redirects`), and a single-page app is the default anyway when no file matches.

If you choose the one-origin layout instead, add the two proxy lines above the fallback:

```
/api/*  https://api.example.com/api/:splat  200
/v1/*   https://api.example.com/v1/:splat   200
/*      /index.html                         200
```

Custom domain: `cms.example.com`, HTTPS on, and it must equal `CLIENT_ORIGIN` exactly (no trailing slash).

### 6. Smoke test

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

### 7. Backups and CI

1. In the repository settings add the Actions secrets `PROD_MONGODB_URI` (the **backup** user), `BACKUP_PASSPHRASE`, `BACKUP_REMOTE_DESTINATION` and `RCLONE_CONFIG` ([ENVIRONMENT.md](ENVIRONMENT.md#backup-workflow-secrets-github-actions)).
2. Run "Nightly backup" by hand once from the Actions tab and read its log: it should print `Encrypted backup complete`, the off-host prune line, and the storage line.
3. Pull that archive down and run the restore drill ([OPERATIONS.md](OPERATIONS.md#restore-drill)); paste the `RESTORE DRILL OK` line into the drill log.
4. Confirm CI is green on the deployed commit.

## Launch checklist (master plan, Phase 0)

Done in this order; nothing below is optional before the first stranger signs up.

- [ ] One product name; the domain bought; `cms.` and `api.` records created.
- [ ] New production Atlas project and cluster; API user and backup user; **every dev secret rotated** and the `.env.backup-*` files deleted ([OPERATIONS.md](OPERATIONS.md#secrets-rotation)).
- [ ] CI green (`server` and `client` jobs).
- [ ] Container deployed, one instance, `TRUST_PROXY_HOPS=1`, `/livez` and `/readyz` answering, SIGTERM grace period set.
- [ ] Dashboard on Pages/Netlify with the SPA fallback; `CLIENT_ORIGIN` matches.
- [ ] `PUBLIC_API_URL` set; the Connect panel shows `https://api.<domain>/v1/...`.
- [ ] Resend sending domain verified; `RESEND_FROM_EMAIL` on it.
- [ ] `SIGNUP_MODE=closed`, `LEGAL_POLICIES_APPROVED=false` until legal is approved.
- [ ] Nightly backup ran once by hand; one restore drill logged.
- [ ] Smoke test above passed from the public URL, including a `/v1` `200` with the `{data}` envelope.
- [ ] Only then: legal pages approved → `LEGAL_POLICIES_APPROVED=true` → signup `invite`.

## Limits the deployment enforces

These are the numbers every doc and UI quotes (contract §1, 2026-10-11). They are fairness limits across tenants on one instance, not promises of capacity.

| Limit | Value |
| :--- | :--- |
| Pre-auth, per IP (IPv6 /48) | 300 requests/min |
| Publishable key `pk_` | 120/min per key + IP, and 3,000/min per key in total |
| Secret key `sk_` | 600/min per key |
| Per-owner miss budget | 10 units/s; only cache misses count, a hit or `304` is free; `/v1/fs` costs one unit per enabled section |
| Global miss bucket | 40 units/s, then `503 busy` with `Retry-After: 1` |
| Token-lookup pre-DB bucket | 20/s for tokens not in the active set, then `503 busy` |
| Response cache TTL | about 60 s (`ETag` + `Cache-Control: private, max-age=60`) |
| Per account | 10 Apps, 100 items per section, 2 live keys per App, field caps in [DATA_MODEL.md](DATA_MODEL.md#field-caps) |
| Mail | `MAIL_DAILY_CAP` 500/day with a 50 reset reserve |
| Request body (`/api`) | 256 KB; `/v1` accepts no body |

Rate-limited responses carry `Retry-After` and the draft-7 `RateLimit` headers.

## Opening signup to other people

Signup is off in production until all of these are true:

1. `LEGAL_POLICIES_APPROVED=true`, after the Terms, Privacy and Acceptable Use pages are final and their versions are the ones the signup form records.
2. Mail works: a live `RESEND_MAIL_KEY` and a sender on a verified domain (a test sender is fatal at boot once signup is not `closed`).
3. The signup mode is `invite` or `open`: `SIGNUP_MODE`, or a superadmin's choice in the dashboard, which wins.

Invite codes (12 characters) are created in the Superadmin panel or with `npm run invite -- --count 5`. Signup is email-first: the person enters only their email, follows the link, and chooses the password on the verify page; accounts that never verify are purged after 48 hours.

## Rolling back

- A bad release: redeploy the previous image. The in-memory caches start empty, which is harmless.
- A leaked `JWT_SECRET`: change it and restart. Every session ends; API tokens are unaffected. Outstanding invite codes stop working too unless `INVITE_CODE_PEPPER` is set separately.
- A leaked API key: the owner revokes it in the App's key list; it stops working on the next request (the active-token set is updated in-process).
- A leaked database password: rotate it in Atlas, update the container environment and `PROD_MONGODB_URI`, redeploy, run the backup workflow by hand.
- A bad data change: restore from the nightly archive into a fresh database with the restore-drill command pointed at it, inspect, then repoint `MONGODB_URI`. Expect to lose up to a day.
