# Admin Panel CMS

> **Headless Content Management System & Hierarchical Content API**  
> A standalone headless content management system for managing structured developer and professional information.

The system provides an authenticated administrative dashboard for creating, updating, deleting, and reordering content such as projects, skills, experience, education, certifications, social links, profile information, and resume metadata.

The CMS is intentionally decoupled from the public-facing presentation layer. External applications can consume the managed content through the read-only API contract or a dedicated read-only database connection.

---

## System Overview

```
                         THIS PROJECT
┌────────────────────────────────────────────────────────┐
│                    Admin Dashboard                     │
│                      (React/Vite)                      │
└───────────────────────────┬────────────────────────────┘
                            │ JWT Authenticated
                            │ CRUD Mutations
                            ▼
┌────────────────────────────────────────────────────────┐
│                    Express REST API                    │
│      Auth + Admin CRUD + Public Read-Only Endpoints    │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Read / Write (`cms_rw`)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  MongoDB Atlas Cluster                 │
│                     (`Portfolio_db`)                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ External Read Access
                            │ (REST GET or portfolio_ro)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Separate Portfolio Project               │
│                   (Future Consumer)                    │
└────────────────────────────────────────────────────────┘
```

> **Note on Architecture:** The public portfolio is not part of this repository. It is a separate application that consumes the CMS-managed data through one of two supported integration patterns:
> - **REST API Contract (Recommended):** The external client issues standard HTTP `GET` requests to the Express public endpoints (or the `/api/fs` hierarchical projection).
> - **Direct MongoDB Read Access:** The external client backend queries `Portfolio_db` directly using a strictly read-only database credential (`portfolio_ro`).

---

## Core Features

### Core CMS Capabilities
- **Profile Management:** Singleton document for bio, contact coordinates, hire availability toggle, system environment parameters, and key performance metrics.
- **Project Management:** Case study studio supporting solo vs. team architectures, live slug generator, tag selector, link references, and dual-pane live Markdown preview.
- **Skills Taxonomy:** Categorized competencies across 7 technical disciplines with proficiency levels, years of experience, and quick-tag batch insertion.
- **Experience Management:** Chronological career history with roles, company URL, achievements bullet list, and technology tags.
- **Education Management:** Academic credentials, degrees, dates, grades, and academic achievements.
- **Certification Management:** Industry certifications with credential IDs, verification URLs, and issuer metadata.
- **Social Link Management:** Ordered external links with icon identifiers, modal creation/editing, and featured spotlight toggles.
- **Resume Metadata Management:** Master PDF URL management, version tracking, and quick-download launcher.
- **Ordering & Reordering:** Atomic bulk write reordering endpoints for sequential domain collections.
- **App API Tokens:** Per-app publishable and secret API keys with two-token quotas, expiry, revocation, and dashboard management.
- **Versioned Public API:** Scoped `/v1/*` read endpoints with origin checks, rate limits, ETags, and in-memory TTL caching.
- **Markdown Editing & Preview:** Split/tabbed live Markdown rendering using `react-markdown` and `remark-gfm`.
- **Administrative Mutations:** Stateful write operations protected by JWT authentication and route middleware.

### API Capabilities
- **Public Read Endpoints:** Clean RESTful GET endpoints for public consumption by external frontends.
- **Protected Mutation Endpoints:** Bearer token authorization for all administrative write operations.
- **Structured Content Schemas:** Strict Mongoose schemas, unique indexes, and enum taxonomy validations.
- **Multiple Content Representations:** Standard REST JSON resources alongside an in-memory hierarchical filesystem projection (`/api/fs`).
- **Filtering & Categorization:** Query parameters for category segregation, solo/team modes, and spotlight highlights.

### Security & Reliability
- **bcrypt Password Hashing:** Salted hashing in Mongoose pre-save hooks; credentials never stored in plaintext.
- **JWT Authentication:** Stateless, cryptographically signed JSON Web Tokens for session verification.
- **Protected Admin Routes:** Express middleware guards enforcing valid session signatures.
- **CORS Restrictions:** Whitelisted origin validation for development and production domains.
- **Helmet Security Headers:** HTTP security headers hardening the server against common web exploits.
- **Authentication Rate Limiting:** IP-based throttling on login attempts to mitigate brute-force vectors.
- **Environment-Based Secrets:** Complete isolation of sensitive connection strings and secret keys from source control.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Node.js, Express.js 5, MongoDB Atlas, Mongoose 9, JWT, BcryptJS, Helmet, CORS |
| **Frontend** | React 19, Vite 8, TailwindCSS 3, Lucide React, Axios, React Router 7, React Markdown |
| **Theme** | Custom Terminal Dark (Pitch Black `#000000`, PowerShell Blue `#0078d4`, Console Green `#10b981`) |

---

## Repository Structure

```
AdminPanelManager/
├── .gitignore              # Multi-tier gitignore protecting all secrets and cache
├── README.md               # Repository documentation and architecture guide
├── DATABASE_REFERENCE.md   # Complete schema specification and API reference
├── docs/                   # Deep-dive documentation
│   ├── ARCHITECTURE.md     # Architecture patterns and filesystem generation
│   ├── API_REFERENCE.md    # Detailed endpoint payloads and status codes
│   └── SETUP_GUIDE.md      # Installation and Atlas deployment guide
├── client/                 # React 19 + Vite Admin CMS Dashboard
│   ├── .env.example        # Frontend environment template
│   ├── src/
│   │   ├── api/client.js   # Centralized Axios client with JWT interceptor
│   │   ├── context/        # AuthContext provider
│   │   ├── pages/admin/    # 8 CMS modules + Login + Dashboard + Shell Layout
│   │   └── App.jsx         # Client routing with ProtectedRoute wrappers
├── server/                 # Express.js REST API & Database Service
│   ├── .env.example        # Backend environment template
│   ├── config/db.js        # Mongoose connection with error handling
│   ├── controllers/        # Controllers for each content domain & auth
│   ├── middleware/         # Session auth, input sanitization & global error handler
│   ├── models/             # User and owner-scoped content schemas
│   ├── routes/             # Express routers mounted on /api/*
│   ├── scripts/            # Database initialization, seeding, and admin tools
│   └── server.js           # Server entry point & CORS configuration
└── cache/                  # (Ignored) Local archives, planning docs, and specs
```

