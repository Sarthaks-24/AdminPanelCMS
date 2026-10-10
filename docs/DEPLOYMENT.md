# Deployment guide

How to take the project from `MODE=dev` on your machine to a running production instance. Read [ENVIRONMENT.md](ENVIRONMENT.md) first; this guide assumes you know what the `MODE` switch does.

The project has not been deployed before, and there is no deploy configuration (Dockerfile, CI, platform file) in the repository. The steps below are the manual path.

## What gets deployed

| Piece | What it is | How it runs |
| :--- | :--- | :--- |
| API | `server/` (Express) | A long-running Node process: `npm start`. Serves `/api/*` (dashboard) and `/v1/*` (public). |
| Dashboard | `client/` (React) | Static files from `npm run build` (`client/dist`), served by any static host. |
| Database | MongoDB | Atlas or any MongoDB 6+. |

The API does not serve the dashboard files; they are two deployables.

**Run exactly one API instance.** Rate limits, the response cache, the invite-guess guard and the content-quota lock all live in process memory. A second instance would halve their effect and make revoked tokens linger on the other one.

## Choose a hosting layout

The dashboard signs in with an httpOnly cookie, so where the two pieces live decides the cookie settings.

| Layout | Example | `PROD_SESSION_COOKIE_SAMESITE` | `VITE_PROD_API_URL` | Works today |
| :--- | :--- | :--- | :--- | :--- |
| Same site, two subdomains | `cms.example.com` + `api.example.com` | `lax` | `https://api.example.com/api` | Yes |
| One origin, static host proxies `/api` and `/v1` to the API | `cms.example.com` for both | `lax` | `/api` | Yes |
| Unrelated domains | `something.vercel.app` + `something.onrender.com` | `none` | full API URL | Unreliable: browsers that block third-party cookies (Safari by default) will not stay signed in |

Prefer the first or second layout. Both need a domain you control, or a static host that can proxy.

For any layout the static host must send every unknown path to `index.html`, because the dashboard uses client-side routes such as `/admin/apps`.

## Step by step

### 1. Prepare the production database

1. Create a database user that can read and write only the production database.
2. Allow network access from your API host.
3. Build the connection string with the database name in the path, for example `.../Portfolio_prod?retryWrites=true&w=majority`. Do not reuse the development database.

Atlas free-tier (M0) clusters have no managed backups. Step 7 is your only backup.

### 2. Fill in the production values

In `server/.env`, complete the `PROD_*` block:

```env
PROD_MONGODB_URI=mongodb+srv://prod_user:...@cluster.mongodb.net/Portfolio_prod?retryWrites=true&w=majority
PROD_JWT_SECRET=<new 32+ character random string, not the dev one>
PROD_CLIENT_ORIGIN=https://cms.example.com
PROD_TRUST_PROXY_HOPS=1
PROD_SESSION_COOKIE_SAMESITE=lax
PROD_SIGNUP_MODE=closed
PROD_LEGAL_POLICIES_APPROVED=false
PROD_RESEND_MAIL_KEY=<live key>
PROD_RESEND_FROM_EMAIL=CMS <no-reply@example.com>
PROD_BACKUP_REMOTE_DESTINATION=remote:cms-backups
```

`PROD_ADMIN_PASSWORD` can stay empty; step 3 asks for the password interactively.

In `client/.env`:

```env
VITE_MODE=prod
VITE_PROD_API_URL=https://api.example.com/api
```

`TRUST_PROXY_HOPS` is the number of proxies between the visitor and Node. Platform routers (Render, Railway, Fly) and a single nginx count as 1. If you also proxy through a static host or CDN, count that too, but only if every request arrives through it: in the one-origin layout your sites and servers usually call `/v1` on the API host directly, through one hop. Setting the number higher than the shortest real path lets callers on that path forge their IP address, so in that layout keep it at the shortest path or block direct access to the API host. If every user gets rate limited at once after launch, the number is too low.

### 3. Create indexes and the first superadmin

From `server/`, with `MODE=prod` set in `server/.env`:

```bash
npm run production:prepare
```

The script prints the target host and database, asks you to type the database name, creates indexes without dropping anything, then asks for the superadmin email. It creates a verified superadmin (password typed without echo, 12+ characters) or promotes an existing verified account.

Leave `MODE=prod` until you have finished the steps in this guide that run from your machine (this one and a first backup in step 7), then set `MODE=dev` again. Do the same for `VITE_MODE` in `client/.env` after step 5: while it is `prod`, `npm run dev` points your local dashboard at the production API.

### 4. Deploy the API

On the host, run `npm ci --omit=dev` then `npm start` in `server/`.

Configure the host's environment with `MODE=prod` and either the `PROD_*` names or the plain names (`MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `TRUST_PROXY_HOPS`, ...). Both work; do not upload your `.env` file if the host has its own environment settings.

