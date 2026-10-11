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

`client/.env`, or the same variables in the static host's build settings. [.env.example](.env.example) documents each one.

| Variable | Meaning |
| :--- | :--- |
| `VITE_MODE` | `dev` or `prod`, the one switch. Unset: `vite build` means prod, the dev server dev. Any other value fails. |
| `VITE_DEV_API_URL` | API origin in development (`/api` optional). Default `http://localhost:5000`. |
| `VITE_PROD_API_URL` | API origin in production, e.g. `https://api.example.com` (`/api` optional). Required, https, not localhost. |
| `VITE_SITE_DOMAIN`, `VITE_SITE_OPERATOR`, `VITE_SITE_JURISDICTION` | Public host (no scheme), operator legal name, governing law. Required in a prod build. |
| `VITE_SITE_NAME`, `VITE_SITE_SUPPORT_EMAIL`, `VITE_SITE_HOSTING_PROVIDER`, `VITE_SITE_BACKUP_PROVIDER`, `VITE_SITE_LOG_PROVIDER`, `VITE_SITE_STATUS_URL` | Optional identity; `check:launch` reports the unset providers. |

`vite.config.js` validates all of them (`config/buildEnv.js`): a prod build with a missing or invalid value fails with a message naming the variable. Values are compiled into the bundle, so rebuild after changing them, and never put secrets here. The public `/v1` base URL that the site shows to users is **not** configured here: the server returns it from `GET /api/auth/config` (`PUBLIC_API_URL`), and `src/lib/apiBase.js` falls back to the origin of the compiled dashboard API URL. Details: [../docs/ENVIRONMENT.md](../docs/ENVIRONMENT.md).

## Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production bundle in `dist/`, then `scripts/check-dist.mjs`. Use `VITE_MODE=prod` with the inputs above. |
| `npm test` | Component and unit tests (vitest, jsdom) |
| `npm run check:launch` | Fails while any identity input is unset, a placeholder or an example value |
| `npm run smoke -- <dashboardUrl> <apiUrl>` | Checks a deployed pair: CSP connect-src, CORS credentials, SPA deep links, same site, `/v1` 401 |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | oxlint, then `scripts/check-field-parity.mjs`, which fails if the landing demo's field lists or sample values drift from `server/lib/modelConstants.js` and the models |

## Layout

```
src/
  main.jsx, App.jsx        entry and routes (dashboard and auth pages are lazy; a route error boundary wraps them)
  api/client.js            Axios instance: credentials, CSRF header, 401 handling (base URL comes from vite.config.js)
  lib/apiBase.js           the public API origin and /v1 base (from the server, `…` until it answers)
  content/site.js          product name, domain, support email and every legal fact (SITE.legal), read from the VITE_SITE_* inputs
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
config/
  buildEnv.js              VITE_MODE, API URL and VITE_SITE_* validation (vite.config.js and the scripts share it)
  csp.js                   the one Content-Security-Policy (header and <meta> forms)
  deployFiles.js           Vite plugins: index.html tokens, CSP <meta>, dist/_headers, dist/.well-known/security.txt
scripts/
  check-field-parity.mjs   lint step: landing demo vs server constants
  check-docs.mjs           lint step: public-doc links resolve, no /v1/v1, no HTML comments
  check-dist.mjs           after build: no template token left, CSP (_headers and <meta>) has the API origin and script hash, SPA fallback, security.txt, no operator docs
  check-launch.mjs         `npm run check:launch`: no placeholder or example identity left (not part of lint)
  smoke-deploy.mjs         `npm run smoke`: checks a deployed dashboard + API pair
public/
  og.png, og.svg           the 1200x630 social card (PNG for unfurlers; the SVG is its source)
  favicon.svg              the wordmark
  _headers                 security headers template (Netlify / Cloudflare Pages); the build fills in the CSP
  _redirects               the SPA fallback (no 404.html: it disables SPA mode on Cloudflare Pages)
  .well-known/security.txt security contact template; the build fills in the domain and Expires
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
