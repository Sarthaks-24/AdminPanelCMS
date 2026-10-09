# REST API Endpoint Reference Manual

This document provides complete technical specifications for every endpoint exposed by the Admin Panel CMS backend server (`server/server.js`).

---

## 1. Global Conventions

- **Base URL (Local):** `http://localhost:5000/api`
- **Content-Type:** `application/json`
- **Response Format:** All successful payloads return JSON objects or arrays with HTTP status `200` (OK) or `201` (Created).
- **Protected Endpoint Authentication:**
  Logging in sets an `httpOnly` session cookie (`session`, or `__Host-session` over HTTPS) that scripts cannot read. Browser clients must send requests with credentials and, for every non-GET request, the header `X-Requested-With: XMLHttpRequest` (CSRF defence; otherwise `403 csrf_rejected`). Non-browser clients may instead send the session JWT as `Authorization: Bearer <jwt>`. Set `SESSION_COOKIE_SAMESITE=none` only if the dashboard and API are on different sites (requires HTTPS).
- **Standard Error Format:**
  ```json
  {
    "success": false,
    "message": "Descriptive error message here"
  }
  ```

---

## 2. Authentication Endpoints

### 2.1. Admin Login
- **Method:** `POST`
- **Path:** `/api/auth/login`
- **Access:** Public (Rate limited to 10 requests / 15 minutes)
- **Request Body:**
  ```json
  {
    "email": "admin@example.com",
    "password": "your_secure_password"
  }
  ```
- **Response (`200 OK`):** sets the session cookie; no token is returned in the body.
  ```json
  {
    "success": true,
    "admin": {
      "id": "66e14a2b9f84b3d14c2810a1",
      "email": "admin@example.com"
    }
  }
  ```

### 2.2. Verify Active Session
- **Method:** `GET`
- **Path:** `/api/auth/verify`
- **Access:** Protected (`requireSession`)
- **Response (`200 OK`):**
  ```json
  {
    "valid": true,
    "admin": {
      "id": "66e14a2b9f84b3d14c2810a1",
      "email": "admin@example.com"
    }
  }
  ```

---

## 3. Profile Endpoints

### 3.1. Fetch Profile
- **Method:** `GET`
- **Path:** `/api/profile`
- **Access:** Protected (`requireSession`); external consumers use `/v1/profile`
- **Response (`200 OK`):**
  ```json
  {
    "_id": "66e14a2b9f84b3d14c2810a2",
    "name": "Alex Mercer",
    "initials": "AM",
    "headline": "Senior Distributed Systems Engineer",
    "shortBio": "Designing fault-tolerant backends and distributed consensus systems.",
    "aboutMarkdown": "# Background\n\nFull stack developer...",
    "email": "alex@example.com",
    "phone": "+1 555-0199",
    "location": {
      "city": "San Francisco",
      "country": "United States",
      "isRemoteAvailable": true
    },
    "statusText": "Available for high-impact infrastructure roles",
    "isAvailableForHire": true,
    "terminalUser": "alex",
    "terminalHost": "workstation",
    "bootGreeting": "ALEX_MERCER v2026.09 - POST INITIATED",
    "metrics": [
      { "label": "Latency", "value": "<10ms", "description": "Global p99" }
    ]
  }
  ```

### 3.2. Update Profile
- **Method:** `PUT`
- **Path:** `/api/profile`
- **Access:** Protected (`requireSession`)
- **Request Body:** Full or partial Profile JSON.
- **Behavior:**
  - Persists profile bio, metrics, and environment settings.
  - Automatically synchronizes the updated public contact `email` with the corresponding `Email` coordinate in the `socials` collection (`mailto:<email>`, label, and username).
  - **Important:** Does **not** modify the admin account credentials (`Admin.email`); the dashboard login email remains separate and independent.

### 3.3. Update Availability Status
- **Method:** `PATCH`
- **Path:** `/api/profile/availability`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "isAvailableForHire": false,
    "statusText": "Currently engaged on contract until Q4 2026"
  }
  ```

---

## 4. Social Coordinates Endpoints

### 4.1. List All Socials
- **Method:** `GET`
- **Path:** `/api/socials`
- **Access:** Protected (`requireSession`); external consumers use `/v1/socials`
- **Query Params:** `?featured=true` (optional, filters by featured status)
- **Sort:** Ascending by `order`

### 4.2. Create Social Handle
- **Method:** `POST`
- **Path:** `/api/socials`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "platform": "GitHub",
    "label": "github.com/developer",
    "url": "https://github.com/developer",
    "username": "developer",
    "icon": "github",
    "order": 0,
    "featured": true
  }
  ```

