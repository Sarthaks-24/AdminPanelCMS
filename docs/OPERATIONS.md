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
| `server` | Node 20, `npm ci`, `npm test` (Vitest + Supertest against `mongodb-memory-server`; the MongoDB binary is cached under `~/.cache/mongodb-binaries`), `npm run lint:security` | before any deploy |
| `client` | Node 20, `npm ci`, `npm run lint` (oxlint), `npm run build` with `VITE_MODE=prod` | before any deploy |

Nothing in CI touches a real database or needs a secret. A red `server` job means a test or the owner-scope lint failed; a red `client` job means a lint error or a broken build.

## Setup and accounts

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run setup` | Creates indexes. Creates a verified account for `ADMIN_EMAIL` with `ADMIN_PASSWORD`, or resets that account's password and re-activates it. This is the only way to get a usable account in dev without working email. | Yes |
| `npm run setup:fresh -- --confirm <database>` | Drops the user, content, App, token and invite collections, then runs setup. Requires the exact database name. | **Destroys data** |
| `npm run production:prepare` | Interactive, `MODE=prod` only. Confirms the database name, creates indexes without dropping anything, then creates or promotes a superadmin. | Yes |
| `npm run admin` | Sets the password of `ADMIN_EMAIL` (or `npm run admin -- <email> <password>`) and marks it verified and active. Ends that account's sessions. Reads the password from `ADMIN_PASSWORD` or stdin and asks for confirmation. | Yes |
| `npm run superadmin:grant -- --email <email> --confirm-db <database>` | Gives an existing verified account the superadmin role. | Yes |
| `npm run invite -- --count <1-100>` | Prints new single-use, 30-day invite codes (12 characters, `A-Z` and `2-7`). Codes cannot be shown again. | Yes |
| `npm run seed` | Replaces **all content** of the `ADMIN_EMAIL` account with published sample content and resets its password. Requires `--confirm-db <database>` and refuses `MODE=prod`. | **Destroys data** |
| `npm run update-resume -- <url>` | Sets the resume URL for `ADMIN_EMAIL` (or uses `RESUME_DRIVE_URL`). | Yes |

Passwords passed on the command line end up in shell history; prefer the `.env` values or `production:prepare`, which asks without echo.

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
| `npm run tokens:notify-expiring` | Emails each owner once about API tokens expiring within `TOKEN_EXPIRY_WARNING_DAYS`. Needs a mail key and counts against the mail budget. Intended for a daily schedule. | Yes |
| `npm run db:migrate-legacy -- --confirm <database>` | One-time migration from the old single-admin layout: assigns existing content to the `ADMIN_EMAIL` account. Not needed for a new database. | Yes |

## Backups

Atlas M0 has no managed backups. The nightly workflow is the backup.

### Nightly workflow

`.github/workflows/backup.yml` runs at **03:00 UTC** every day and on demand (Actions, "Nightly backup", "Run workflow"). It installs `mongodump`, `rclone` and `gpg` on the runner, writes the passphrase and the rclone config from secrets to 600 files, runs `npm run backup` with `MODE=prod`, then `npm run stats`, and deletes the local files at the end whatever happened.

Secrets it needs: `PROD_MONGODB_URI` (the **backup** database user, see [DEPLOYMENT.md](DEPLOYMENT.md#1-prepare-the-production-database)), `BACKUP_PASSPHRASE`, `BACKUP_REMOTE_DESTINATION`, `RCLONE_CONFIG`. Optional variable: `BACKUP_RETENTION_DAYS`. See [ENVIRONMENT.md](ENVIRONMENT.md#backup-workflow-secrets-github-actions).

Keep a copy of the passphrase somewhere that is not GitHub and not the backup bucket. Without it the archives are noise.

### What `npm run backup` does

| Step | Detail |
| :--- | :--- |
| Dump | `mongodump --archive --gzip` of the one database named in `MONGODB_URI`; the plaintext never touches disk |
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

## Superadmin

A superadmin sees an extra dashboard page (`/admin/superadmin`) and the `/api/admin/*` endpoints behind it. The role is granted only by `production:prepare` or `superadmin:grant`; there is no API to grant it. A superadmin cannot suspend or delete themselves or the last remaining superadmin.

| Endpoint | What it does |
| :--- | :--- |
| `GET /api/admin/overview` | Totals, process memory, uptime |
| `GET /api/admin/signup-mode`, `PUT` | Signup mode `closed` / `invite` / `open`; `closed` is the kill switch and the default |
| `GET /api/admin/invites`, `POST`, `DELETE /:id` | Invite codes: 12 characters, `maxUses` 1 to 50, expiry up to 90 days. Old 6-digit codes keep working until they expire; no new ones are made |
| `GET /api/admin/users?q=&status=&cursor=` | User list, 50 per page: email, created, verified, status, role, App count, last token use |
| `POST /api/admin/users/:id/suspend` | Status `suspended`: every session and every API token of that account stops at once (`/v1` answers `401 account_unavailable`); content is kept |
| `POST /api/admin/users/:id/unsuspend` | Back to `active`; tokens work again without being re-issued |
| `DELETE /api/admin/users/:id` | Force delete: the same cascade as self-service deletion (tokens, Apps, content, email tokens, then the user) |
| `GET /api/admin/mail-budget` | Today's outbound mail: `sent`, `cap` (`MAIL_DAILY_CAP`), `reserve` (`MAIL_RESET_RESERVE`) |

### Abuse playbook

1. Suspend first, ask later. Suspension is reversible and instant; deletion is neither.
2. If signups are being abused, set the signup mode to `closed` from the panel. Existing accounts are unaffected.
3. If one IP is hammering invites it is already locked for an hour (`INVITE_IP_FAILURE_LIMIT`); if the global guard trips, check the log for `invite_failed` events before raising `INVITE_FAILURE_LIMIT`.
4. If `mail-budget` shows `sent` near `cap` before noon, something is minting signups: close signup and look at the `signup` log events.
5. Keep a note of what you did and why; there is no audit collection yet, so the structured log (`LOG_LEVEL=info`) is the record.

## Routine checklist

| When | Do |
| :--- | :--- |
| Every push | CI runs. Do not deploy from a red run. |
| Before a production deploy | Trigger "Nightly backup" by hand and wait for it to finish |
| Nightly (automatic) | `backup.yml`: `npm run backup` + prune + `npm run stats` |
| Daily (to schedule) | `npm run tokens:notify-expiring` |
| Weekly | Glance at `/api/admin/mail-budget` and the user list; check Atlas storage and ops/s |
| Monthly | Restore drill; add the line to the log above |
| After restoring or moving a database | `npm run db:audit` |
| Storage at 60% of the M0 cap, or ops sustained above 50/s | Plan the Atlas Flex/M10 move (the `stats` step goes red at 70%) |

## Secrets rotation

Do this once now (council 2026-10-11, §6) and then whenever a secret may have been exposed:

1. **Rotate the dev Atlas database user's password** and every other dev secret: `DEV_JWT_SECRET`, the dev Resend key, `INVITE_CODE_PEPPER` if set. The dev Atlas password sat in a plaintext `.env.backup-*` file that was printed into a reviewer's tool output during the council run.
2. **Delete `server/.env.backup-*` and `client/.env.backup-*`.** They are git-ignored but they are still files on disk with secrets in them. Do not create new ones; if you need a copy of a `.env`, put it in a password manager.
3. Production secrets are never on a laptop: they live in the host's environment settings and in GitHub Actions secrets. The production Atlas users (API and backup) exist only in the production Atlas project; the sibling Portfolio never receives either credential.
4. After rotating `JWT_SECRET`, every session ends (users sign in again); API tokens are unaffected. After rotating the Atlas password, update the host environment and the `PROD_MONGODB_URI` secret, then run the backup workflow by hand to confirm.
