# Operations

Internal runbook for the one person who operates the hosted service. It covers the CI and backup workflows, the command-line scripts in `server/scripts/` (run with `npm run <name>` from `server/`), the superadmin tools, and the routine.

Every script loads `server/.env` through the same `MODE` switch as the server and prints the mode and target database first:

```
[Env] MODE=dev · database Portfolio_dev
```

**Check that line before a script that writes.** With `MODE=prod`, these commands act on the production database, which holds other people's data.

Arguments go after `--`, for example `npm run invite -- --count 5`.

`npm run db:backup` and `npm run resume` are aliases of `backup` and `update-resume`. `npm run test:watch` and `npm run test:coverage` are variants of `npm test`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | Steps | Must stay green |
| :--- | :--- | :--- |
| `server` | Node 22, `npm ci`, `npm test` (Vitest + Supertest against `mongodb-memory-server`; the MongoDB binary is cached under `~/.cache/mongodb-binaries`), `npm run lint:security` | before any deploy |
| `client` | Node 22, the server's runtime deps (for the parity check), `npm ci`, `npm run lint` (oxlint, field parity, public-docs check), `npm test`, `npm run build` (with the dist check) with `VITE_MODE=prod` and example `VITE_SITE_*` values, then `npm run check:launch` as a non-blocking step | before any deploy |

Every action in both workflows is pinned to a full commit SHA (the tag is in the trailing comment). `.github/dependabot.yml` opens weekly grouped PRs for the actions, the server and client npm packages, and the `node:22-alpine` image digest in `server/Dockerfile`; review and merge them like any other change.

Nothing in CI touches a real database or needs a secret. A red `server` job means a test or the owner-scope lint failed; a red `client` job means a lint error, a failed test or a broken build. The `check:launch` step reports the example identity values by design until launch.

## Setup and accounts

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run setup` | Creates indexes. Creates a verified account for `ADMIN_EMAIL` with `ADMIN_PASSWORD`, or resets that account's password and re-activates it. The quickest way to a usable account in dev. With `MODE=prod` it refuses unless you add `-- --confirm-db <database>`; use `production:prepare` there. | Yes |
| `npm run setup:fresh -- --confirm <database>` | Drops the user, content, App, token and invite collections, then runs setup. Requires the exact database name. | **Destroys data** |
| `npm run production:prepare` | Interactive, `MODE=prod` only. Confirms the database name, creates indexes without dropping anything, then creates or promotes a superadmin. | Yes |
| `npm run admin` | Sets the password of `ADMIN_EMAIL` (or `npm run admin -- <email>`) and marks it verified and active. Ends that account's sessions. Reads the password from `ADMIN_PASSWORD` or stdin, never from the command line (a second argument is refused), and asks you to type the email to confirm (`--yes` for a non-interactive run). | Yes |
| `npm run superadmin:grant -- --email <email> --confirm-db <database>` | Gives an existing verified account the superadmin role. | Yes |
| `npm run invite -- --count <1-100>` | Prints new single-use, 30-day invite codes (12 characters, `A-Z` and `2-7`). Codes cannot be shown again. | Yes |
| `npm run seed -- --confirm-db <database>` | Replaces **all content** of the `ADMIN_EMAIL` account with published sample content and resets its password. Refuses `MODE=prod`. | **Destroys data** |
| `npm run update-resume -- <url>` | Sets the resume URL for `ADMIN_EMAIL` (or uses `RESUME_DRIVE_URL`). | Yes |

Under `MODE=prod`, `production:prepare`, `setup`, `admin`, `superadmin:grant` and `invite` first run the server's data-safety checks (production database differs from dev and is named in the URI; `INVITE_CODE_PEPPER` set and different from `JWT_SECRET`) and refuse to run while one fails. No script takes a password on the command line.

## Inspection

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run db:audit` | Read-only inventory: document counts, how many have an owner, how many are published, and the indexes of each collection. | No |
| `npm run stats` | Storage used against `DB_STORAGE_CAP_BYTES`, per collection. Exits with code 2 at 70% so a scheduler can alert. The nightly backup workflow runs it after the backup, so a red "Nightly backup" run is also the storage alert. | No |
| `npm run lint:security` | Static check that server code cannot bypass the owner guard. Needs no database. | No |