### 4.3. Update Social Handle
- **Method:** `PUT`
- **Path:** `/api/socials/:id`
- **Access:** Protected (`requireSession`)

### 4.4. Delete Social Handle
- **Method:** `DELETE`
- **Path:** `/api/socials/:id`
- **Access:** Protected (`requireSession`)

### 4.5. Reorder Social Handles
- **Method:** `PATCH`
- **Path:** `/api/socials/reorder`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "items": [
      { "id": "66e14a2b9f84b3d14c2810b1", "order": 0 },
      { "id": "66e14a2b9f84b3d14c2810b2", "order": 1 }
    ]
  }
  ```

---

## 5. Skills Matrix Endpoints

### 5.1. List All Skills
- **Method:** `GET`
- **Path:** `/api/skills`
- **Access:** Protected (`requireSession`); external consumers use `/v1/skills`
- **Query Params:**
  - `?category=Languages` (filter by category)
  - `?featured=true` (filter by featured status)

### 5.2. Get Skills Grouped by Category
- **Method:** `GET`
- **Path:** `/api/skills/categories`
- **Access:** Removed; use token-authenticated `GET /v1/skills/categories` when the App enables skills
- **Response (`200 OK`):**
  ```json
  {
    "Languages": [ { "name": "TypeScript", "proficiency": "Expert" } ],
    "Backend & Systems": [ { "name": "Go", "proficiency": "Advanced" } ]
  }
  ```

### 5.3. Create Skill(s) (Single or Batch)
- **Method:** `POST`
- **Path:** `/api/skills`
- **Access:** Protected (`requireSession`)
- **Request Body (Batch Example):**
  ```json
  {
    "skills": [
      { "name": "Docker", "category": "DevOps & Cloud", "proficiency": "Proficient" },
      { "name": "Kubernetes", "category": "DevOps & Cloud", "proficiency": "Familiar" }
    ]
  }
  ```

### 5.4. Update Skill
- **Method:** `PUT`
- **Path:** `/api/skills/:id`
- **Access:** Protected (`requireSession`)

### 5.5. Delete Skill
- **Method:** `DELETE`
- **Path:** `/api/skills/:id`
- **Access:** Protected (`requireSession`)

### 5.6. Bulk Update Skills
- **Method:** `PATCH`
- **Path:** `/api/skills/bulk`
- **Access:** Protected (`requireSession`)
- **Request Body (Uniform override mode):**
  ```json
  {
    "ids": ["66e14a2b9f84b3d14c2810c1", "66e14a2b9f84b3d14c2810c2"],
    "updates": {
      "category": "DevOps & Cloud",
      "proficiency": "Expert",
      "yearsOfExperience": 3,
      "featured": true
    }
  }
  ```
- **Request Body (Inline matrix items mode):**
  ```json
  {
    "items": [
      { "id": "66e14a2b9f84b3d14c2810c1", "name": "Docker", "category": "DevOps & Cloud" },
      { "id": "66e14a2b9f84b3d14c2810c2", "name": "Kubernetes", "proficiency": "Expert" }
    ]
  }
  ```

### 5.7. Bulk Delete Skills
- **Method:** `POST`
- **Path:** `/api/skills/bulk-delete`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "ids": ["66e14a2b9f84b3d14c2810c1", "66e14a2b9f84b3d14c2810c2"]
  }
  ```

---

## 6. Projects Studio Endpoints

### 6.1. List Projects
- **Method:** `GET`
- **Path:** `/api/projects`
- **Access:** Protected (`requireSession`); external consumers use `/v1/projects`
- **Query Params:**
  - `?featured=true` (featured projects only)
  - `?mode=solo` or `?mode=team` (filter by architecture mode)
  - `?tag=React` (filter by tech stack)

### 6.2. Get Project by ID or Slug
- **Method:** `GET`
- **Path:** `/api/projects/:id`
- **Access:** Protected (`requireSession`); external consumers use `/v1/projects/:slug`

