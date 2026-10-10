# Operations

The command-line scripts in `server/scripts/`, run with `npm run <name>` from `server/`.

Every script loads `server/.env` through the same `MODE` switch as the server and prints the mode and target database first:

```
[Env] MODE=dev · database Portfolio_dev
```

**Check that line before a script that writes.** With `MODE=prod`, these commands act on the production database.

Arguments go after `--`, for example `npm run invite -- --count 5`.

`npm run db:backup` and `npm run resume` are aliases of `backup` and `update-resume`. `npm run test:watch` and `npm run test:coverage` are variants of `npm test`.

## Setup and accounts

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run setup` | Creates indexes. Creates a verified account for `ADMIN_EMAIL`, or resets that account's password to `ADMIN_PASSWORD` and re-activates it. | Yes |
| `npm run setup:fresh -- --confirm <database>` | Drops the user, content, App, token and invite collections, then runs setup. Requires the exact database name. | **Destroys data** |
| `npm run production:prepare` | Interactive, `MODE=prod` only. Confirms the database name, creates indexes without dropping anything, then creates or promotes a superadmin. | Yes |
| `npm run admin` | Sets the password of `ADMIN_EMAIL` (or `npm run admin -- <email> <password>`) and marks it verified and active. Ends that account's sessions. | Yes |
| `npm run superadmin:grant -- --email <email> --confirm-db <database>` | Gives an existing verified account the superadmin role. | Yes |
| `npm run invite -- --count <1-100>` | Prints new single-use, 30-day invite codes. Codes cannot be shown again. | Yes |
| `npm run seed` | Replaces **all content** of the `ADMIN_EMAIL` account with published sample content and resets its password. No confirmation prompt. | **Destroys data** |
| `npm run update-resume -- <url>` | Sets the resume URL for `ADMIN_EMAIL` (or uses `RESUME_DRIVE_URL`). | Yes |

Passwords passed on the command line end up in shell history; prefer the `.env` values or `production:prepare`, which asks without echo.

## Inspection

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run db:audit` | Read-only inventory: document counts, how many have an owner, how many are published, and the indexes of each collection. | No |
| `npm run stats` | Storage used against `DB_STORAGE_CAP_BYTES`, per collection. Exits with code 2 at 70% so a scheduler can alert. | No |
| `npm run lint:security` | Static check that server code cannot bypass the owner guard. Needs no database. | No |

## Maintenance

| Command | What it does | Writes |
| :--- | :--- | :--- |
| `npm run sweep:deleted` | Finishes removing data for accounts marked deleted. The running server also does this every `SWEEP_DELETED_INTERVAL_HOURS`. | Yes |
| `npm run tokens:notify-expiring` | Emails each owner once about API tokens expiring within `TOKEN_EXPIRY_WARNING_DAYS`. Needs a mail key. Intended for a daily schedule. | Yes |
| `npm run db:migrate-legacy -- --confirm <database>` | One-time migration from the old single-admin layout: assigns existing content to the `ADMIN_EMAIL` account. Not needed for a new database. | Yes |

## Backups

| Command | What it does |
| :--- | :--- |
| `npm run backup` | `mongodump`, gzip, then GPG symmetric encryption (AES-256) into `BACKUP_DIR`. Copies the archive to `BACKUP_REMOTE_DESTINATION` with rclone when set (required in prod). Archives are named after the database; the newest 14 per database are kept locally. |
| `npm run backup:verify -- --file <archive.gz.gpg> --target-db <name>_restore_test --confirm-db <same name>` | Decrypts an archive and restores it into a throwaway database on a **local** MongoDB to prove it is usable. |

Requirements: MongoDB Database Tools (`mongodump`, `mongorestore`), `gpg`, `rclone` for off-host copies, and `BACKUP_PASSPHRASE_FILE` pointing at a file only you can read (mode 600 on Linux and macOS). Keep the passphrase file somewhere other than the archives. The database name must be in the connection string.

Nothing schedules backups for you. On a free Atlas cluster there are no managed backups, so schedule `npm run backup` (cron, or your host's scheduled jobs) before storing data you care about.

## Routine checklist

| When | Do |
| :--- | :--- |
| Before a production deploy | `npm test`, `npm run lint:security`, then `npm run backup` |
| Daily (scheduled) | `npm run backup`, `npm run tokens:notify-expiring` |
| Weekly | `npm run stats` |
| After restoring or moving a database | `npm run db:audit` |
| Once, then after changes to backup tooling | `npm run backup:verify` with the arguments shown under Backups |

## Superadmin panel

A superadmin sees an extra dashboard page (`/admin/superadmin`) with totals, process memory and uptime, the signup mode switch, and invite management. The role is granted only by `production:prepare` or `superadmin:grant`; there is no API to grant it.