## Maintenance

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run sweep:deleted` | Finishes removing data for accounts marked deleted, and purges accounts that never verified their email within **48 hours** (email-first signup leaves them with no password, so they have nothing to lose). The running server also does this every `SWEEP_DELETED_INTERVAL_HOURS`. | Yes |
| `npm run tokens:notify-expiring` | Emails each owner once about API tokens expiring within `TOKEN_EXPIRY_WARNING_DAYS`. Needs a mail key and counts against the mail budget. The running server already does this every `TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS` (default 24, first run 5 minutes after boot); the script is for a one-off catch-up. It walks owners one at a time so every token query is owner-scoped. When the mail budget is spent the rest wait for the next run (`token_expiry_deferred` alert). | Yes |
| `npm run db:migrate-legacy -- --confirm <database>` | One-time migration from the old single-admin layout: assigns existing content to the `ADMIN_EMAIL` account. Not needed for a new database. | Yes |

## Backups

Atlas M0 has no managed backups. The nightly workflow is the backup.

### Nightly workflow

`.github/workflows/backup.yml` runs at **03:00 UTC** every day and on demand (Actions, "Nightly backup", "Run workflow"). It installs `mongodump`, `rclone` and `gpg` on the runner, writes the passphrase and the rclone config from secrets to 600 files, runs `npm run backup` with `MODE=prod`, then `npm run stats`, then pings `BACKUP_HEARTBEAT_URL` if that secret is set, and deletes the local files at the end whatever happened.

Secrets it needs: `PROD_MONGODB_URI` (the **backup** database user, see [DEPLOYMENT.md](DEPLOYMENT.md#production-database)), `BACKUP_PASSPHRASE`, `BACKUP_REMOTE_DESTINATION`, `RCLONE_CONFIG`. Optional secret: `BACKUP_HEARTBEAT_URL`, a dead-man's-switch monitor (healthchecks.io, Better Stack, Cronitor) pinged only after a successful run; its alert also catches a schedule that never fires (GitHub disables cron after 60 days without repository activity). Optional variable: `BACKUP_RETENTION_DAYS`. See [ENVIRONMENT.md](ENVIRONMENT.md#backup-workflow-secrets-github-actions).

Keep a copy of the passphrase somewhere that is not GitHub and not the backup bucket. Without it the archives are noise.

### What `npm run backup` does

| Step | Detail |
| :--- | :--- |
| Dump | `mongodump --archive --gzip` of the one database named in `MONGODB_URI`; the plaintext never touches disk. The URI reaches `mongodump` through a 0600 `--config` file in a private temp directory, never through argv, so `ps` cannot show the password |
| Encrypt | `gpg --symmetric --cipher-algo AES256` with `BACKUP_PASSPHRASE_FILE`, into `BACKUP_DIR/backup_<db>_<timestamp>.gz.gpg` |
| Upload | `rclone copyto` to `BACKUP_REMOTE_DESTINATION/<same name>` (required when `MODE=prod`) |
| Prune local | Deletes archives of the same database in `BACKUP_DIR` older than `BACKUP_RETENTION_DAYS` (default **30**); the newest is always kept |
| Prune off-host | `rclone lsf` then `rclone delete --min-age <days>d --include "backup_<db>_*.gz.gpg"` on the destination; the removed names are logged |

Pruning runs only after the new archive is written and uploaded, so a prune failure costs nothing but is reported with a non-zero exit. Archives are named after the database, so development and production backups rotate separately.

The 30-day window is also the answer to "how long does a deleted account's data survive in backups": at most `BACKUP_RETENTION_DAYS` days, anywhere.

### Running it by hand

From `server/` with `MODE=prod` set in the environment (`MODE=prod npm run backup`, in PowerShell `$env:MODE='prod'; npm run backup`), on a machine with MongoDB Database Tools, `gpg`, `rclone` and a 600 passphrase file. Check the `[Env]` line names the production database.

### Restore drill

Prove an archive restores, once per month and after any change to the backup tooling. It needs a **local** MongoDB (`BACKUP_RESTORE_URI`, default `mongodb://127.0.0.1:27017`); the drill refuses any other host.

