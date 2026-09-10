# System Architecture & Technical Design

This document details the architectural principles, data flow models, security boundaries, and engineering decisions implemented across the **Admin Panel CMS** and its supporting backend services.

---

## 1. High-Level Topology

The system functions as a standalone, authoritative upstream content management platform for personal and professional developer data. It is intentionally decoupled from any public presentation layer:

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

> **Decoupled Architecture Notice:** The public portfolio is not part of this repository. It is a separate application that consumes the CMS-managed data through one of two supported integration patterns:
> - **REST API Contract (Recommended):** The external client issues standard HTTP `GET` requests to the Express public endpoints (or the `/api/fs` hierarchical projection).
> - **Direct MongoDB Read Access:** The external client backend queries `Portfolio_db` directly using a strictly read-only database credential (`portfolio_ro`).

---

## 2. Core Data Modeling Patterns

The data layer in `server/models/` uses three design patterns optimized for a single administrator managing structured professional content:

### 2.1. Singleton Pattern (`Profile`, `Resume`)
Certain domains represent unique, singular entities:
- **`Profile` (`server/models/Profile.js`):** Exactly one document exists in the `profiles` collection. If no document exists, the system automatically instantiates a default document via `Profile.findOneAndUpdate({}, payload, { upsert: true, new: true })`.
- **`Resume` (`server/models/Resume.js`):** Exactly one master resume entry exists with direct URL, filename, and version string. It provides a backward-compatible virtual field `driveUrl` that maps transparently to `resumeUrl`.

### 2.2. Sequenced / Ordered Collection Pattern (`Social`, `Project`, `Experience`, `Education`)
Collections that display chronologically or by personal preference maintain an integer `order` field:
- When a document is created without an `order`, the controller automatically sets its order to the current maximum order + 1.
- Both `Social` and `Project` feature atomic batch reordering endpoints:
  - `PATCH /api/socials/reorder`
  - `PATCH /api/projects/reorder`
- The payload `{ items: [{ id: "...", order: 0 }, { id: "...", order: 1 }] }` executes bulk writes in MongoDB to update sort keys atomically.

### 2.3. Categorized Taxonomy Pattern (`Skill`)
The `Skill` collection groups technical competencies under a strict enum of 7 industry categories:
1. `Languages`
2. `Frontend`
3. `Backend & Systems`
4. `Databases & Caching`
5. `DevOps & Cloud`
6. `Hardware & Electronics`
7. `Tools & Frameworks`

- Each skill enforces a case-insensitive `unique` index on `name`.
- An aggregated query endpoint (`GET /api/skills/categories`) uses MongoDB's aggregation pipeline (`$group`) to return skills pre-grouped by category in a single round-trip.

---

## 3. Multiple Content Representations (`/api/fs`)

The CMS engine is architected to expose multiple representations of the same underlying content models:

```
                MongoDB Documents
                        ↓
                     CMS API
                        ↓
         ┌──────────────┴──────────────┐
         │                             │
   REST Resources                    /api/fs
(Standard JSON Endpoints)  (In-Memory Filesystem Tree)
         │                             │
         ▼                             ▼
   External Apps             File-Oriented Consumers
```

- **REST Resources:** Standard granular REST endpoints (`/api/projects`, `/api/skills`, etc.) for conventional web frontends.
- **Hierarchical Filesystem Tree (`/api/fs`):** An optional downstream projection that dynamically traverses all MongoDB collections to construct an in-memory Unix-style filesystem tree (`/`, `/about`, `/skills`, `/projects`, `/experience`, `/education`, `/certifications`, `/resume.pdf`). This provides file-oriented consumers, tree navigators, and static site generators with the complete content hierarchy in a single network round-trip.

### 3.1. Directory Structure Mapping

```
/
├── about/
│   ├── bio.txt             # Derived from Profile.shortBio & statusText
│   ├── background.md       # Derived from Profile.aboutMarkdown
│   ├── contact.json        # Derived from Profile.email, phone, location
│   └── telemetry.json      # Derived from Profile.metrics & environment settings
├── skills/
│   ├── languages.json      # Categorized skills filtered by category
│   ├── frontend.json
│   ├── backend-systems.json
│   ├── databases-caching.json
│   ├── devops-cloud.json
│   ├── hardware-electronics.json
│   └── tools-frameworks.json
├── projects/
│   ├── [project-slug].md   # Markdown case study + metadata headers
│   └── index.json          # Summary index of all active projects
├── experience/
│   └── [order]-[company].txt # Formatted milestone, role, and achievements
├── education/
│   └── [institution].txt   # Academic degree, dates, and achievements
├── certifications/
│   └── [cert-slug].txt     # Issuer, date, credential ID, and URL
└── resume.pdf              # File node linking to the master resume URL
```