### 6.3. Create Project
- **Method:** `POST`
- **Path:** `/api/projects`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "title": "Autonomous High-Frequency Trading Engine",
    "slug": "hft-trading-engine",
    "shortDescription": "Sub-millisecond market making daemon in C++ and Node.js",
    "mode": "solo",
    "stack": ["C++", "Node.js", "Redis", "WebSockets"],
    "highlights": [
      "Processed 40,000 orders/sec",
      "Deterministic <10μs jitter"
    ],
    "caseStudyBody": "# Overview\n\nHigh-frequency engine architecture...",
    "links": {
      "github": "https://github.com/developer/hft-engine",
      "live": "https://hft-demo.example.com"
    },
    "featured": true,
    "order": 0
  }
  ```

### 6.4. Update Project
- **Method:** `PUT`
- **Path:** `/api/projects/:id`
- **Access:** Protected (`requireSession`)

### 6.5. Delete Project
- **Method:** `DELETE`
- **Path:** `/api/projects/:id`
- **Access:** Protected (`requireSession`)

### 6.6. Reorder Projects
- **Method:** `PATCH`
- **Path:** `/api/projects/reorder`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "items": [
      { "id": "66e14a2b9f84b3d14c2810c1", "order": 0 },
      { "id": "66e14a2b9f84b3d14c2810c2", "order": 1 }
    ]
  }
  ```

---

## 7. Career Experience Endpoints

- `GET /api/experience` - Session-protected dashboard listing sorted by `order ASC`
- `POST /api/experience` - Protected milestone creation
- `PUT /api/experience/:id` - Protected milestone update
- `DELETE /api/experience/:id` - Protected milestone deletion

---

## 8. Education Endpoints

- `GET /api/education` - Session-protected dashboard listing sorted by `order ASC`
- `POST /api/education` - Protected academic credential creation
- `PUT /api/education/:id` - Protected academic credential update
- `DELETE /api/education/:id` - Protected academic credential deletion

---

## 9. Certifications Endpoints

- `GET /api/certifications` - Session-protected dashboard listing
- `POST /api/certifications` - Protected certification creation
- `PUT /api/certifications/:id` - Protected certification update
- `DELETE /api/certifications/:id` - Protected certification deletion

---

## 10. Resume Hub Endpoints

### 10.1. Get Resume Metadata
- **Method:** `GET`
- **Path:** `/api/resume`
- **Access:** Protected (`requireSession`); external consumers use `GET /v1/resume`
- **Response (`200 OK`):**
  ```json
  {
    "_id": "66e14a2b9f84b3d14c2810d1",
    "resumeUrl": "https://drive.google.com/file/d/1abc.../view?usp=sharing",
    "driveUrl": "https://drive.google.com/file/d/1abc.../view?usp=sharing",
    "fileName": "Resume_Master.pdf",
    "version": "v2026.09",
    "lastUpdated": "2026-09-10T14:30:00.000Z",
    "summaryText": "Full Stack Engineer with expertise in real-time WebSockets and distributed systems."
  }
  ```

### 10.2. Direct Resume Download Redirect (Removed)

`GET /api/resume/download` has been removed. External consumers should read `resumeUrl` from token-authenticated `GET /v1/resume` and use that URL directly; `/v1` does not redirect.

### 10.3. Update Resume Metadata
- **Method:** `PUT`
- **Path:** `/api/resume`
- **Access:** Protected (`requireSession`)
- **Request Body:**
  ```json
  {
    "resumeUrl": "https://drive.google.com/file/d/new-file-id/view",
    "fileName": "Resume_Master.pdf",
    "version": "v2026.10",
    "summaryText": "Updated executive engineering summary..."
  }
  ```

---

## 11. Legacy Virtual Filesystem Endpoint (Removed)

`GET /api/fs` has been removed. External consumers may use token-authenticated `GET /v1/fs` only when the App enables `include.fs`; the tree is built from the same scoped, published projection as the other `/v1` resources.

## Versioned public API (`/v1`)

