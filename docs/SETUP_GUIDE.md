# Local setup

Get the API and the dashboard running on your machine. For production, see [DEPLOYMENT.md](DEPLOYMENT.md).

## Prerequisites

- Node.js 20.19 or newer (required by Vite 8), with npm
- A MongoDB database you can write to: a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or a local MongoDB 6+
- Optional: a [Resend](https://resend.com) API key if you want real verification and reset emails locally

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
DEV_ADMIN_PASSWORD=<a password of 10+ characters>

ADMIN_NAME=Your Name
ADMIN_EMAIL=you@example.com
```

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server refuses to start if `DEV_JWT_SECRET` is still the example value. You can leave the whole `PROD_*` block empty for now. Every variable is described in [ENVIRONMENT.md](ENVIRONMENT.md).

Create the indexes and your account:

```bash
npm run setup
```

This creates (or resets the password of) a verified account for `ADMIN_EMAIL`. To see the Superadmin panel, promote it:

```bash
npm run superadmin:grant -- --email you@example.com --confirm-db Portfolio_dev
```

Optionally load sample content. This **deletes that account's existing content** first and publishes everything it inserts:

```bash
npm run seed
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

Check it: <http://localhost:5000/api/health>.

## 3. Dashboard (`client/`)

In a second terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

The defaults in `client/.env` (`VITE_MODE=dev`, `VITE_DEV_API_URL=http://localhost:5000/api`) match the API above.

Open <http://localhost:5173/admin/login> and sign in with `ADMIN_EMAIL` and `DEV_ADMIN_PASSWORD`.

The dashboard must be opened at exactly the origin in `DEV_CLIENT_ORIGIN`. If Vite picks another port, or you use `127.0.0.1` instead of `localhost`, sign-in fails with a CORS error; change one to match the other.

## 4. Make your first API call

1. In the dashboard, add some content and set it to **Published**. Drafts are never served.
2. Go to **Apps** (labelled "Connected websites" in the sidebar), create an app of type *Static website*, open it, and enable the sections you want to expose.
3. Open the app's tokens and create one. A static app gets a publishable `pk_live_...` token.
4. Call the public API:

```bash
curl -H "Authorization: Bearer pk_live_your_token" http://localhost:5000/v1/app
curl -H "Authorization: Bearer pk_live_your_token" http://localhost:5000/v1/projects
```

The full endpoint list is in [API_REFERENCE.md](API_REFERENCE.md).

## 5. Tests and checks

```bash
cd server
npm test                # 146 tests; uses an in-memory MongoDB, never your real database
npm run lint:security   # static check that every content query is owner-scoped

cd ../client
npm run lint
npm run build
```

The first `npm test` downloads a MongoDB binary for the in-memory server.

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| `MODE is not set` | `server/.env` is missing or has no `MODE` line. |
| `MODE=dev conflicts with NODE_ENV=production` | Remove `NODE_ENV` from `server/.env` or your shell; `MODE` sets it. |
| `Invalid configuration: JWT_SECRET ...` | The secret is missing, under 32 characters, or still the example. |
| Sign-in request blocked by CORS | The browser address does not match `DEV_CLIENT_ORIGIN` exactly. |
| Signed in, but every save returns `email_unverified` | The account was created through the signup page and has not followed its verification link. `npm run setup` creates a verified account. |
| `/v1/...` returns `403 section_disabled` | That section is not enabled in the app's settings. |
| `/v1/...` returns an empty list | The items exist but are still drafts. |
| `querySrv ENOTFOUND` on connect | Your network blocks SRV lookups. The server retries through DNS-over-HTTPS automatically (this needs outbound HTTPS). Multi-host standard connection strings are not supported by the scripts. |
