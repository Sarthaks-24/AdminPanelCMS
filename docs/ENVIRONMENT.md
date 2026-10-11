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
3. For each setting in the table below, copies `DEV_<NAME>` or `PROD_<NAME>` onto the plain `<NAME>` that the rest of the code reads.
4. Sets `NODE_ENV` to `development` or `production`. Do not set `NODE_ENV` yourself; a value that disagrees with `MODE` stops the process.
5. Prints one line to stderr, for example `[Env] MODE=dev · database Portfolio_dev`, so you can see which database a command is about to touch.

The file is found relative to `server/`, whatever directory you run from. A variable already set in the shell or by the host wins over the same name in the file, including `MODE` itself. The mode mapping still applies afterwards: a `PROD_MONGODB_URI` in the file overrides a plain `MONGODB_URI` from the shell when `MODE=prod`.

`server/lib/validateEnv.js` then refuses to start the server on an unsafe configuration (see [Boot checks](#boot-checks)).

Rules worth knowing:

- **A blank value never borrows from the other mode.** If `PROD_JWT_SECRET` is empty and `MODE=prod`, the server stops with "JWT_SECRET must be set"; it does not fall back to `DEV_JWT_SECRET`.
- **Plain names still work.** If neither prefixed value exists, a plain `MONGODB_URI` is used. This is how hosting platforms are configured: set `MODE=prod` and the plain names in the platform's dashboard. A file without `MODE` falls back to `NODE_ENV`, so an older `.env` keeps working.
- **Tests ignore all of it.** Under `NODE_ENV=test` the switch is skipped and the suite uses an in-memory database.

### How the client resolves it

`client/vite.config.js` picks the API base URL when the dev server starts or the bundle is built, and compiles only that one URL into the app:

1. `VITE_MODE=prod` uses `VITE_PROD_API_URL`; `VITE_MODE=dev` uses `VITE_DEV_API_URL`. `production` and `development` are accepted spellings; any other value is treated as missing.
2. If `VITE_MODE` is missing, `vite build` counts as prod and `vite` (dev server) as dev.
3. If the chosen URL is empty, the legacy `VITE_API_URL` is tried (see below), and then the fallback is `/api` in prod (same origin) and `http://localhost:5000/api` in dev.

Vite bakes these values into the JavaScript bundle. Changing `client/.env` has no effect until you rebuild. `vite build` prints an `[env]` warning when the result looks wrong for a deploy: the mode is dev, the URL points at localhost, or the mode is prod with no `VITE_PROD_API_URL`. The file is read from `client/` wherever the build is started from.

## Backend: settings that change between dev and prod

Write each of these twice in `server/.env`, as `DEV_<NAME>` and `PROD_<NAME>`.

| Setting | Development | Production | Notes |
| :--- | :--- | :--- | :--- |
| `MONGODB_URI` | A local or non-production database, e.g. `.../Portfolio_dev` | The production database, with its own database user | Put the database name in the path; production refuses to start without it. In dev, a URI without one uses `MONGODB_DB`, then `Portfolio_db`. |
| `JWT_SECRET` | Any random string of 32+ characters | A different random string of 32+ characters | Signs session cookies. Changing it signs everyone out. In dev it also hashes invite codes when `INVITE_CODE_PEPPER` is blank. |
| `INVITE_CODE_PEPPER` | Empty (falls back to `JWT_SECRET`), or any 32+ character string | **Required**: a random 32+ character string, different from `JWT_SECRET` | Key for the HMAC of invite codes. Keep it stable: changing it invalidates every outstanding invite. Kept apart from `JWT_SECRET` so the signing key can be rotated after an incident without killing invites. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | `https://` origin the dashboard is served from | Exact origin, no trailing slash. It is the only origin allowed by dashboard CORS and the base of emailed verify/reset links. Must be https in prod. |
| `TRUST_PROXY_HOPS` | `0` | Usually `1` | Number of reverse proxies in front of Node. Required in prod. Too low and every visitor shares one IP, so rate limits lock everyone out together; too high and clients can spoof their IP. |
| `SESSION_COOKIE_SAMESITE` | `lax` | `lax`, or `none` for unrelated domains | `lax`, `strict` or `none`; anything else means `lax`. See [hosting layouts](DEPLOYMENT.md#choose-a-hosting-layout). In prod the cookie is always `Secure`. |
| `PUBLIC_API_URL` | Empty, or `http://localhost:5000` | `https://api.example.com` | The public base of the API as consumers reach it: scheme and host only, no path, no trailing slash. The dashboard reads it from `GET /api/auth/config` (`publicApiBase`) and shows `<base>/v1/...` in every snippet, so the client never hardcodes it. Optional in both modes (owner decision): when blank the dashboard derives it from its own API URL. In prod a blank value boots with a loud `[Config] PUBLIC_API_URL is NOT set` warning, because the guessed base is what tenants copy into their apps; a set value must be an `https:` URL with no path or the server refuses to start. |
| `SIGNUP_MODE` | `invite` or `open` | `closed` until launch | `closed`, `invite` or `open`. Unset, blank or any other value means **`closed`**. A superadmin's choice in the dashboard (which can also pick `closed`) overrides this. |
| `LEGAL_POLICIES_APPROVED` | `false` | `true` only once your Terms and Privacy pages are final | In prod, signup stays unavailable until this is `true`, whatever `SIGNUP_MODE` or the dashboard says. Ignored in dev. |
| `RESEND_MAIL_KEY` | Placeholder, or a real key | Live Resend API key | Empty or the `re_xxxxxxxxx` placeholder means no email is sent. In dev, accounts made on the signup page then cannot be verified (use `npm run setup`, which creates a verified account). In prod, signup returns `email_unavailable` and reset emails are not sent. |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | An address on a domain verified in Resend | The Resend test sender only delivers to your own address. |
| `ADMIN_PASSWORD` | A local password | A different password, or empty | Used by `npm run setup`, `npm run admin` and `npm run seed`. 10+ characters. Not read by the running server, and not needed if you create the production account with `npm run production:prepare`, which asks for a password itself. |
| `BACKUP_REMOTE_DESTINATION` | Empty | An rclone remote, e.g. `remote:cms-backups` | `npm run backup` refuses to run in prod without it. |

## Backend: settings that are the same in both modes

| Setting | Default | Notes |
| :--- | :--- | :--- |
| `PORT` | `5000` | Most hosts inject this themselves. |
| `ADMIN_NAME` | `Portfolio Administrator` | Profile name the setup and seed scripts give the `ADMIN_EMAIL` account. New accounts start with a blank profile; this is never a schema default. |
| `ADMIN_EMAIL` | none | Email of the first account, used by the setup scripts. Replace the template placeholder. |
| `INVITE_FAILURE_LIMIT` | `2000` | Wrong invite codes per hour across all visitors that raise the `invite_failures_high` alert. It no longer pauses invite signup for everyone: codes have 60 bits, so a global lock only handed attackers a switch. |
| `INVITE_IP_FAILURE_LIMIT` | `10` | Wrong invite codes allowed per hour from one source (an IPv4 address, or an IPv6 `/48`) before it gets `429 invite_locked`. Other visitors are unaffected. |
| `TURNSTILE_SECRET_KEY` | empty (off) | Cloudflare Turnstile secret. When set, `POST /api/auth/signup` and `/resend-verification` require a valid `captchaToken` in the body (`400 captcha_required` / `captcha_failed`; `503 captcha_unavailable` if Cloudflare cannot be reached). |
| `TURNSTILE_SITE_KEY` | empty | The matching public site key. `GET /api/auth/config` returns it as `turnstileSiteKey` (null while Turnstile is off) so the dashboard can render the widget without a rebuild. Boot warns when the secret is set without it. |
| `SIGNUP_DOMAIN_DAILY_CAP` | `50` | New accounts per email domain per UTC day; past it, signup answers `429 rate_limited` for every address at that domain. `0` disables. Counted in memory. |
| `MAX_ACCOUNTS` | empty (no cap) | Optional cap on accounts that are not deleted. At the cap signup answers `503 signup_unavailable` for every address and logs `account_cap_reached`. |
| `BCRYPT_MAX_CONCURRENT` | `4` | Password checks allowed at once during login. Past it, login answers `503 busy` with `Retry-After: 2` instead of queueing CPU work in front of `/v1`. |
| `MAIL_DAILY_CAP` | `500` | Outbound emails allowed per UTC day across the whole service (verification, resend, account-exists notices, reset). The counter is the `Setting` key `mail:YYYY-MM-DD`. Over the cap, signup and resend return `503 mail_budget`; forgot-password still returns the generic 200 and logs the drop. |
| `MAIL_RESET_RESERVE` | `50` | Part of `MAIL_DAILY_CAP` that only password-reset mail may spend, so a signup flood cannot lock existing users out of recovery. |
| `PRODUCT_NAME` | `Portfolio Control` | Product name in account email subjects, headers and footers. Set it with `RESEND_FROM_EMAIL` (e.g. `"<Product> <no-reply@your-domain>"`) so the sender and the mail agree. Placeholder until the name is decided. |
| `OPERATOR_NAME` | the product name | Who runs the service, shown in every email footer ("… is run by …"). Use the same legal name as the Terms. |
| `SUPPORT_EMAIL` | none | Support address in every email footer. Unset means the footer has no support line, so set it before the first invite. |
| `SHUTDOWN_DELAY_MS` | `5000` | Optional. On SIGTERM the server turns `/readyz` to 503, waits this long so the load balancer stops sending traffic, then closes. Set the platform's shutdown grace period to at least this delay plus 10 s. |
| `LOG_LEVEL` | `info` | pino level for the structured request and security log (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`). Tests run with `silent`. |
| `SWEEP_DELETED_INTERVAL_HOURS` | `6` | How often the running server finishes cleanup of deleted accounts. `0` disables it. |
| `TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS` | `24` | How often the running server emails owners about API tokens expiring within `TOKEN_EXPIRY_WARNING_DAYS` (first run 5 minutes after boot). `0` disables it; it is also off while mail is not configured. |
| `STORAGE_CHECK_INTERVAL_MINUTES` | `10` | How often the running server reads `dbStats` for the storage guard. `0` disables it. |
| `STORAGE_WARN_PERCENT` | `70` | Percentage of `DB_STORAGE_CAP_BYTES` that logs the `storage_high` alert. |
| `STORAGE_BLOCK_PERCENT` | `90` | Percentage of `DB_STORAGE_CAP_BYTES` at which signup closes and content and App writes answer `503 storage_full` (reads and deletes still work). |
| `ALERT_429_PER_MINUTE` | `100` | 429 responses per minute that raise the `rate_limited_429` alert. |
| `ALERT_TOKEN_INVALID_PER_MINUTE` | `30` | `/v1` 401s per minute for one key prefix that raise the `token_invalid_burst` alert. |
| `MONGODB_DB` | `Portfolio_db` | Database name used only when the URI path has none (dev only; production requires the name in the URI). |
| `DB_STORAGE_CAP_BYTES` | `536870912` | The Atlas storage cap the storage guard and `npm run stats` measure against (`stats` exits with code 2 at 70%). |
| `TOKEN_EXPIRY_WARNING_DAYS` | `7` | Lead time for the token expiry notices, in the server and in `npm run tokens:notify-expiring` (1 to 30). |
| `BACKUP_PASSPHRASE_FILE` | none | File holding the backup passphrase. Required by the backup scripts. |
| `BACKUP_DIR` | `~/cms-backups` | Where encrypted archives are written. Archives are named after the database; local copies older than `BACKUP_RETENTION_DAYS` are deleted after each run (the newest is always kept). |
| `BACKUP_RETENTION_DAYS` | `30` | Retention window for backups, local and off-host. After each successful upload `npm run backup` runs `rclone delete --min-age <days>d` on `BACKUP_RETENTION_DAYS`-old archives of the same database in `BACKUP_REMOTE_DESTINATION` and logs what it removed. This window is also how long a deleted account's data can survive in backups. |
| `RCLONE_BINARY`, `GPG_BINARY`, `MONGORESTORE_BINARY` | `rclone`, `gpg`, `mongorestore` | Override if the tools are not on `PATH`. `mongodump` has no override: it must be on `PATH` (on Windows the default MongoDB Tools install folder is also tried). |
| `BACKUP_RESTORE_URI` | `mongodb://127.0.0.1:27017` | Restore-drill target. Must be a local MongoDB. |
| `RESUME_DRIVE_URL` | none | Read only by `npm run update-resume` (`RESUME_URL` is accepted as an alias). |

## Frontend

| Setting | Development | Production | Notes |
| :--- | :--- | :--- | :--- |
| `VITE_MODE` | `dev` | `prod` | The switch. |
| `VITE_DEV_API_URL` | `http://localhost:5000/api` | not used | Dashboard API base URL, ending in `/api`. |
| `VITE_PROD_API_URL` | not used | `https://api.example.com/api`, or `/api` | Use `/api` when the dashboard and API are served from one origin or the static host proxies `/api`. |

`VITE_API_URL` (the old single variable) is still honoured as a fallback when the mode-specific one is empty. In prod mode it is ignored if `VITE_DEV_API_URL` exists, so a leftover development URL cannot become a production build's API.

Everything prefixed `VITE_` is public. Never put a secret in `client/.env`.

The dashboard API base (`VITE_PROD_API_URL`) and the public `/v1` base shown to users are different settings. The second one comes from the server's `PUBLIC_API_URL`, fetched at runtime through `GET /api/auth/config`, so a rebuild is not needed when the public hostname changes.

## Backup workflow secrets (GitHub Actions)

`.github/workflows/backup.yml` runs `npm run backup` nightly without a `.env` file. It takes its settings from repository secrets, which map onto the variables above:

| Secret | Becomes |
| :--- | :--- |
| `PROD_MONGODB_URI` | `MONGODB_URI` (use the dedicated backup database user, not the API user) |
| `BACKUP_PASSPHRASE` | written to a 600 temp file that `BACKUP_PASSPHRASE_FILE` points at |
| `BACKUP_REMOTE_DESTINATION` | `BACKUP_REMOTE_DESTINATION` |
| `RCLONE_CONFIG` | `~/.config/rclone/rclone.conf` on the runner |

The repository variable `BACKUP_RETENTION_DAYS` (optional) overrides the 30-day default. The workflow sets `MODE=prod` itself.

## Boot checks

The server will not start when any of these is true:

| Check | Mode |
| :--- | :--- |
| `MODE` is not `dev`/`prod`, or disagrees with a stray `NODE_ENV`, or is missing while `NODE_ENV` is also unset | both |
| `JWT_SECRET` is shorter than 32 characters or still an example placeholder | both |
| `MONGODB_URI` is empty | both |
| `TRUST_PROXY_HOPS` is not a non-negative integer (reported as a plain error, not under "Invalid configuration") | both |
| `CLIENT_ORIGIN` is set but is not a bare origin exactly as a browser sends it (no trailing slash, path, uppercase or default port) | both |
| `CLIENT_ORIGIN` is not a valid `https://` URL | prod |
| `TRUST_PROXY_HOPS` is not set explicitly | prod |
| `MONGODB_URI` points at the same cluster and database as `DEV_MONGODB_URI`, or `JWT_SECRET` equals `DEV_JWT_SECRET` (only checked when the `DEV_` values are present) | prod |
| `MONGODB_URI` has no database name in its path | prod |
| `PUBLIC_API_URL` is set but is not `https:`, or has a path (a missing one is only a warning) | prod |
| `INVITE_CODE_PEPPER` is shorter than 32 characters or equals `JWT_SECRET` | prod |
| `RESEND_MAIL_KEY` is missing or a placeholder, or `RESEND_FROM_EMAIL` is blank or the Resend test sender, while signup is not `closed` | prod |

With signup `closed` the mail checks are only a `[Config]` warning, because nothing can register. The moment you flip to `invite` or `open`, a test sender would make every verification email fail silently, which is why it is fatal.

These checks run when the server starts. The scripts apply the `MODE` switch but not these checks; each script validates only what it needs.

## What MODE=prod changes at runtime

| Behaviour | dev | prod |
| :--- | :--- | :--- |
| Session cookie `Secure` flag | only if `SameSite=None` | always |
| Error responses | include the error message and stack trace | 5xx return `Internal Server Error`, no stack |
| `http://localhost` as an App's allowed origin | accepted | rejected; https only |
| Signup without a real mail key | allowed (no email is sent) | refused at boot unless signup is `closed` |
| Signup without `LEGAL_POLICIES_APPROVED=true` | allowed | `503 signup_unavailable` |
| `PUBLIC_API_URL` | optional | optional with a loud boot warning; when set, `https:` and no path |
| `INVITE_CODE_PEPPER` | optional (falls back to `JWT_SECRET`) | required, separate from `JWT_SECRET` |
| `npm run backup` without a remote destination | allowed | refused |
| `npm run production:prepare` | refused | allowed |

## Switching modes safely

- Scripts follow `MODE` too. `npm run seed` with `MODE=prod` wipes and reseeds content for `ADMIN_EMAIL` in the production database. Read the `[Env]` line before a destructive command finishes connecting, and switch back to `MODE=dev` when you are done.
- Keeping production secrets in a file on your laptop is a convenience, not a requirement. For a deployed server, prefer setting `MODE=prod` and the plain variable names in the host's environment settings and leaving the `PROD_*` block empty locally.
- Generate secrets with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
