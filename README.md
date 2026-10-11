# Portfolio Control

Your portfolio content, as an API. Write your profile, projects, skills, experience, education, certifications and social links once; every site you build reads them from one read-only JSON API, and each site sees only what you grant it.

Portfolio Control is a hosted service at https://[your-domain]. **Want to use it? [Sign up there](https://[your-domain]/signup); you don't need this repository.** This repository is the service's source code, published under the [MIT License](LICENSE).

## For users of the service

Create an account on the public site, add your content, create an **App** per site you build, and fetch with its key:

```bash
curl -H "Authorization: Bearer $CONTENT_API_KEY" https://api.[your-domain]/v1/projects
```

The docs you need are rendered on the site and live here in `docs/`:

| Document | Contents |
| :--- | :--- |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | Sign up → content → an App → a secret key → a fetch at build time |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Every `/v1` endpoint, the `{ data }` envelope, every error code and header |
| [docs/LIMITS_AND_ERRORS.md](docs/LIMITS_AND_ERRORS.md) | The beta limits and the error decoder |
| [docs/CONTENT_FIELDS.md](docs/CONTENT_FIELDS.md) | What each section can serve, defaults, opt-in and never-served fields |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Changes to the API, the limits and the legal text |

## How it works

- **One content pool per account.** A dashboard for the eight content sections. Items are published as you save, or kept as drafts that no App can see.
- **Apps are views, not copies.** An App chooses which sections, which items and which fields one site may read. Your portfolio can get everything; a résumé page can get three featured projects and no email address.
- **Keys per App.** A secret key (`sk_live_`) for builds and servers, or a publishable key (`pk_live_`) for browsers, limited to the origins you allow. Read-only, revocable, at most two live per App.
- **One API.** `GET /v1/...` returns the granted content as JSON with ETags and a 60-second cache; `GET /v1/fs` returns the same content as a virtual file tree for terminal-style sites.
- **Your data stays yours.** Export everything as JSON or delete the account from **Account** in the dashboard; deletion revokes every key.

## What's in the repository

| Part | Technology |
| :--- | :--- |
| API (`server/`) | Node.js 22+, Express 5, Mongoose 9, MongoDB, JWT sessions in httpOnly cookies, bcrypt, Helmet, express-rate-limit, Resend, pino |
| Dashboard and public site (`client/`) | React 19, Vite 8, Tailwind CSS 3, React Router 7, Axios |
| Tests | Vitest, Supertest, mongodb-memory-server (server); oxlint and a demo/field parity check (client) |

Two deployables: the API (one long-running Node process serving `/api` for the dashboard and `/v1` for consumers) and the static dashboard bundle.

## Contributing: running it locally

You need Node.js 22+ and a MongoDB database; no mail provider (without a Resend key, every email and its links are printed in the API's log, so the signup can be walked locally). The walkthrough is [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md); in short:

```bash
# API
cd server && npm install && cp .env.example .env   # fill in the DEV_* block
npm run setup && npm run dev                       # http://localhost:5000

# Dashboard (second terminal)
cd client && npm install && cp .env.example .env
npm run dev                                        # http://localhost:5173
```

Deploying the service: the step-by-step guide is [DEPLOYMENT.md](DEPLOYMENT.md) (Render, Railway, or one VPS with Docker and Caddy). Operator reference (environment variables, deployment, operations, architecture, data model) is in `docs/` and is not published on the site: [ENVIRONMENT.md](docs/ENVIRONMENT.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md), [OPERATIONS.md](docs/OPERATIONS.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), [DATA_MODEL.md](docs/DATA_MODEL.md).

## Scripts

| Where | Command | Purpose |
| :--- | :--- | :--- |
| `server/` | `npm run dev` / `npm start` | Run the API with reload / without |
| `server/` | `npm test` | Server test suite (in-memory database) |
| `server/` | `npm run lint:security` | Static tenant-isolation check |
| `server/` | `npm run setup` | Create indexes and the first account |
| `client/` | `npm run dev` | Dashboard dev server |
| `client/` | `npm run build` | Production bundle in `client/dist` with the generated `_headers`, CSP `<meta>` and `security.txt`; fails on an invalid `VITE_*` input, then checks the CSP, the SPA fallback (no `404.html`) and that no operator docs were bundled |
| `client/` | `npm run lint` | oxlint, the landing-demo field parity check, and the public-docs check (links, base-URL paths, no HTML comments) |
| `client/` | `npm run check:launch` | Fails while any `VITE_SITE_*` identity value (domain, operator, jurisdiction, providers) is unset or an example, or an owner placeholder is left in the public files; run before launch |
| `client/` | `npm run smoke -- <dashboardUrl> <apiUrl>` | Checks a deployed pair: CSP allows the API, CORS, SPA deep links, same site, `/v1` answers 401 without a key |

## Security

- Never commit `server/.env` or `client/.env`. Both are git-ignored; only the `.env.example` templates are tracked.
- Passwords are stored as bcrypt hashes. Secret keys, email tokens and invite codes are stored only as hashes.
- Sessions live in an httpOnly cookie; writes need a custom header that cross-site requests cannot send.
- Every content query is scoped to its owner and a guard rejects any query that is not. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#tenant-isolation).

To report a security issue in the service, email security@[your-domain]. Please don't open a public issue for it. The full policy is in [SECURITY.md](SECURITY.md).