---

## Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) v18.0.0 or later
- [MongoDB Atlas](https://www.mongodb.com/atlas) cluster connection string or local MongoDB instance

### 2. Backend Setup (`/server`)

```bash
cd server
npm install
```

Copy the environment template and configure your credentials:
```bash
cp .env.example .env
```

Edit `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/Portfolio_db?retryWrites=true&w=majority
JWT_SECRET=your_32_character_long_secret_key_here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_admin_password
CLIENT_ORIGIN=http://localhost:5173
```

Initialize database indexes and upsert the admin credentials:
```bash
npm run setup
```

*(Optional)* Seed initial data:
```bash
npm run seed
```

Start the backend server:
```bash
npm run dev
# Server running at http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### 3. Frontend Setup (`/client`)

Open a new terminal window:
```bash
cd client
npm install
```

Copy the environment template:
```bash
cp .env.example .env
```

Edit `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

Start the Vite development server:
```bash
npm run dev
# Client running at http://localhost:5173
```

Navigate to `http://localhost:5173/admin/login` and log in with your configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

---

## Available Scripts

### Server (`server/`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `nodemon server.js` | Starts API server with hot reloading |
| `npm start` | `node server.js` | Production server startup |
| `npm run setup` | `node scripts/setup-db.js` | Builds DB indexes & upserts admin account |
| `npm run setup:fresh -- --confirm <dbname>` | `node scripts/setup-db.js --fresh --confirm <dbname>` | Drops legacy/content collections, rebuilds indexes & configures the primary user |
| `npm run seed` | `node scripts/seed.js` | Populates database with structured initial content |
| `npm run admin` | `node scripts/set-admin.js` | Updates admin credentials from `.env` |
| `npm run resume` | `node scripts/update-resume.js` | Updates resume URL directly from command line |

### Client (`client/`)
| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts Vite dev server with fast HMR |
| `npm run build` | `vite build` | Compiles optimized production bundle into `dist/` |
| `npm run preview`| `vite preview` | Previews production build locally |

---

## API Summary

All endpoints are prefixed with `/api`. Public endpoints require no authentication. Protected mutation endpoints require header `Authorization: Bearer <token>`.

| Domain | Public Routes | Protected Admin Routes |
| :--- | :--- | :--- |
| **System** | `GET /health` | - |
| **Profile** | `GET /profile` | `PUT /profile`, `PATCH /profile/availability` |
| **Socials** | `GET /socials` | `POST /socials`, `PUT /socials/:id`, `DELETE /socials/:id`, `PATCH /socials/reorder` |
| **Skills** | `GET /skills`, `GET /skills/categories` | `POST /skills`, `PUT /skills/:id`, `DELETE /skills/:id` |
| **Projects** | `GET /projects`, `GET /projects/:id` | `POST /projects`, `PUT /projects/:id`, `DELETE /projects/:id`, `PATCH /projects/reorder` |
| **Experience** | `GET /experience`, `GET /experience/:id` | `POST /experience`, `PUT /experience/:id`, `DELETE /experience/:id` |
| **Education** | `GET /education`, `GET /education/:id` | `POST /education`, `PUT /education/:id`, `DELETE /education/:id` |
| **Certifications**| `GET /certifications`, `GET /certifications/:id` | `POST /certifications`, `PUT /certifications/:id`, `DELETE /certifications/:id` |
| **Resume** | `GET /resume`, `GET /resume/download` | `PUT /resume` |
| **Virtual FS** | `GET /fs` | - |
| **Versioned API** | `GET /v1/app`, `/v1/profile`, `/v1/resume`, `/v1/socials`, `/v1/skills`, `/v1/projects`, `/v1/experience`, `/v1/education`, `/v1/certifications`, `/v1/fs` | API-token authenticated, scoped read-only endpoints |
| **Auth** | `POST /auth/login` | `GET /auth/verify` |

For full endpoint definitions and schema payloads, see [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) and [docs/API_REFERENCE.md](./docs/API_REFERENCE.md).

---

## Documentation

- [DATABASE_REFERENCE.md](./DATABASE_REFERENCE.md) - Comprehensive technical reference manual.
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Architectural deep-dive & Virtual Filesystem mechanics.
- [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) - Comprehensive API endpoint reference with JSON payloads.
- [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) - Step-by-step developer deployment and configuration guide.

---

## Security & Secrets Policy

This repository adheres to strict sanitization and security protocols:
- Never commit `.env` or `atlas-credentials.env` files to git.
- Passwords are hashed with `bcrypt` (10 rounds) before persistence.
- JWT tokens expire in 7 days and must be signed with a cryptographically secure 256-bit secret.
- All internal development specifications, planning roadmaps, and scratch archives are isolated in `cache/` and excluded via `.gitignore`.

### Tenant isolation

Each dashboard account owns its profile, resume, and content records. Dashboard writes and authenticated reads use the verified session owner; anonymous legacy portfolio reads are limited to published content for the configured `ADMIN_EMAIL` account. Do not deploy this tenancy migration by itself: the coordinated public API cutover is planned for Phase 4.