### 3.2. Traversal Algorithm
In `server/controllers/fsController.js`, `Promise.all` executes concurrent database reads across all active collections. It then builds a recursive JSON tree where every node conforms to:
```typescript
interface FSNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  mimeType?: string;
  content?: string | object;
  targetUrl?: string;
  children?: FSNode[];
}
```

---

## 4. Database Access Isolation

The system enforces least-privilege credential separation across the persistence tier:

```
      CMS Backend                   Downstream Portfolio Backend
     (This Project)                      (External Project)
           │                                      │
           ▼                                      ▼
     User: `cms_rw`                       User: `portfolio_ro`
  Role: Read / Write                     Role: Read-Only (db.read)
           │                                      │
           └──────────────────┬───────────────────┘
                              ▼
                    MongoDB Atlas Cluster
                       (`Portfolio_db`)
```

1. **`cms_rw` (Read/Write):** Scoped exclusively to the CMS backend server (`server/`). Authorized to execute admin CRUD operations, index creation, and token-validated state modifications.
2. **`portfolio_ro` (Read-Only):** Scoped for external presentation consumers that connect directly to MongoDB. Restricted strictly to read queries, preventing any possibility of unauthorized write operations from downstream code.
3. **Zero Browser Exposure:** Neither database credential ever reaches the client browser or frontend bundle. All client dashboard interactions are conducted over authenticated Express HTTP routes.

---

## 5. Shared Boundary: Data Model & API Contract

The architecture treats the **Data Model & API Contract** as the primary integration boundary between the CMS and downstream consumers, while direct read-only database access (`portfolio_ro`) serves as an alternative high-efficiency data path:

```
              CMS PROJECT
                   │
                   ▼
            ┌─────────────┐
            │ Data Model  │
            │ + API       │
            └──────┬──────┘
                   │
             Shared Contract
             (REST / JSON)
                   │
                   ▼
          PORTFOLIO PROJECT
         (External Consumer)
```

By decoupling the consumer layer behind an explicit schema and API contract:
- The CMS implementation can be refactored, upgraded, or migrated (e.g. from Express to Next.js or MongoDB to PostgreSQL) without requiring changes in the consuming client application.
- The downstream consumer relies solely on documented endpoint contracts, schemas, and payload shapes.

---

## 6. Authentication & Security Model

```
┌─────────────────┐       POST /api/auth/login       ┌─────────────────┐
│                 ├─────────────────────────────────►│                 │
│  Admin Client   │  Payload: { email, password }    │  Express Server │
│                 │◄─────────────────────────────────┤                 │
│                 │  Response: { token, admin }      └────────▲────────┘
└────────┬────────┘                                           │
         │ Save token in localStorage                         │
         ▼                                                    │
┌─────────────────┐   GET /api/projects (with Bearer)         │
│ Axios Instance  ├───────────────────────────────────────────┘
│ Interceptor     │ Header: "Authorization: Bearer <token>"
└─────────────────┘
```

1. **Password Hashing:** Passwords are never stored in plaintext. `server/models/Admin.js` implements a Mongoose `pre('save')` hook that applies `bcrypt.hash(password, 10)` before storage.
2. **Session Verification:** `server/middleware/requireAdmin.js` validates the signature of incoming Bearer tokens using `jwt.verify(token, process.env.JWT_SECRET)`.
3. **Automated Session Hydration:** On initial load, `client/src/context/AuthContext.jsx` issues a `GET /api/auth/verify` request. If valid, the session is preserved; if expired or manipulated, the token is purged and the user is redirected to `/admin/login`.
4. **CORS Whitelisting:** `server/server.js` validates `Origin` headers against dynamic localhost expressions in development and `process.env.CLIENT_ORIGIN` in production.

---

## 7. UI/UX Design System (PowerShell Pitch-Black)

The client interface is custom-styled with TailwindCSS and strict color tokens to evoke an executive engineering command station:

- **Surface Black (`#000000`):** Pure pitch black background eliminates distraction and highlights text contrast.
- **Console Blue (`#0078d4` / `#1e90ff`):** Standard PowerShell electric blue for active navigation items, buttons, and focused borders.
- **Terminal Green (`#10b981`):** Console emerald green denoting live telemetry, success alerts, and online server status.
- **Subtle Structure (`#1e293b`):** Deep slate borders separate panels cleanly without visual noise.
- **Dual-Pane Markdown Preview:** `ProjectForm.jsx` and `ProfileEditor.jsx` implement live tabbed/split Markdown rendering using `react-markdown` and `remark-gfm`.
