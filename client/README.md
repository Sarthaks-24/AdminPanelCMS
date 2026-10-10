# Dashboard (`client/`)

The React single-page app for managing content, Apps and API tokens. It talks to the dashboard API in `server/`.

## Run

```bash
npm install
cp .env.example .env
npm run dev          # http://localhost:5173/admin/login
```

The API must be running, and the dashboard must be opened at the exact origin set in the server's `DEV_CLIENT_ORIGIN`.

## Configuration

`client/.env`:

| Variable | Meaning |
| :--- | :--- |
| `VITE_MODE` | `dev` or `prod`. Selects which URL below is used. |
| `VITE_DEV_API_URL` | Dashboard API base URL in development. Default `http://localhost:5000/api`. |
| `VITE_PROD_API_URL` | Dashboard API base URL in production: a full `https://.../api` URL, or `/api` when served from the same origin. |

Values are compiled into the bundle, so rebuild after changing them, and never put secrets here. Details: [../docs/ENVIRONMENT.md](../docs/ENVIRONMENT.md).

## Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production bundle in `dist/`. Use `VITE_MODE=prod`; the build warns if it would call a development API. |
| `npm run preview` | Serve the built bundle locally |
| `npm run lint` | oxlint |

## Layout

```
src/
  main.jsx, App.jsx        entry and routes
  api/client.js            Axios instance: credentials, CSRF header, 401 handling (base URL comes from vite.config.js)
  context/AuthContext.jsx  session state
  context/ThemeContext.jsx 20 colour themes via CSS variables
  pages/admin/             dashboard screens (content managers, Apps, account, superadmin)
  pages/auth/              signup, email verification, password reset
  components/admin/        route guard, toasts, loading/empty states, visibility toggle
  index.css                theme tokens and shared component classes
```

## Routes

| Path | Screen |
| :--- | :--- |
| `/admin/login`, `/admin/signup`, `/admin/forgot-password`, `/admin/reset-password`, `/admin/verify-email`, `/admin/check-email` | Authentication |
| `/admin/dashboard` | Overview |
| `/admin/profile`, `/admin/resume`, `/admin/socials` | Singletons and links |
| `/admin/projects`, `/admin/projects/new`, `/admin/projects/edit/:id` | Projects |
| `/admin/skills`, `/admin/experience`, `/admin/education`, `/admin/certifications` | Collections |
| `/admin/apps`, `/admin/apps/:id` | Apps and their tokens |
| `/admin/account` | Password, export, delete account |
| `/admin/superadmin` | Platform settings and invites (superadmin only) |
| `/legal/terms`, `/legal/privacy` | Placeholder policy pages |

When deploying, the static host must serve `index.html` for all of these paths.