```bash
rclone copy remote:cms-backups/backup_Portfolio_prod_<timestamp>.gz.gpg ~/cms-backups/
npm run backup:verify -- --file ~/cms-backups/backup_Portfolio_prod_<timestamp>.gz.gpg \
  --target-db Portfolio_restore_test --confirm-db Portfolio_restore_test
```

The script decrypts, restores into the throwaway `*_restore_test` database, compares the document count `mongorestore` reports with what is readable back, fails on any restore failure, any empty collection, or any mismatch, drops the throwaway database, and exits non-zero on any problem. On success its last lines are:

```
RESTORE DRILL OK 2026-10-11 backup_Portfolio_prod_2026-10-11T03-00-07-412Z.gz.gpg (13 collections, 3410 documents, 0 failed)
Disposable restore database was removed after verification.
```

Paste the `RESTORE DRILL OK` line into the log below.

### Restore drill log

One line per drill, newest first. The first entry is a gate for the first invite (master plan, Phase A).

```
RESTORE DRILL OK <YYYY-MM-DD> <archive name> (<n> collections, <n> documents, 0 failed)
```

| Date | Archive | Result |
| :--- | :--- | :--- |
| _none yet_ | | |

### Production restore

The drill proves an archive is readable. This is what to do when production itself needs data back. Read it through once before you need it.

A nightly archive is up to 24 hours old. Restoring it brings back everything that existed at backup time `T`, including things people removed on purpose after `T`. Three of those must be removed again before the service reopens:

- **accounts deleted after `T`** (self-service, superadmin force delete, or the 48-hour unverified purge): erasure is a legal promise, so it is re-applied;
- **API keys revoked after `T`**: a revoked key is often a leaked key, so it must not come back to life;
- **sessions**: every `tokenVersion` goes back to its value at `T`, so cookies that were revoked by a logout or password change would work again. Everyone is signed out instead.

Content, Apps and keys created after `T` are lost; tell the affected tenants.

#### Whole-database restore

Run from a machine with MongoDB Database Tools, `mongosh` and `gpg`. Keep the production URI in a 0600 file, not on the command line:

```bash
umask 077
printf 'uri: "%s"\n' 'mongodb+srv://api_user:<password>@<cluster>.mongodb.net/Portfolio_prod' > ~/prod-restore.yaml
```