The process logs `[Env] MODE=prod · database <name>` and `[Server] Running on port <port> in prod mode`. If it exits with `Invalid configuration`, the message lists what to fix.

Health check: `GET /api/health` returns `{"status":"ok", ...}`. It confirms the process is up; it does not check the database.

### 5. Build and deploy the dashboard

```bash
cd client
npm ci
npm run build      # with VITE_MODE=prod (a build with no VITE_MODE also counts as prod)
```

`client/.env` is not in git. If your static host builds from the repository, set `VITE_MODE=prod` and `VITE_PROD_API_URL` in that host's build environment settings instead; without them the bundle falls back to `/api`, which is only right for the one-origin layout.

Upload `client/dist`. Add the SPA fallback, and for the one-origin layout the proxy rules. On Netlify-style hosts this is a file named `_redirects` placed in `client/public/` so the build copies it into `dist/`; other hosts have an equivalent rewrite setting.

```
# Netlify-style _redirects (one-origin layout)
/api/*  https://your-api-host.example/api/:splat  200
/v1/*   https://your-api-host.example/v1/:splat   200
/*      /index.html                                200
```

### 6. Smoke test

1. Open the dashboard URL, sign in as the superadmin, and reload the page. Staying signed in proves the cookie settings.
2. Create an App, enable a section, create a token.
3. Call the public API from outside:

```bash
curl -H "Authorization: Bearer pk_live_..." https://api.example.com/v1/app
```

4. Trigger "Forgot password" for your own account and confirm the email arrives and the link opens the dashboard.

### 7. Backups

Run these from `server/` with `MODE=prod`, on a machine that can reach the production database. Check that the `[Env]` line names the production database.

Before the first run:

1. Install the MongoDB Database Tools (`mongodump`, `mongorestore`), `gpg` and `rclone`.
2. Create a passphrase file that only you can read, and set `BACKUP_PASSPHRASE_FILE` to its path. Keep a copy of the passphrase somewhere other than the backups; without it the archives cannot be opened.
3. Run `rclone config` to create a remote for your storage provider, then set `PROD_BACKUP_REMOTE_DESTINATION` to `<remote-name>:<folder>`.

```bash
npm run backup            # mongodump -> gzip -> gpg (AES-256) -> BACKUP_DIR, then rclone to the remote
npm run backup:verify -- --file <archive.gz.gpg> --target-db Portfolio_restore_test --confirm-db Portfolio_restore_test
```

`backup:verify` restores into a local MongoDB (`BACKUP_RESTORE_URI`), so it needs one running on your machine; `--file` is the path of an archive in `BACKUP_DIR`. Run it once to prove an archive restores.

Nothing in the app runs backups for you. Schedule `npm run backup` with cron or your host's scheduled jobs, on a machine whose environment has `MODE=prod`. If that machine's `server/.env` says `MODE=dev`, start the job as `MODE=prod npm run backup` (in PowerShell: `$env:MODE='prod'; npm run backup`); a variable set in the environment wins over the file. The same applies to `npm run tokens:notify-expiring`. Archives are named after the database, so development and production backups rotate separately.

## Opening signup to other people

Signup is off in production until all of these are true:

1. `LEGAL_POLICIES_APPROVED=true`. The Terms and Privacy pages in the dashboard (`/legal/terms`, `/legal/privacy`) are placeholders; replace them first.
2. Mail works: a live `RESEND_MAIL_KEY` and a verified sender.
3. `SIGNUP_MODE` is `invite` or `open`, or a superadmin has chosen one in the dashboard (Superadmin, Signup mode).

Invite codes are created in the Superadmin panel or with `npm run invite -- --count 5`.

## Known limits before real traffic

These come from a code review of this branch and are not fixed yet. None allows one account to read another's data, but several let a hostile user degrade the service. Close them before `open` signup.

- Several content fields (project `highlights`, `stack`, `teammates`, and similar lists on experience, education and certifications) have no size cap, and the `/v1` response cache is bounded by entry count, not bytes.
- The `/v1` global request bucket (25 requests/second across all accounts) is shared, and each account may use up to 12 of them, so three busy accounts can cause `503 busy` for everyone.
- A `pk_` token's 60 requests/minute limit is per token, not per visitor.
- Login failures are limited per email, so someone can lock a known address out for 15 minutes at a time.
- Invite codes are six digits.
- An account can be registered with someone else's email before they verify it.
- Changing an App from `static` to `protected` does not revoke its existing `pk_` tokens.
- `lastUsedAt` on API tokens is not being saved.

## Rolling back

- A bad release: redeploy the previous build of this branch.
- A leaked `JWT_SECRET`: change it and restart. Every session ends; API tokens are unaffected. Outstanding invite codes stop working too unless `INVITE_CODE_PEPPER` is set separately.
- A leaked API token: revoke it in the App's token list. It stops working immediately.
