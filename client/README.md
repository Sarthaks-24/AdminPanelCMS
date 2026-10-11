# Dashboard and public site (`client/`)

The React single-page app behind the service's public site, its docs, and the dashboard where an account manages content, Apps and keys. It talks to the dashboard API in `server/`.

## Run

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173
```

The API must be running, and the dashboard must be opened at the exact origin set in the server's `DEV_CLIENT_ORIGIN`.

## Configuration

`client/.env`:

| Variable | Meaning |
| :--- | :--- |
| `VITE_MODE` | `dev` or `prod`. Selects which URL below is used. |
| `VITE_DEV_API_URL` | Dashboard API base URL in development. Default `http://localhost:5000/api`. |
| `VITE_PROD_API_URL` | Dashboard API base URL in production: a full `https://.../api` URL, or `/api` when served from the same origin. |

Values are compiled into the bundle, so rebuild after changing them, and never put secrets here. The public `/v1` base URL that the site shows to users is **not** configured here: the server returns it from `GET /api/auth/config` (`PUBLIC_API_URL`), and `src/lib/apiBase.js` falls back to the dashboard URL with `/api` swapped for `/v1`. Details: [../docs/ENVIRONMENT.md](../docs/ENVIRONMENT.md).

## Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production bundle in `dist/`. Use `VITE_MODE=prod`; the build warns if it would call a development API. |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | oxlint, then `scripts/check-field-parity.mjs`, which fails if the landing demo's field lists or sample values drift from `server/lib/modelConstants.js` and the models |

## Layout

```
src/
  main.jsx, App.jsx        entry and routes (dashboard and auth pages are lazy; a route error boundary wraps them)
  api/client.js            Axios instance: credentials, CSRF header, 401 handling (base URL comes from vite.config.js)
  lib/apiBase.js           the public API origin and /v1 base (from the server, `…` until it answers)
  content/site.js          product name, domain, support email and every legal fact (SITE.legal): the single source for public copy
  content/docs.js          the consumer docs the site publishes, imported one by one (never a glob)
  content/docLinks.js      the public-doc list and link rewriting, shared with scripts/check-docs.mjs
  content/scopeDemo.js     the landing demo's sample pool and a mirror of the server's scoping rules
  context/AuthContext.jsx  session state
  context/ThemeContext.jsx colour themes via CSS variables; 4 are offered in the picker, the rest are kept for existing accounts
  pages/public/            landing, docs index, doc page
  pages/auth/              signup, email verification, password reset, legal pages
  pages/admin/             dashboard screens (content managers, Apps, account, superadmin)
  components/public/       public shell, landing demo, markdown renderer
  components/admin/        route guard, toasts, loading/empty states, connect panel, dialogs
  index.css                theme tokens and shared component classes
scripts/
  check-field-parity.mjs   lint step: landing demo vs server constants
  check-docs.mjs           lint step: public-doc links resolve, no /v1/v1, no HTML comments
  check-dist.mjs           after build: _headers + CSP hash, _redirects, no operator docs in dist
  check-launch.mjs         `npm run check:launch`: no owner placeholders left (not part of lint)
public/
  og.png, og.svg           the 1200x630 social card (PNG for unfurlers; the SVG is its source)
  favicon.svg              the wordmark
  _headers                 CSP and security headers (Netlify / Cloudflare Pages)
  _redirects               404 for /v1 and /api, then the SPA fallback
  404.html                 the page those 404s serve
  .well-known/security.txt security contact
```

The docs pages inline `docs/QUICKSTART.md`, `API_REFERENCE.md`, `LIMITS_AND_ERRORS.md`, `CONTENT_FIELDS.md` and `CHANGELOG.md` from the repository root at build time. At render time `{{API_BASE}}` becomes the public API origin (bare, no path; every documented path starts with `/v1`) and `{{SUPPORT_EMAIL}}` becomes `SITE.support.email`.

## Routes

| Path | Screen |
| :--- | :--- |
| `/`, `/docs`, `/docs/:slug` | Public site and docs |
| `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/check-email` | Authentication |
| `/legal/terms`, `/legal/privacy` | Terms and privacy policy |
| `/dashboard` | Overview and the first-request checklist |
| `/dashboard/profile`, `/dashboard/resume`, `/dashboard/socials` | Singletons and links |
| `/dashboard/projects`, `/dashboard/projects/new`, `/dashboard/projects/edit/:id` | Projects |
| `/dashboard/skills`, `/dashboard/experience`, `/dashboard/education`, `/dashboard/certifications` | Collections |
| `/dashboard/apps`, `/dashboard/apps/:id` | Apps, their keys and the Connect panel |
| `/dashboard/account` | Password, export, delete account |
| `/dashboard/superadmin` | Platform settings, users and invites (superadmin only) |
| `/admin`, `/admin/*` | Old links: redirect to the routes above, keeping query and hash |

When deploying, the static host must serve `index.html` for all of these paths (`public/_redirects` does this on Netlify-style hosts).