1. **Freeze writes.** Set signup to `closed` in the panel, then stop the API (scale it to zero). With one replica there is nothing else writing.
2. **Pick the archive**: the newest one taken before the damage. Its name carries `T`. Run the restore drill on it first; do not restore an archive that fails the drill.
3. **Record what changed after `T`, from the live database, before touching it.** Restore the archive into a local scratch database and compare it with production:

   ```bash
   gpg --batch --pinentry-mode loopback --passphrase-file ~/backup.passphrase -d backup_Portfolio_prod_<T>.gz.gpg \
     | mongorestore --uri mongodb://127.0.0.1:27017 --archive --gzip --nsFrom 'Portfolio_prod.*' --nsTo 'Portfolio_snapshot.*'
   ```

   Then open `mongosh mongodb://127.0.0.1:27017/Portfolio_snapshot` and keep that session open until step 5. Type the production URI at the prompt, not on the command line (mongosh removes lines with credentials from its history by default):

   ```js
   const prod = connect('mongodb+srv://api_user:<password>@<cluster>.mongodb.net/Portfolio_prod');   // only read here
   const liveUsers = new Set(prod.users.distinct('_id', { status: { $ne: 'deleted' } }).map(String));
   const goneUsers = db.users.distinct('_id').filter((id) => !liveUsers.has(String(id)));
   const snapLiveTokens = db.apitokens.distinct('_id', { revokedAt: null });
   const revokedSince = prod.apitokens.distinct('_id', { _id: { $in: snapLiveTokens }, revokedAt: { $ne: null } });
   printjson({ goneUsers: goneUsers.length, revokedSince: revokedSince.length });
   ```

   `goneUsers` are accounts present at `T` and deleted (or pending deletion) since; `revokedSince` are keys live at `T` and revoked since. Keys whose whole App was deleted are covered too: their rows are revoked, not removed. Cross-check `goneUsers` against the `account_deleted`, `user_force_deleted` and `unverified_purged` log events after `T` if the log sink still has them.
4. **Restore over production.** On Atlas M0 two copies of the database may not fit in 512 MB, so restore in place with `--drop` (it replaces each collection in the archive):

   ```bash
   gpg --batch --pinentry-mode loopback --passphrase-file ~/backup.passphrase -d backup_Portfolio_prod_<T>.gz.gpg \
     | mongorestore --config ~/prod-restore.yaml --archive --gzip --drop --nsInclude 'Portfolio_prod.*'
   ```

   On a paid tier with room, restore into `Portfolio_prod_<date>` with `--nsFrom/--nsTo` instead, then repoint `MONGODB_URI`; the old database stays as evidence.
5. **Re-apply the removals**, in the same mongosh session:

   ```js
   prod.users.updateMany({ _id: { $in: goneUsers } }, { $set: { status: 'deleted' }, $inc: { tokenVersion: 1 } });
   prod.apitokens.updateMany({ _id: { $in: revokedSince } }, { $set: { revokedAt: new Date() } });
   prod.users.updateMany({}, { $inc: { tokenVersion: 1 } });   // every session ends
   ```

   Marking an account `deleted` is enough: the running server's sweep (one minute after boot, then every `SWEEP_DELETED_INTERVAL_HOURS`) cascades its content, Apps, keys and email tokens, or run `npm run sweep:deleted` now.