External consumers use an API token in `Authorization: Bearer <token>`. Static apps receive `pk_live_…` publishable tokens. Their `allowedOrigins` can be exact HTTPS origins or `*`; an empty origin list on a static app is normalized to `*`. This setting controls which browser origins may read responses. It is not API authentication: every request still needs its valid Bearer token, and `pk` tokens are public keys intended only for the app's selected public data. Protected apps receive `sk_live_…` secret tokens for server-side use. Requests without a browser `Origin` header are also allowed when the token is valid. Tokens in query strings are rejected. Responses include an `ETag`; send `If-None-Match` to receive `304 Not Modified`.

| Method | Path | Description |
|---|---|---|
| GET | `/v1/app` | App name, type, and enabled sections |
| GET | `/v1/profile`, `/v1/resume` | Enabled singleton projections |
| GET | `/v1/socials`, `/v1/skills`, `/v1/skills/categories` | Enabled published collection projections |
| GET | `/v1/projects`, `/v1/projects/:slug` | Project list or one published project; list accepts `stack`, `tag`, and `featured=true` |
| GET | `/v1/experience`, `/v1/education`, `/v1/certifications` | Enabled published collection projections |
| GET | `/v1/fs` | Virtual filesystem projection when enabled |

Every endpoint is limited to the selected App's enabled sections and field projection. Publishable keys use `Cache-Control: public, max-age=60`; secret keys use `private, max-age=60`. `GET /v1/skills` accepts `category`.

### Dashboard token endpoints

These routes require a verified dashboard JWT and verified email. Each App can have at most two active tokens. Static Apps issue publishable keys; protected Apps issue secret keys. Secret plaintext is returned only on creation. Configure a static app's allowed origins as `*` to allow browser calls from any site; keep the selected fields limited to content intended to be public.

| Method | Path | Description |
|---|---|---|
| GET | `/api/apps/:id/tokens` | List token metadata (publishable keys can be copied again) |
| POST | `/api/apps/:id/tokens` | Create a token with optional `label` and `expiresInDays` (`30`, `90`, or `365`) |
| DELETE | `/api/apps/:id/tokens/:tokenId` | Revoke a token immediately |

---

## Account, Signup and Platform Endpoints

All responses use the `{ success, ... }` envelope. Auth endpoints are rate limited per IP and per email.

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/auth/config` | none | `{ signupEnabled, signupMode }` |
| `POST /api/auth/signup` | none | Body `{ email, password (10+), inviteCode, acceptedTerms, acceptedPrivacy }`. Always returns a generic 200 so account existence is not revealed. Invite codes are 6 digits (spaces or a dash such as `123 456` are ignored). After 100 wrong codes within an hour across all visitors (`INVITE_FAILURE_LIMIT`), invite signups return `429 invite_locked` until the window passes. |
| `POST /api/auth/verify-email` | none | Body `{ token }` |
| `POST /api/auth/forgot-password` | none | Body `{ email }`; generic response |
| `POST /api/auth/reset-password` | none | Body `{ token, newPassword }`; invalidates all sessions |
| `POST /api/auth/resend-verification` | session | Re-sends the verification email |
| `POST /api/auth/change-password` | session | Body `{ currentPassword, newPassword }`; rotates the session cookie and revokes other sessions |
| `POST /api/auth/logout` | cookie + `X-Requested-With` header | Clears the session cookie and revokes the session everywhere |
| `GET /api/auth/me` | session | Current user |
| `GET /api/account/export` | session | Full JSON export of the account's data (5 requests/hour) |
| `DELETE /api/account` | session | Body `{ password }`; deletes the account (5 requests/hour) |
| `GET/PUT /api/admin/settings` | superadmin | Read or change `signupMode` (`invite` or `open`). A saved dashboard value overrides the `SIGNUP_MODE` env default; production still stays closed until `LEGAL_POLICIES_APPROVED=true`. |
| `GET /api/admin/overview`, `GET/POST /api/admin/invites`, `DELETE /api/admin/invites/:id` | superadmin | Platform stats and invite management. `POST` body `{ expiresInDays (1-90), maxUses (1-1000) }`; the code is returned once. |

Bulk and reorder endpoints accept at most 500 items; reorders are all-or-nothing and return 404 if any id is not owned by the caller. `/v1` requests are limited per IP (300/min), per token (600/min for `sk_`, 60/min for `pk_`), per account (12/s) and process-wide (25/s).
