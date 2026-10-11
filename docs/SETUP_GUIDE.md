# Local setup

Get the API and the dashboard running on your machine for development. The product itself is a hosted service with one deployment; for that, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Node.js 22 or newer, with npm (both packages declare `node >=22`; `client/.node-version` pins 22)
- A MongoDB database you can write to: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or a local MongoDB 6+
- Optional: a [Resend](https://resend.com) API key if you want real emails locally. Without one, every email is printed in the API's log instead

## 1. Database

**Atlas:** create a database user with read/write access, allow your IP under Network Access, and copy the Node.js connection string. Add a database name to the path:

```
mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/Portfolio_dev?retryWrites=true&w=majority
```

**Local MongoDB:** `mongodb://127.0.0.1:27017/Portfolio_dev`

Use a development database here. Keep production data in a separate database with separate credentials.

## 2. API (`server/`)

```bash
cd server
npm install
cp .env.example .env
```

Open `server/.env`. Leave `MODE=dev` and fill in the development block and the account details:

```env
MODE=dev

DEV_MONGODB_URI=<your connection string, with a database name>
DEV_JWT_SECRET=<output of the command below>
DEV_CLIENT_ORIGIN=http://localhost:5173
DEV_PUBLIC_API_URL=http://localhost:5000
DEV_ADMIN_PASSWORD=<a password of 10+ characters>

ADMIN_NAME=Your Name
ADMIN_EMAIL=you@example.com
```

`DEV_PUBLIC_API_URL` is optional in dev; it is what the dashboard shows as the base of every `/v1` URL.

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server refuses to start if `DEV_JWT_SECRET` is still the example value. You can leave the whole `PROD_*` block empty for now. Every variable is described in [ENVIRONMENT.md](ENVIRONMENT.md).

Create the indexes and your account:

```bash
npm run setup
```

This creates (or resets the password of) a **verified** account for `ADMIN_EMAIL`. To see the Superadmin panel, promote it:

```bash
npm run superadmin:grant -- --email you@example.com --confirm-db Portfolio_dev
```

Optionally load sample content. This **deletes that account's existing content** first and publishes everything it inserts, and refuses to run with `MODE=prod`:

```bash
npm run seed -- --confirm-db Portfolio_dev
```

Start the API:

```bash
npm run dev
```

Among the startup output you should see:

```
[Env] MODE=dev · database Portfolio_dev
[MongoDB] Connected: ...
[Server] Running on port 5000 in dev mode
```

Check it: <http://localhost:5000/livez> (process up) and <http://localhost:5000/readyz> (database reachable). `/api/health` is an alias of `/livez`.

With the placeholder `DEV_RESEND_MAIL_KEY`, the server also warns `Mail goes to the console`: `DEV_MAIL_TRANSPORT=console` (the default without a real key) prints every email, with its links, to this terminal instead of sending it.

## 3. Dashboard (`client/`)

In a second terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The defaults in `client/.env` (`VITE_MODE=dev`, `VITE_DEV_API_URL=http://localhost:5000`) match the API above. The `VITE_SITE_*` identity values can stay blank in dev; the public pages then show bracketed placeholders. A prod build (`VITE_MODE=prod`) needs them, see [ENVIRONMENT.md](ENVIRONMENT.md#frontend).

Open <http://localhost:5173/login> and sign in with `ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD`.

The dashboard must be opened at exactly the origin in `DEV_CLIENT_ORIGIN`. If Vite picks another port, or you use `127.0.0.1` instead of `localhost`, sign-in fails with a CORS error; change one to match the other.

### Walking the signup locally

Signup is email-first: you enter only an email, and choose the password from the verification link. With `DEV_MAIL_TRANSPORT=console` you can walk it without a mail provider:

1. Set `DEV_SIGNUP_MODE=open` (or `invite`, with a code from `npm run invite -- --count 1`) and restart the API.
2. Open <http://localhost:5173/signup> and enter any address.
3. In the API terminal, find the `[Mail:console] Not sent (MAIL_TRANSPORT=console)` block and open the verification link it prints.
4. Choose the password on the verify page, then sign in.

"Forgot password" works the same way: the reset link appears in the log. An account that never verifies is purged after 48 hours.

## 4. Make your first API call

1. In the dashboard, save your **Profile** once (that marks it configured; until then `/v1/profile` answers `404 not_configured`), then add a project and **publish** it. Drafts are never served; "Save and publish" on a form publishes in one step.
2. Go to **Apps**, create an App. Pick "Build or server (recommended)" for a secret `sk_` key, or "Visitors' browsers" for a publishable `pk_` key with an origin allowlist. Use the "Everything published" preset or enable the sections you want to expose.
3. Open the App's **Keys** and create one. A secret key is shown once; copy it.
4. The App's **Connect** panel shows the base URL (from `PUBLIC_API_URL`, here `http://localhost:5000`) and a ready-made snippet. Its **Check** button calls `POST /api/apps/:id/check` and lists anything that would make a `/v1` call come back empty (no key, no enabled section, all drafts).
5. Call the public API:

```bash
curl -H "Authorization: Bearer sk_live_your_key" http://localhost:5000/v1/app
curl -H "Authorization: Bearer sk_live_your_key" http://localhost:5000/v1/projects
```

Every success is wrapped in a `data` envelope:

```json
{ "data": { "name": "my-site", "type": "protected", "enabledSections": ["profile", "projects"] } }
```

```json
{ "data": [ { "_id": "…", "title": "First project", "slug": "first-project", "stack": ["node"] } ] }
```

and every error has the same shape: `{ "error": "section_disabled", "message": "…", "requestId": "…" }`. A `pk_` key sent from `curl` with no `Origin` header works too; from a browser the page's origin must be on the App's allowlist.

The full endpoint list is in [API_REFERENCE.md](API_REFERENCE.md).

## 5. Tests and checks

```bash
cd server
npm test                # the whole suite; uses an in-memory MongoDB, never your real database
npm run lint:security   # static check that every content query is owner-scoped

cd ../client
npm run lint            # oxlint, field parity, public-docs check
npm test
npm run build           # needs VITE_MODE=prod values; a dev .env builds against localhost with a warning
```

The first `npm test` downloads a MongoDB binary for the in-memory server.

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| `MODE is not set` | `server/.env` is missing or has no `MODE` line. |
| `MODE=dev conflicts with NODE_ENV=production` | Remove `NODE_ENV` from `server/.env` or your shell; `MODE` sets it. |
| `Invalid configuration: JWT_SECRET ...` | The secret is missing, under 32 characters, or still the example. |
| Sign-in request blocked by CORS | The browser address does not match `DEV_CLIENT_ORIGIN` exactly. |
| Login says `Invalid credentials or unverified email` for an account you just created on the signup page | Signup is email-first: the password is set from the verification link. Open the link printed in the API log (`[Mail:console]`), or use `npm run setup`, which creates a verified account with `DEV_ADMIN_PASSWORD`. |
| No `[Mail:console]` block in the log | `DEV_MAIL_TRANSPORT=resend`, or a real `DEV_RESEND_MAIL_KEY` with `DEV_MAIL_TRANSPORT` blank: mail is being sent through Resend. |
| `vite build` fails with `VITE_MODE="…" is not a mode` or `… is not set` | `VITE_MODE` must be `dev` or `prod`; a prod build also needs `VITE_PROD_API_URL` and the required `VITE_SITE_*` values. |
| `/v1/profile` returns `404 not_configured` | The profile has never been saved. Save it once in the dashboard. |
| `/v1/...` returns `403 section_disabled` | That section is not enabled in the App's settings. |
| `/v1/...` returns `{ "data": [] }` | The items exist but are still drafts, or the App's mode is `selected` with no ids. The App's Check button says which. |
| `/v1/...` returns `401 token_invalid` for a key you just created | The key was revoked, or the server was restarted and the request arrived before the active-key set reloaded. Create a fresh key if it persists. |
| `querySrv ENOTFOUND` on connect | Your network blocks SRV lookups. The server retries through DNS-over-HTTPS automatically (this needs outbound HTTPS). Multi-host standard connection strings are not supported by the scripts. |