6. **Start the API**, run `npm run db:audit` and the smoke test from [DEPLOYMENT.md](DEPLOYMENT.md#smoke-test). The active-token set and the response cache start empty, so nothing stale is served.
7. **Reopen signup**, drop `Portfolio_snapshot`, delete `~/prod-restore.yaml`, and write down what happened (date, archive, counts from step 3).

#### Rolling back one tenant

When one account's content is damaged (a bad bulk edit, a script run against the wrong owner) and everyone else's is fine, restore only that owner's content rows. Users, Apps and API tokens are never rolled back this way: their hashes and versions must stay current.

1. Restore the archive into the local scratch database as in step 3 above (`Portfolio_snapshot`).
2. Dump that owner's rows from each content collection:

   ```bash
   for c in profiles resumes socials skills projects experiences educations certifications; do
     mongodump --uri mongodb://127.0.0.1:27017/Portfolio_snapshot --collection "$c" \
       --query '{"owner":{"$oid":"<ownerId>"}}' --out rollback/
   done
   ```

3. In production, remove the owner's current rows from the same collections (mongosh, API user):

   ```js
   const owner = ObjectId('<ownerId>');
   for (const c of ['profiles', 'resumes', 'socials', 'skills', 'projects', 'experiences', 'educations', 'certifications']) db[c].deleteMany({ owner });
   ```

4. Load the snapshot rows:

   ```bash
   mongorestore --config ~/prod-restore.yaml --dir rollback/ \
     --nsInclude 'Portfolio_snapshot.*' --nsFrom 'Portfolio_snapshot.*' --nsTo 'Portfolio_prod.*'
   ```

5. Restart the API so that owner's cached `/v1` responses are dropped (direct database writes do not bump the cache version). App selections that point at items which no longer exist are pruned the next time the App is saved.

## Superadmin

A superadmin sees an extra dashboard page (`/dashboard/superadmin`, labelled "Platform admin") and the `/api/admin/*` endpoints behind it. The role is granted only by `production:prepare` or `superadmin:grant`; there is no API to grant it. A superadmin cannot suspend or delete themselves or the last remaining superadmin.

| Endpoint | What it does |
| :--- | :--- |
| `GET /api/admin/overview` | Totals, process memory, uptime |
| `GET /api/admin/settings`, `PUT` (needs a recent re-auth) | Signup mode `closed` / `invite` / `open`; `closed` is the kill switch and the default. In production, `invite` or `open` answers `409 mail_not_ready` with the `reasons` while account mail cannot work; `GET` reports `blockedByMail`, `mailProblems` and `blockedByLegalApproval` |
| `GET /api/admin/invites`, `POST` (needs a recent re-auth), `DELETE /:id` | Invite codes: 12 characters, `maxUses` 1 to 50, expiry up to 90 days. 6-digit codes are no longer accepted |
| `GET /api/admin/users?q=&status=&cursor=` | User list, 50 per page: email, created, verified, status, role, App count, last token use |
| `POST /api/admin/users/:id/suspend` (needs a recent re-auth) | Status `suspended`: every session and every API token of that account stops within a minute (`/v1` answers `401 account_unavailable`; browsers may keep a copy for up to 60 s); content is kept |
| `POST /api/admin/users/:id/unsuspend` (needs a recent re-auth) | Back to `active`; tokens work again without being re-issued |
| `DELETE /api/admin/users/:id` (needs a recent re-auth) | Force delete: the same cascade as self-service deletion (tokens, Apps, content, email tokens, then the user) |
| `GET /api/admin/mail-budget` | Today's outbound mail: `sent`, `cap` (`MAIL_DAILY_CAP`), `reserve` (`MAIL_RESET_RESERVE`) |

### Abuse playbook

1. Suspend first, ask later. Suspension is reversible and takes effect within a minute; deletion is neither.
2. If signups are being abused, set the signup mode to `closed` from the panel. Existing accounts are unaffected.
3. If one source is hammering invites it is already locked for an hour (`INVITE_IP_FAILURE_LIMIT`, per IPv4 address or IPv6 /48; `invite_locked` alert). There is no global lock any more: many sources failing raises `invite_failures_high`. Codes have 60 bits, so guessing is not the risk; the alert usually means a code leaked or a bot found the form. Turn on Turnstile: set **both** keys (`TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`, from your own widget, not Cloudflare's test keys), add the dashboard hostname to the widget, and restart; one key alone refuses to boot. If needed, set signup to `closed` first.
4. If `mail-budget` shows `sent` near `cap` before noon, something is minting signups: close signup and look at the `signup` log events.
5. Keep a note of what you did and why; there is no audit collection yet, so the structured log (`LOG_LEVEL=info`) is the record.

## Abort invite #1

If anything breaks after the first invites go out (a security bug, data shown to the wrong tenant, mail failing, a bad release), stop in this order. Rehearse steps 1 and 2 once before minting invite #1: signup `closed` → `invite`, and revoke a spare invite.

1. **Close signup.** In the Superadmin panel, set signup to `closed`; the dashboard setting wins over `SIGNUP_MODE`. It needs a recent re-auth: a mistyped password there only fails the re-auth, it does not sign you out. For a hard stop that the panel cannot undo, set `LEGAL_POLICIES_APPROVED=false` in the API environment and restart.
2. **Revoke unused invites**: Superadmin panel, invite list, revoke (`DELETE /api/admin/invites/:id`).
3. **Suspend the affected account(s)**: Superadmin panel, Users (re-auth). Sessions and keys stop within a minute; content is kept.
4. **Roll back the dashboard** to the previous deploy in the static host's UI (Pages, Netlify, Render), or rebuild the previous commit.
5. **Redeploy the previous API image digest** (the platform's deploy history, or the previous commit on the VPS).
6. **Restore the database only through the tested restore**: [Production restore](#production-restore), never by hand.

Then write down what happened and what was rolled back, and leave signup `closed` until the cause is fixed.

## Routine checklist

| When | Do |
| :--- | :--- |
| Every push | CI runs. Do not deploy from a red run. |
| Before a production deploy | Trigger "Nightly backup" by hand and wait for it to finish |
| Nightly (automatic) | `backup.yml`: `npm run backup` + prune + `npm run stats` |
| Daily (automatic, in the server) | Token expiry notices (`TOKEN_EXPIRY_NOTICE_INTERVAL_HOURS`) |
| Every 10 minutes (automatic, in the server) | Storage guard (`STORAGE_CHECK_INTERVAL_MINUTES`); see [Storage guard](#storage-guard) |
| Weekly | Glance at `/api/admin/mail-budget` and the user list; check Atlas storage and ops/s |
| Monthly | Restore drill; add the line to the log above |
| After restoring or moving a database | `npm run db:audit` |
| Storage at 60% of the M0 cap, or ops sustained above 50/s | Plan the Atlas Flex/M10 move (the `stats` step goes red at 70%) |

## Alerts

The server logs JSON to stdout only; it has no sink of its own. Attach the host's log drain to a service with retention (Better Stack, Axiom, Grafana Cloud, Papertrail; this is an owner choice, and the privacy text must name it), then alert on the lines below. Every alert-worthy line is level `warn` (40) and carries a stable **`alert`** field, so one rule ("`alert` is present") catches them all; route by its value.

Bursty sources are deduplicated in process: one line per key per window, with the `count` seen so far, never one line per request.

| `alert` | Means | Fires | Do |
| :--- | :--- | :--- | :--- |
| `busy_503` | Load shedding: `503 busy` on `/v1` (global miss bucket, pre-DB bucket) or on login (bcrypt gate full) | first one per minute per surface (`v1` / `api`) | Look for a flood in the access log (`path`, `owner`, `app`). Sustained: the instance is too small or a key is being scraped |
| `rate_limited_429` | 429s across all routes | `ALERT_429_PER_MINUTE` (default 100) per minute per surface | Find the source in the access log; one tenant's site misbehaving, or a scraper |
| `token_invalid_burst` | `/v1` 401s for one key prefix (`pk_live_XXXX`) | `ALERT_TOKEN_INVALID_PER_MINUTE` (default 30) per minute per prefix | A tenant's site is using a revoked or mistyped key, or valid keys are being refused (an active-set bug). `key` is the public prefix, never the token |
| `mail_budget_half` | Half of `MAIL_DAILY_CAP` is spent today | once per day | Before noon UTC: something is minting signups. Check `signup` events |
| `mail_reset_reserve_half` | Half of the password-reset reserve is spent | once per day | Someone is requesting resets in bulk |
| `mail_budget_exhausted` | A send was refused by the budget | once per 10 minutes per kind (`general` / `reset`) | Signup and resend answer `503 mail_budget` until UTC midnight |
| `invite_locked` | One source hit `INVITE_IP_FAILURE_LIMIT` wrong invite codes | once per hour per source (IP truncated) | Usually nothing; see the abuse playbook |
| `invite_failures_high` | `INVITE_FAILURE_LIMIT` wrong codes in an hour across all sources | once per hour | See the abuse playbook, step 3 |
| `signup_domain_capped` | One email domain hit `SIGNUP_DOMAIN_DAILY_CAP` new signups today | once per hour per domain | A real company onboarding (raise the cap) or a bot (leave it) |
| `account_cap_reached` | `MAX_ACCOUNTS` reached; signup refused | every refused signup | Raise the cap or keep signup closed |
| `storage_high` | Storage at `STORAGE_WARN_PERCENT` (70%) of `DB_STORAGE_CAP_BYTES` | every check (10 min) while above | Plan the Atlas upgrade or a cleanup |
| `storage_full` | Storage at `STORAGE_BLOCK_PERCENT` (90%): signup closed, content writes refused | once on entering the state (`storage_recovered` event on leaving) | Act now: upgrade the cluster or free space |
| `token_expiry_deferred` | Expiry notices postponed by the mail budget | per run | They retry the next day |

Minimum wiring before the first invite: page on `busy_503`, `storage_full` and `mail_budget_exhausted`; email on the rest. Add an external uptime check on `/readyz` (it is not an alert line; the monitor sees the 503).

Logged client IPs are truncated (IPv4 `/24`, IPv6 `/48`); request ids are server-generated unless the client sends a well-formed `X-Request-Id` (`[A-Za-z0-9._-]{1,64}`), which is echoed so a tenant's error report matches a log line.

## Storage guard

Atlas M0 refuses every write for every tenant at 512 MB. The server runs `dbStats` every `STORAGE_CHECK_INTERVAL_MINUTES` (default 10) and compares storage plus index size with `DB_STORAGE_CAP_BYTES`:

- at `STORAGE_WARN_PERCENT` (70%): `storage_high` alert, nothing else changes;
- at `STORAGE_BLOCK_PERCENT` (90%): signup closes for everyone (`/api/auth/config` reports `closed`) and content and App writes answer `503 storage_full`. Reads, `/v1` and deletes keep working, so tenants can free space themselves.

The state clears on the next check below the threshold. `MAX_ACCOUNTS` (optional) caps accounts the same way: at the cap, signup answers `503 signup_unavailable` for every address.

## Single replica: what lives in memory

The API runs as **exactly one instance**. These are kept in process memory and start empty on every restart or deploy:

- every rate limiter (`/api`, login, signup, recovery, `/v1` pre-auth, per-key, per-owner and global buckets);
- the invite guard, the per-recipient mail cooldowns, the per-domain signup counts and the bcrypt gate;
- the burst-alert windows, the storage-guard state (re-checked 5 seconds after boot), the active-token set and the response cache.

Only the daily mail counter (`Setting` `mail:YYYY-MM-DD`) persists. This is a deliberate tradeoff for one small instance: no Redis or Mongo TTL store to run, at the price that a restart forgives everyone's limits. An attacker cannot force a restart through the API, and deploys are rare. Revisit it before running a second replica or if deploys become frequent; the limiters accept an `express-rate-limit` store, so the change is local to `middleware/authRateLimiters.js` and `middleware/v1Limiters.js`.

## Secrets rotation

Do this whenever a secret may have been exposed:

1. **Rotate the affected secret** and anything stored next to it: the Atlas database user's password, `JWT_SECRET`, the Resend key, `INVITE_CODE_PEPPER` if it leaked.
2. **Keep no copies of `.env` files** (`.env.backup`, `.env.old`, …). Even git-ignored, they are plaintext secrets on disk. If you need a copy, put it in a password manager.
3. Production secrets are never on a laptop: they live in the host's environment settings and in GitHub Actions secrets. The production Atlas users (API and backup) exist only in the production Atlas project, and no other application receives either credential.
4. After rotating `JWT_SECRET`, every session ends (users sign in again); API tokens and outstanding invites are unaffected (invites are hashed with `INVITE_CODE_PEPPER`, required in production). Rotating `INVITE_CODE_PEPPER` kills every outstanding invite, so only rotate it if it leaked. After rotating the Atlas password, update the host environment and the `PROD_MONGODB_URI` secret, then run the backup workflow by hand to confirm.
