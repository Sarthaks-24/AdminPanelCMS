# Environment reference

Every setting the project reads, what it does, and what it should be in development and in production.

There are two env files, one per package. Neither is committed.

| File | Read by | Template |
| :--- | :--- | :--- |
| `server/.env` | the API server and every `npm run` script in `server/` | `server/.env.example` |
| `client/.env` | Vite, at dev-server start and at build time | `client/.env.example` |

## The MODE switch

Each file starts with one switch. Directly below it are the settings that have to change between your machine and production, written once for each mode. You fill in both sets, and flipping the switch selects one of them.

```env
# server/.env
MODE=dev

DEV_MONGODB_URI=...      # used when MODE=dev
PROD_MONGODB_URI=...     # used when MODE=prod
```

```env
# client/.env
VITE_MODE=dev

VITE_DEV_API_URL=...     # used when VITE_MODE=dev
VITE_PROD_API_URL=...    # used when VITE_MODE=prod
```

### How the server resolves it

`server/config/loadEnv.js` runs first in `server.js` and in every script. It:

1. Loads `server/.env`.
2. Reads `MODE` (`dev` or `prod`; `development` and `production` are accepted spellings). Anything else stops the process.
3. For each setting in the [first table below](#backend-settings-that-change-between-dev-and-prod), copies `DEV_<NAME>` or `PROD_<NAME>` onto the plain `<NAME>` that the rest of the code reads (`MODE_KEYS` in `server/lib/envMode.js`).
4. Sets `NODE_ENV` to `development` or `production`. Do not set `NODE_ENV` yourself; a value that disagrees with `MODE` stops the process.
5. Prints one line to stderr, for example `[Env] MODE=dev · database Portfolio_dev`, so you can see which database a command is about to touch.

The file is found relative to `server/`, whatever directory you run from. A variable already set in the shell or by the host wins over the same name in the file, including `MODE` itself. The mode mapping still applies afterwards: a `PROD_MONGODB_URI` in the file overrides a plain `MONGODB_URI` from the shell when `MODE=prod`.

`server/lib/validateEnv.js` then refuses to start the server on an unsafe configuration (see [Boot checks](#boot-checks)).

Rules worth knowing:

- **A blank value never borrows from the other mode.** If `PROD_JWT_SECRET` is empty and `MODE=prod`, the server stops with "JWT_SECRET must be set"; it does not fall back to `DEV_JWT_SECRET`.
- **Plain names still work.** If neither prefixed value exists, a plain `MONGODB_URI` is used. This is how hosting platforms are configured: set `MODE=prod` and the plain names in the platform's dashboard. A file without `MODE` falls back to `NODE_ENV`, so an older `.env` keeps working.
- **Enum values are checked.** `SIGNUP_MODE`, `LEGAL_POLICIES_APPROVED`, `SESSION_COOKIE_SAMESITE` and `MAIL_TRANSPORT` must be one of their listed values or blank; a typo such as `SIGNUP_MODE=invites` or `LEGAL_POLICIES_APPROVED=TRUE` stops the server in both modes instead of quietly meaning the default.
- **Numbers: blank means the default, only `0` disables.** A numeric setting left blank or unset takes the default in the tables below. A value that is not a valid number also keeps the default at runtime, but the boot refuses it in production and warns in development. Only an explicit `0` turns off a guard that allows it, and production logs each one as `DISABLED`.
- **Tests ignore all of it.** Under `NODE_ENV=test` the switch is skipped and the suite uses an in-memory database.

### How the client resolves it

`client/vite.config.js` reads `client/.env` plus any `VITE_*` in the process environment (the static host's build settings win over the file) and validates everything in `client/config/buildEnv.js`. Only the chosen values are compiled into the bundle:

1. **Mode.** `VITE_MODE=prod` or `dev` (`production` and `development` are accepted spellings). Unset, `vite build` means prod and `npm run dev` means dev. **Any other value fails the build**, so a typo such as `prd` never produces a bundle.
2. **API URL.** Prod reads `VITE_PROD_API_URL`, dev reads `VITE_DEV_API_URL` (default `http://localhost:5000`). Either is the API origin, with or without a trailing `/api`; both become `<origin>/api`. Any other path, a query, credentials or a relative URL fails the build. In prod the value is required, must be `https`, and must not be localhost. There is no fallback: no `/api` same-origin default, and the old `VITE_API_URL` is no longer read.
3. **Site identity.** The `VITE_SITE_*` values below. A prod build fails while `VITE_SITE_DOMAIN`, `VITE_SITE_OPERATOR` or `VITE_SITE_JURISDICTION` is unset, or while any value is malformed. In dev, unset values render as bracketed placeholders.
4. **Generated files.** The build writes `dist/_headers` (the CSP with the API origin in `connect-src` and the hash of the inline theme script), the same policy as a `<meta http-equiv="Content-Security-Policy">` in `dist/index.html` for hosts that ignore `_headers`, and `dist/.well-known/security.txt` with the domain and an `Expires` one year after the build. `scripts/check-dist.mjs` (part of `npm run build`) fails on a leftover template token, a CSP without the API origin, a `404.html` in `dist/` (it turns off the SPA fallback on Cloudflare Pages), or an expired `security.txt`.

The build prints one `[env]` line naming the mode, the API URL and the site. Changing `client/.env` has no effect until you rebuild.

## Backend: settings that change between dev and prod

Write each of these twice in `server/.env`, as `DEV_<NAME>` and `PROD_<NAME>`.

| Setting | Development | Production | Notes |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | A local or non-production database, e.g. `.../Portfolio_dev` | The production database, with its own database user | Put the database name in the path; production refuses to start without it. In dev, a URI without one uses `MONGODB_DB`, then `Portfolio_db`. |
| `JWT_SECRET` | Any random string of 32+ characters | A different random string of 32+ characters | Signs session cookies. Changing it signs everyone out. In dev it also hashes invite codes when `INVITE_CODE_PEPPER` is blank. |
| `INVITE_CODE_PEPPER` | Empty (falls back to `JWT_SECRET`), or any 32+ character string | **Required**: a random 32+ character string, different from `JWT_SECRET` | Key for the HMAC of invite codes. Keep it stable: changing it invalidates every outstanding invite. Kept apart from `JWT_SECRET` so the signing key can be rotated after an incident without killing invites. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | `https://<apex>`, the origin the dashboard is served from | Exact origin, no trailing slash. It is the only origin allowed by dashboard CORS and the base of emailed verify/reset links. Must be https in prod. |
| `PUBLIC_API_URL` | Empty, or `http://localhost:5000` | **Required**: `https://api.<apex>` | The public base of the API as tenants reach it: a bare origin, no path, no trailing slash. The dashboard reads it from `GET /api/auth/config` (`publicApiBase`) and shows `<base>/v1/...` in every snippet. Blank in dev derives it from the dashboard's own API URL. In prod it must also be on the **same site** as `CLIENT_ORIGIN` (`<apex>` + `api.<apex>`); a provably cross-site pair, such as two free platform hostnames (`*.onrender.com`, `*.up.railway.app`, `*.pages.dev` are each their own site), refuses to boot, because the `SameSite=Lax` session cookie would never be sent. |
| `TRUST_PROXY_HOPS` | `0` | Usually `1` | Number of reverse proxies in front of Node. Required in prod. `1` behind Render, Railway, Fly or one reverse proxy; `2` with a CDN in front of that proxy. Too low and every visitor shares one IP, so rate limits lock everyone out together; too high and clients can spoof their IP. |
| `SESSION_COOKIE_SAMESITE` | `lax` | `lax` | `lax` (default), `strict` or `none`; anything else refuses to boot. `none` is not a fix for two sites: Safari and other browsers block that cookie, and production warns. In prod the cookie is always `Secure`. |
| `SIGNUP_MODE` | `invite` or `open` | `closed` until launch | `closed`, `invite` or `open`; blank means **`closed`**, anything else refuses to boot. A superadmin's choice in the dashboard (which can also pick `closed`) overrides this. |
| `LEGAL_POLICIES_APPROVED` | `false` | `true` only once your Terms and Privacy pages are final | Exactly `true` or `false` (blank = `false`). In prod, signup stays unavailable until this is `true`, whatever `SIGNUP_MODE` or the dashboard says. Ignored in dev. |
| `RESEND_MAIL_KEY` | The `re_xxxxxxxxx` placeholder, or a real key | Live Resend API key | With the placeholder in dev, mail goes to the console (see `MAIL_TRANSPORT`). In prod a missing key is a [mail readiness](#mail-readiness) problem. |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | An address on a domain verified in Resend, e.g. `"<Product> <no-reply@<apex>>"` | The Resend test sender only delivers to your own address, so production counts it as a mail readiness problem. |
| `MAIL_TRANSPORT` | `console`, or blank | Blank (= `resend`) | `resend` or `console`. `console` prints each email (recipient, subject, text with its links) to the server log instead of sending it, so the email-first signup can be walked locally. Blank in dev means `console` while `RESEND_MAIL_KEY` is the placeholder. Refused in production. |
| `MAIL_DELIVERY` | Blank | Blank | Blank, or `disabled`. `disabled` turns account email off deliberately: nothing is sent, every message is printed to the log, and `/signup` answers with the verification link rather than mailing it, so the browser that asked goes straight to the password step. It is for a deployment with no verified sending domain, where the alternative is a signup form that creates accounts nobody can finish — the password is only set from that link. It proves nothing about who owns the address, so anyone who can type one gets a working account at it. Never run a service real people sign up to this way; the boot warns while it is on. |
| `TURNSTILE_SECRET_KEY` | Empty, or Cloudflare's test secret | Your widget's secret, or empty | Cloudflare Turnstile. When set, `POST /api/auth/signup` and `/resend-verification` require a valid `captchaToken` (`400 captcha_required` / `captcha_failed`; `503 captcha_unavailable` if Cloudflare cannot be reached). **Set both keys or neither**: one without the other refuses to boot in prod (a dev warning). Cloudflare's test keys (`1x000…`, `2x000…`, `3x000…`) refuse to boot in prod. Add the dashboard hostname to the widget in Cloudflare. |
| `TURNSTILE_SITE_KEY` | Empty, or Cloudflare's test site key | Your widget's site key, or empty | The matching public key. `GET /api/auth/config` returns it as `turnstileSiteKey` (null while Turnstile is off), so the dashboard renders the widget without a rebuild. |
| `ADMIN_PASSWORD` | A local password | Empty, usually | Used by `npm run setup`, `npm run admin` and `npm run seed`. 10+ characters. Not read by the running server, and not needed if you create the production account with `npm run production:prepare`, which asks for a password itself (`npm run admin` also reads stdin). |
| `BACKUP_REMOTE_DESTINATION` | Empty | An rclone remote, e.g. `remote:cms-backups` | `npm run backup` refuses to run in prod without it. |

### Mail readiness

In production, account mail works only when all of these hold (`server/lib/mailReadiness.js`): a real `RESEND_MAIL_KEY`; a `RESEND_FROM_EMAIL` that is set and not `@resend.dev`; a non-empty `OPERATOR_NAME`; a plain-address `SUPPORT_EMAIL`; and a `MAIL_DAILY_CAP` that leaves something after `MAIL_RESET_RESERVE`. Every account email names who runs the service and where to write, so missing identity counts like a missing key.

While any of them fails:

- with `SIGNUP_MODE` not `closed`, the server refuses to boot;
- with `SIGNUP_MODE=closed`, it boots with a `[Config]` warning, and signup **stays closed**: the Superadmin panel cannot open it (`PUT /api/admin/settings` answers `409 mail_not_ready` with the list of `reasons`), and a mode saved earlier does not take effect until the problems are fixed and the server restarted. `GET /api/admin/settings` reports `blockedByMail` and `mailProblems`.

## Backend: settings that are the same in both modes

Blank or unset means the default shown. Numeric values must be numbers (see the [rules](#how-the-server-resolves-it)).

| Setting | Default | Notes |
| :--- | :--- | :--- |
| `PORT` | `5000` | Most hosts inject this themselves. |
| `ADMIN_NAME` | `Portfolio Administrator` | Profile name the setup and seed scripts give the `ADMIN_EMAIL` account. New accounts start with a blank profile; this is never a schema default. |
| `ADMIN_EMAIL` | none | Email of the first account, used by the setup scripts. Replace the template placeholder. |
| `PRODUCT_NAME` | `Portfolio Control` | Product name in account email subjects, headers and footers. Set it with `RESEND_FROM_EMAIL` so the sender and the mail agree. |
| `OPERATOR_NAME` | none (mail falls back to the product name) | Who runs the service, shown in every email footer. Use the same legal name as the Terms (`VITE_SITE_OPERATOR`). **Required before production signup can open** ([mail readiness](#mail-readiness)). |
| `SUPPORT_EMAIL` | none | Plain support address in every email footer. Keep it equal to `VITE_SITE_SUPPORT_EMAIL`. **Required before production signup can open.** |
| `MAIL_DAILY_CAP` | `95` | Outbound emails allowed per UTC day across the whole service (verification, resend, account-exists notices, reset). The counter is the `Setting` key `mail:YYYY-MM-DD`. Over the cap, signup and resend return `503 mail_budget`; forgot-password still returns the generic 200 and logs the drop. The default fits the Resend free tier (100 a day, 3,000 a month); production warns above 100. Raise it with a paid plan. |
| `MAIL_RESET_RESERVE` | `20` | Part of `MAIL_DAILY_CAP` that only password-reset mail may spend, so a signup flood cannot lock existing users out of recovery. |
| `INVITE_FAILURE_LIMIT` | `2000` | Wrong invite codes per hour across all visitors that raise the `invite_failures_high` alert. It does not pause invite signup for everyone: codes have 60 bits, so a global lock only handed attackers a switch. |
| `INVITE_IP_FAILURE_LIMIT` | `10` | Wrong invite codes allowed per hour from one source (an IPv4 address, or an IPv6 `/48`) before it gets `429 invite_locked`. Other visitors are unaffected. |
| `SIGNUP_DOMAIN_DAILY_CAP` | `50` | New accounts per email domain per UTC day; past it, signup answers `429 rate_limited` for every address at that domain. `0` disables. Counted in memory. |
| `MAX_ACCOUNTS` | none (no cap) | Optional cap on accounts that are not deleted; `0` or blank = no cap. At the cap signup answers `503 signup_unavailable` for every address and logs `account_cap_reached`. |
| `BCRYPT_MAX_CONCURRENT` | `4` | Password checks allowed at once during login. Past it, login answers `503 busy` with `Retry-After: 2` instead of queueing CPU work in front of `/v1`. |
| `SHUTDOWN_DELAY_MS` | `5000` | On SIGTERM the server turns `/readyz` to 503, waits this long so the load balancer stops sending traffic, then closes. Set the platform's shutdown grace period to at least this delay plus 10 s. A blank value is the default, not 0. |
| `LOG_LEVEL` | `info` | pino level for the structured request and security log (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`). Tests run with `silent`. |
| `SWEEP_DELETED_INTERVAL_HOURS` | `6` | How often the running server finishes cleanup of deleted accounts and purges signups never verified within 48 hours. `0` disables it. |
| `TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS` | `24` | How often the running server emails owners about API tokens expiring within `TOKEN_EXPIRY_WARNING_DAYS` (first run 5 minutes after boot). `0` disables it; it is also off while mail is not configured. |
| `TOKEN_EXPIRY_WARNING_DAYS` | `7` | Lead time for the token expiry notices, in the server and in `npm run tokens:notify-expiring` (1 to 30). |
| `STORAGE_CHECK_INTERVAL_MINUTES` | `10` | How often the running server reads `dbStats` for the storage guard. `0` disables it. |
| `STORAGE_WARN_PERCENT` | `70` | Percentage of `DB_STORAGE_CAP_BYTES` that logs the `storage_high` alert. |
| `STORAGE_BLOCK_PERCENT` | `90` | Percentage of `DB_STORAGE_CAP_BYTES` at which signup closes and content and App writes answer `503 storage_full` (reads and deletes still work). |
| `DB_STORAGE_CAP_BYTES` | `536870912` | The Atlas storage cap the storage guard and `npm run stats` measure against (`stats` exits with code 2 at 70%). |
| `ALERT_429_PER_MINUTE` | `100` | 429 responses per minute that raise the `rate_limited_429` alert. |
| `ALERT_TOKEN_INVALID_PER_MINUTE` | `30` | `/v1` 401s per minute for one key prefix that raise the `token_invalid_burst` alert. |
| `MONGODB_DB` | `Portfolio_db` | Database name used only when the URI path has none (dev only; production requires the name in the URI). |
| `BACKUP_PASSPHRASE_FILE` | none | File holding the backup passphrase. Required by the backup scripts. |
| `BACKUP_DIR` | `~/cms-backups` | Where encrypted archives are written. Archives are named after the database; local copies older than `BACKUP_RETENTION_DAYS` are deleted after each run (the newest is always kept). |
| `BACKUP_RETENTION_DAYS` | `30` | Retention window for backups, local and off-host, in whole days (1 to 3650). After each successful upload `npm run backup` runs `rclone delete --min-age <days>d` on older archives of the same database in `BACKUP_REMOTE_DESTINATION` and logs what it removed. This window is also how long a deleted account's data can survive in backups. |
| `RCLONE_BINARY`, `GPG_BINARY`, `MONGORESTORE_BINARY` | `rclone`, `gpg`, `mongorestore` | Override if the tools are not on `PATH`. `mongodump` has no override: it must be on `PATH` (on Windows the default MongoDB Tools install folder is also tried). |
| `BACKUP_RESTORE_URI` | `mongodb://127.0.0.1:27017` | Restore-drill target. Must be a local MongoDB. |
| `RESUME_DRIVE_URL` | none | Read only by `npm run update-resume` (`RESUME_URL` is accepted as an alias). |

## Frontend

All of these are build inputs, baked into the bundle and therefore public. Never put a secret in a `VITE_` variable.

| Setting | Development | Production | Notes |
| :--- | :--- | :--- | :--- |
| `VITE_MODE` | `dev` | `prod` | The switch. Unset: build = prod, dev server = dev. Any other value fails the build. |
| `VITE_DEV_API_URL` | `http://localhost:5000` (default) | not used | API origin, with or without `/api`. http allowed. |
| `VITE_PROD_API_URL` | not used | **Required**: `https://api.<apex>` | API origin, with or without `/api`; https only, not localhost. Its origin goes into the CSP `connect-src`. Must be on the same registrable domain as the dashboard, or the session cookie is never sent. |
| `VITE_SITE_DOMAIN` | optional | **Required**: `<apex>`, e.g. `portfoliocontrol.dev` | Public host of the dashboard, no scheme, port or path. Canonical URL, social cards, `security.txt`, and the default `support@`, `security@` and `abuse@` mailboxes. |
| `VITE_SITE_NAME` | optional | optional | Product name. Default `Portfolio Control`. |
| `VITE_SITE_OPERATOR` | optional | **Required** | The person or registered business that runs the service and is party to the Terms. Keep it equal to the server's `OPERATOR_NAME`. |
| `VITE_SITE_JURISDICTION` | optional | **Required** | The country or state whose law governs the Terms. |
| `VITE_SITE_SUPPORT_EMAIL` | optional | optional | Address every "contact support" message shows. Default `support@<VITE_SITE_DOMAIN>`. Keep it equal to the server's `SUPPORT_EMAIL`. |
| `VITE_SITE_HOSTING_PROVIDER` | optional | set before launch | Who runs the API and dashboard servers, quoted in the Privacy Policy. Optional for the build; `npm run check:launch` fails while unset. |
| `VITE_SITE_BACKUP_PROVIDER` | optional | set before launch | Where the encrypted off-host backups are stored. Same rule. |
| `VITE_SITE_LOG_PROVIDER` | optional | set before launch | Where request logs are shipped and retained. Same rule. |
| `VITE_SITE_STATUS_URL` | optional | optional | Public uptime page (https), linked in the footer. Unset hides the link. |

`npm run check:launch` (not part of the build) also fails on bracketed placeholders and `example.com` values in these inputs and in `README.md`, `SECURITY.md` and the public docs. Run it before the first invite.

The dashboard API base (`VITE_PROD_API_URL`) and the public `/v1` base shown to users are different settings. The second one comes from the server's `PUBLIC_API_URL`, fetched at runtime through `GET /api/auth/config`, so a rebuild is not needed when the public hostname changes.

## Backup workflow secrets (GitHub Actions)

`.github/workflows/backup.yml` runs `npm run backup` nightly without a `.env` file. It takes its settings from repository secrets, which map onto the variables above:

| Secret | Becomes |
| :--- | :--- |
| `PROD_MONGODB_URI` | `MONGODB_URI` (use the dedicated backup database user, not the API user) |
| `BACKUP_PASSPHRASE` | written to a 600 temp file that `BACKUP_PASSPHRASE_FILE` points at |
| `BACKUP_REMOTE_DESTINATION` | `BACKUP_REMOTE_DESTINATION` |
| `RCLONE_CONFIG` | `~/.config/rclone/rclone.conf` on the runner |
| `BACKUP_HEARTBEAT_URL` (optional) | A dead-man's-switch URL (healthchecks.io, Better Stack, Cronitor) pinged only after the backup and the storage check succeed. Its monitor alerts when the ping stops arriving, which also catches a schedule that never runs (GitHub disables cron after 60 days without repository activity). Skipped when empty; a failed ping fails the job. |

The repository variable `BACKUP_RETENTION_DAYS` (optional) overrides the 30-day default. The workflow sets `MODE=prod` itself.

## Boot checks

The server will not start when any of these is true:

| Check | Mode |
| :--- | :--- |
| `MODE` is not `dev`/`prod`, or disagrees with a stray `NODE_ENV`, or is missing while `NODE_ENV` is also unset | both |
| `JWT_SECRET` is shorter than 32 characters or still an example placeholder | both |
| `MONGODB_URI` is empty | both |
| `SIGNUP_MODE`, `LEGAL_POLICIES_APPROVED`, `SESSION_COOKIE_SAMESITE` or `MAIL_TRANSPORT` is set to a value outside its list | both |
| `TRUST_PROXY_HOPS` is not a non-negative integer (reported as a plain error, not under "Invalid configuration") | both |
| `CLIENT_ORIGIN` is set but is not a bare origin exactly as a browser sends it (no trailing slash, path, uppercase or default port) | both |
| `PUBLIC_API_URL` is set but is not a bare origin (a path, query or trailing slash) | both |
| A numeric setting is not a valid number (a warning in dev) | prod |
| `CLIENT_ORIGIN` is not a valid `https://` URL | prod |
| `PUBLIC_API_URL` is missing or not `https:` | prod |
| `CLIENT_ORIGIN` and `PUBLIC_API_URL` are on different sites (unless `SESSION_COOKIE_SAMESITE=none`, which only warns) | prod |
| `TRUST_PROXY_HOPS` is not set explicitly | prod |
| `MONGODB_URI` points at the same cluster and database as `DEV_MONGODB_URI`, or `JWT_SECRET` equals `DEV_JWT_SECRET` (only checked when the `DEV_` values are present) | prod |
| `MONGODB_URI` has no database name in its path | prod |
| `INVITE_CODE_PEPPER` is shorter than 32 characters or equals `JWT_SECRET` | prod |
| Only one of `TURNSTILE_SECRET_KEY` / `TURNSTILE_SITE_KEY` is set (a warning in dev), or either is a Cloudflare test key | prod |
| `MAIL_TRANSPORT=console` | prod |
| A [mail readiness](#mail-readiness) problem while `SIGNUP_MODE` is not `closed` | prod |

Production also prints `[Config]` warnings, without stopping, for: mail readiness problems while `SIGNUP_MODE=closed`; `MAIL_DAILY_CAP` above 100; a guard switched off with an explicit `0`; and `SESSION_COOKIE_SAMESITE=none`. Development warns when mail goes to the console.

### Scripts

The scripts apply the `MODE` switch but not the full boot check. The ones that write to a production database run its data-safety part (`assertDataSafety`: the database differs from `DEV_MONGODB_URI` and is named in the URI, and `INVITE_CODE_PEPPER` is set and differs from `JWT_SECRET`) and refuse to run under `MODE=prod` while it fails: `production:prepare`, `setup`, `admin`, `superadmin:grant` and `invite`.

## What MODE=prod changes at runtime

| Behaviour | dev | prod |
| :--- | :--- | :--- |
| Session cookie `Secure` flag | only if `SameSite=None` | always |
| Error responses | include the error message and stack trace | 5xx return `Internal Server Error`, no stack |
| `http://localhost` as an App's allowed origin | accepted | rejected; https only |
| Account mail without a real Resend key | printed to the server log (`MAIL_TRANSPORT=console`) | refused at boot unless signup is `closed`; then signup stays closed and the panel answers `409 mail_not_ready`, unless `MAIL_DELIVERY=disabled` is set deliberately |
| Signup without `LEGAL_POLICIES_APPROVED=true` | allowed | `503 signup_unavailable` |
| `PUBLIC_API_URL` | optional | required, `https:`, same site as `CLIENT_ORIGIN` |
| `INVITE_CODE_PEPPER` | optional (falls back to `JWT_SECRET`) | required, separate from `JWT_SECRET` |
| Turnstile keys | test keys allowed; one key alone warns | both or neither; test keys refused |
| `npm run backup` without a remote destination | allowed | refused |
| `npm run setup` | allowed | needs `--confirm-db <database>`; use `production:prepare` instead |
| `npm run seed` | allowed with `--confirm-db <database>` | refused |
| `npm run production:prepare` | refused | allowed |

## Switching modes safely

- Scripts follow `MODE` too. The dangerous one is `npm run setup`: it resets the password of `ADMIN_EMAIL` and re-activates that account, so under `MODE=prod` it refuses to run unless you add `--confirm-db <database>`. Use `npm run production:prepare` for a production database instead. `npm run seed` replaces the `ADMIN_EMAIL` account's content but refuses `MODE=prod` outright. Read the `[Env]` line before any command that writes, and switch back to `MODE=dev` when you are done.
- Keeping production secrets in a file on your laptop is a convenience, not a requirement. For a deployed server, prefer setting `MODE=prod` and the plain variable names in the host's environment settings and leaving the `PROD_*` block empty locally.
- Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
