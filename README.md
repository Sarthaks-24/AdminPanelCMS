# Portfolio Control

A headless CMS for developer-portfolio content. Write your profile, projects, skills, experience and the rest once, then give each site its own scoped, read-only API.

Repository name: `AdminPanelManager`.

## What it does

- **One content pool.** A dashboard for your profile, resume link, projects, skills, experience, education, certifications and social links, each item either a draft or published.
- **Apps: a different view per consumer.** An App chooses which sections, which items and which fields one site may read. Your public portfolio can get everything; a résumé page can get three featured projects and no email address.
- **A public read-only API.** Each App has tokens for `/v1`: a publishable key for browsers, limited to origins you allow, or a secret key for servers. Responses carry ETags and are rate limited.
- **A filesystem view.** `/v1/fs` returns the same content as a tree of files (`/about/bio.txt`, `/projects/<slug>.md`), for terminal-style sites.
- **Multiple accounts.** Each account's data is isolated. Signup can be closed, invite-only or open, with email verification and password reset.

```bash
curl -H "Authorization: Bearer pk_live_..." https://api.example.com/v1/projects?featured=true
```

## Status

Built and tested locally; not yet deployed anywhere. The server suite (146 tests) passes. Read [Known limits](docs/DEPLOYMENT.md#known-limits-before-real-traffic) before opening signup to other people.

## Stack

| Part | Technology |
| :--- | :--- |
| API (`server/`) | Node.js, Express 5, Mongoose 9, MongoDB, JWT sessions in httpOnly cookies, bcrypt, Helmet, express-rate-limit, Resend |
| Dashboard (`client/`) | React 19, Vite 8, Tailwind CSS 3, React Router 7, Axios |
| Tests | Vitest, Supertest, mongodb-memory-server |

## Quick start

You need Node.js 20.19+ and a MongoDB database. The full walkthrough is in [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md).

```bash
# API
cd server
npm install
cp .env.example .env        # fill in the DEV_* block, ADMIN_EMAIL, DEV_ADMIN_PASSWORD
npm run setup               # indexes + your account
npm run dev                 # http://localhost:5000

# Dashboard (second terminal)
cd client
npm install
cp .env.example .env
npm run dev                 # http://localhost:5173/admin/login
```

## Configuration

Each package has one env file with one switch at the top. Below the switch, every setting that differs between your machine and production is written twice, once per mode.

```env
# server/.env                        # client/.env
MODE=dev                             VITE_MODE=dev

DEV_MONGODB_URI=...                  VITE_DEV_API_URL=http://localhost:5000/api
DEV_JWT_SECRET=...                   VITE_PROD_API_URL=https://api.example.com/api
DEV_CLIENT_ORIGIN=http://localhost:5173

PROD_MONGODB_URI=...
PROD_JWT_SECRET=...
PROD_CLIENT_ORIGIN=https://cms.example.com
```

Set `MODE=prod` and `VITE_MODE=prod` to use the production values. The server sets `NODE_ENV` from `MODE` and refuses to start on an unsafe configuration. Every variable is listed in [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Documentation

| Document | Contents |
| :--- | :--- |
| [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md) | Running the project locally, first API call, troubleshooting |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | The `MODE` switch and every environment variable, dev versus prod |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Hosting layouts, production steps, backups, known limits |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | The public `/v1` API and the dashboard `/api` |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it works: tenancy, sessions, tokens, caching |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Collections, fields and limits |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Command-line scripts, backups, maintenance |
| [client/README.md](client/README.md) | The dashboard package: commands, layout, routes |

## Scripts

| Where | Command | Purpose |
| :--- | :--- | :--- |
| `server/` | `npm run dev` / `npm start` | Run the API with reload / without |
| `server/` | `npm test` | Server test suite (in-memory database) |
| `server/` | `npm run lint:security` | Static tenant-isolation check |
| `server/` | `npm run setup` | Create indexes and the first account |
| `client/` | `npm run dev` | Dashboard dev server |
| `client/` | `npm run build` | Production bundle in `client/dist` |
| `client/` | `npm run lint` | oxlint |

The remaining server scripts (seed, invites, superadmin, backups, maintenance) are described in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Security

- Never commit `server/.env` or `client/.env`. Both are git-ignored; only the `.env.example` templates are tracked.
- Passwords are stored as bcrypt hashes. Secret API tokens, email tokens and invite codes are stored only as hashes.
- Sessions live in an httpOnly cookie; writes need a custom header that cross-site requests cannot send.
- Every content query is scoped to its owner and a guard rejects any query that is not. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#tenant-isolation).
