# Data Model & API Contract Reference Manual

> **System Architecture:** Decoupled Headless CMS & Data Contract  
> **Upstream Authority:** Admin CMS Dashboard (`client/` - Port 5173, Read/Write, JWT Auth)  
> **Backend Service:** Express.js REST API (`server/` - Port 5000, session-protected dashboard and token-scoped `/v1`)
> **Downstream Consumer:** External applications use the app-scoped `/v1` read-only API
> **Version:** 2.0.0 | September 2026

---

## 1. System Architecture Overview

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
│      Session Dashboard API + token-scoped /v1 API      │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Read / Write (`cms_rw`)
                            ▼
┌────────────────────────────────────────────────────────┐
│                  MongoDB Atlas Cluster                 │
│                     (`Portfolio_db`)                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Scoped Read Access
                            │ (/v1 with app token)
                            ▼
┌────────────────────────────────────────────────────────┐
│               Separate Portfolio Project               │
│                   (Future Consumer)                    │
└────────────────────────────────────────────────────────┘
```

> **Decoupled Architecture Notice:** External applications consume published, app-scoped data through the token-authenticated `/v1` API. They do not connect directly to MongoDB.

---

## 2. Environment Configuration (`server/.env`)

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | Port the Express API server listens on | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster0.abcde.mongodb.net/Portfolio_db?retryWrites=true&w=majority` |
| `JWT_SECRET` | 32+ character secret key used to sign Admin session tokens | `super_secret_jwt_key_at_least_32_characters_long...` |
| `ADMIN_EMAIL` | Admin login email for the CMS console | `admin@example.com` |
| `ADMIN_PASSWORD` | Admin password for the CMS console | `your_secure_password` |
| `CLIENT_ORIGIN` | Allowed origin for CORS frontend requests | `http://localhost:5173` |
| `RESUME_DRIVE_URL` | Public Google Drive link to master resume PDF | `https://drive.google.com/file/d/.../view?usp=sharing` |

---

## 3. Database Models & Schema Specifications

All content collections are tenant-scoped. `Profile`, `Resume`, and each collection record require an immutable `owner: ObjectId` reference to `User`; collection records also include `visibility: 'draft'|'published'`. Profile and Resume have unique `{ owner: 1 }` indexes. Projects use unique `{ owner: 1, slug: 1 }`; Skills use unique, case-insensitive `{ owner: 1, name: 1 }`. Other ordering and date indexes are owner-prefixed. `ownerGuard` rejects unscoped reads and writes.

The database contains 8 content collections plus the admin authentication collection in `server/models/`:

---

### 3.1. Profile Model (`server/models/Profile.js` -> `profiles`)
*Pattern: Tenant singleton (At most 1 active document per owner)*
Manages personal identity, availability telemetry, contact coordinates, terminal system customization, and highlight metrics.

```javascript
{
  name: String,               // Required, trim, default: 'Portfolio Administrator'
  initials: String,           // Monogram, default: 'PA'
  headline: String,           // Professional headline, default: 'Full Stack Engineer · Systems & Architecture'
  shortBio: String,           // Required, max 500 chars, elevator bio
  aboutMarkdown: String,      // Extended markdown case history and background
  email: String,              // Required, lowercase, trim, default: 'admin@example.com'
  phone: String,              // Phone number: ''
  location: {
    city: String,             // Default: 'San Francisco'
    country: String,          // Default: 'United States'
    isRemoteAvailable: Boolean// Default: true
  },
  statusText: String,         // Default: 'Open for high-impact software engineering roles'
  isAvailableForHire: Boolean,// Default: true
  // System / Shell Environment
  terminalUser: String,       // System user identifier, default: 'admin'
  terminalHost: String,       // System host identifier, default: 'portfolio'
  bootGreeting: String,       // Boot POST banner, default: 'PORTFOLIO_SYSTEM v2026.09 - POST INITIATED'
  // Highlights
  metrics: [
    {
      label: String,          // e.g. "Latency"
      value: String,          // e.g. "<10ms"
      description: String     // e.g. "Production p99"
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.2. Social Link Model (`server/models/Social.js` -> `socials`)
Manages all external social coordinates, developer profiles, and external links.

```javascript
{
  platform: String,           // Required: 'GitHub', 'LinkedIn', 'X/Twitter', 'LeetCode', 'Discord', 'Email', etc.
  label: String,              // Required: Display text, e.g. 'github.com/developer'
  url: String,                // Required: Target URL, e.g. 'https://github.com/developer'
  username: String,           // Handle, e.g. 'developer'
  icon: String,               // Icon identifier: 'github', 'linkedin', 'twitter', 'mail', 'code', 'globe'
  order: Number,              // Sorting index (ascending: 0, 1, 2...)
  featured: Boolean,          // If true, highlighted in spotlight and top contact menu
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.3. Skill Model (`server/models/Skill.js` -> `skills`)
*Independent Collection:* Categorized, ordered technical and hardware competencies.

```javascript
{
  name: String,               // Required, unique per owner (case-insensitive)
  category: String,           // Required, enum: [
                              //   'Languages',
                              //   'Frontend',
                              //   'Backend & Systems',
                              //   'Databases & Caching',
                              //   'DevOps & Cloud',
                              //   'Hardware & Electronics',
                              //   'Tools & Frameworks'
                              // ]
  proficiency: String,        // Enum: ['Beginner', 'Familiar', 'Proficient', 'Advanced', 'Expert']
  yearsOfExperience: Number,  // Numeric years, min 0
  featured: Boolean,          // If true, displayed in spotlight summary & top stack highlight
  order: Number,              // Display order index
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.4. Project Model (`server/models/Project.js` -> `projects`)
Engineering case studies, technical architecture deep dives, and systems implementations.

```javascript
{
  title: String,             // Required: Project title
  slug: String,              // Required, unique per owner, lowercase, trim
  mode: String,              // Required, enum: ['solo', 'team']. Default: 'solo'
  role: String,              // Engineering role, e.g. 'Lead Full Stack Engineer'
  shortDescription: String,  // Required: Max 500 chars
  keyMetric: String,         // Performance highlight: 'Latency: <12ms (WebSocket)', '99.98% Uptime'
  highlights: [String],      // Array of key technical accomplishments
  caseStudyBody: String,     // Required: Full Markdown case study architecture body
  stack: [String],           // Technologies: ['React', 'Node.js', 'WebSockets', 'Redis']
  teammates: [String],       // Collaborator names (visible when mode is 'team')
  thumbnail: String,         // URL to preview image
  links: {
    github: String,          // URL to GitHub repository
    live: String,            // URL to live production deployment
    demo: String             // URL to video demonstration
  },
  order: Number,             // Sort order index (ascending)
  featured: Boolean,         // Whether featured on homepage / spotlight overview
  lastUpdated: Date,         // Modification timestamp
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.5. Experience Model (`server/models/Experience.js` -> `experiences`)
Professional career milestones, software engineering roles, and diagnostic internships.

```javascript
{
  company: String,           // Required: Organization name
  role: String,              // Required: Job title (e.g. 'Full Stack Engineer')
  employmentType: String,    // Enum: ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance']
  period: String,            // Required: Display period (e.g. 'June 2024 - Present')
  startDate: Date,           // Start date timestamp
  endDate: Date,             // End date timestamp (null if isCurrent is true)
  isCurrent: Boolean,        // Currently working here flag
  location: String,          // Default: 'Remote'
  companyUrl: String,        // Company website URL
  description: String,       // Required: High-level role overview
  achievements: [String],    // Array of accomplishment bullet points
  technologies: [String],    // Technologies used (e.g. ['Node.js', 'Docker', 'Redis'])
  order: Number,             // Sort order index
  featured: Boolean,         // Default: true
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.6. Education Model (`server/models/Education.js` -> `educations`)
Academic degrees, universities, coursework, and scholarly honors.

```javascript
{
  institution: String,       // Required: University / College name
  degree: String,            // Required: e.g. 'B.Tech in Computer Science & Engineering'
  fieldOfStudy: String,      // Default: 'Computer Science & Engineering'
  period: String,            // Required: Display period (e.g. '2022 - 2026')
  startDate: Date,
  endDate: Date,
  grade: String,             // e.g. 'CGPA: 8.8 / 10'
  location: String,          // Campus location, e.g. 'San Francisco, CA'
  achievements: [String],    // Relevant coursework, honors, societies
  order: Number,             // Sort order index
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.7. Certification Model (`server/models/Certification.js` -> `certifications`)
Vendor certifications, licenses, and competitive awards.

```javascript
{
  title: String,             // Required: Certification name
  issuer: String,            // Required: Issuing organization (e.g. 'Amazon Web Services', 'Meta')
  issueDate: String,         // Required: e.g. 'October 2024'
  expirationDate: String,    // Default: 'No Expiration'
  credentialId: String,      // License identifier: 'AWS-CCP-998811'
  credentialUrl: String,     // Official verification link
  skills: [String],          // Validated skills: ['AWS', 'Cloud Architecture', 'EC2', 'S3']
  order: Number,             // Sort order index
  createdAt: Date,
  updatedAt: Date
}
```

---

### 3.8. Resume Document Model (`server/models/Resume.js` -> `resumes`)
*Pattern: Tenant singleton (At most 1 master resume entry per owner)*

```javascript
{
  resumeUrl: String,         // Required: Direct Google Drive, AWS S3, or Cloudinary URL
  fileName: String,          // Display filename, default: 'Resume_Master.pdf'
  version: String,           // Version tag, default: 'v2026.09'
  summaryText: String,       // Resume executive summary / objective
  lastUpdated: Date,         // Timestamp of last modification
  createdAt: Date,
  updatedAt: Date
}
```
- **Virtual Property**: `driveUrl` mirrors `resumeUrl` for backward-compatibility.

---

### 3.9. User Model (`server/models/User.js` -> `users`)
Authentication credentials and session revocation state for each CMS account.

```javascript
{
  email: String,             // Required, unique, lowercased, trim
  passwordHash: String,      // bcrypt hash; never returned to clients
  emailVerifiedAt: Date|null,
  tokenVersion: Number,      // JWT sessions must match the current version
  status: 'active'|'deleted',
  encDEK: String|null,       // Reserved for field encryption
  createdAt: Date,
  updatedAt: Date
}
```

---

## 4. REST API Endpoint Reference

**Dashboard Base URL:** `http://localhost:5000/api`
**External API Base URL:** `http://localhost:5000/v1`

### 4.1. Dashboard Reads and External Consumer API

Dashboard content reads require a session JWT. External clients must use `/v1` with an App token; anonymous `/api` content reads are removed.

| Method | Endpoint | Access | Returns |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | `{ status, uptime, timestamp }` |
| `GET` | `/api/profile`, `/api/resume` | Dashboard session | Full owner-scoped dashboard records |
| `GET` | `/api/socials`, `/api/skills`, `/api/projects` | Dashboard session | Owner-scoped dashboard collections |
| `GET` | `/api/experience`, `/api/education`, `/api/certifications` | Dashboard session | Owner-scoped dashboard collections |
| `GET` | `/v1/app` | App API token | App name, type, and enabled sections |
| `GET` | `/v1/profile`, `/v1/resume` | App API token | Enabled singleton projections |
| `GET` | `/v1/socials`, `/v1/skills`, `/v1/skills/categories` | App API token | Enabled, published collection projections |
| `GET` | `/v1/projects`, `/v1/projects/:slug` | App API token | Enabled, published project projections |
| `GET` | `/v1/experience`, `/v1/education`, `/v1/certifications` | App API token | Enabled, published collection projections |
| `GET` | `/v1/fs` | App token and `include.fs.enabled` | Scoped virtual filesystem tree |

`/v1` requires `Authorization: Bearer <pk_or_sk_token>`. A `pk_` token also requires an exact allowed `Origin`; a `sk_` token is server-side only. Responses contain only published records and fields selected for the App.

---

### 4.2. Dashboard Authentication and Mutations
Content reads and mutations require `Authorization: Bearer <JWT_TOKEN>`. Login is the public session bootstrap endpoint.

| Method | Endpoint | Body Payload | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | `{ email, password }` | Authenticates admin and returns `{ token, admin }` |
| `GET` | `/auth/verify` | None | Verifies active session token |
| `PUT` | `/profile` | Full / Partial Profile JSON | Updates singleton personal identity & prompt |
| `PATCH`| `/profile/availability`| `{ isAvailableForHire, statusText }` | One-click availability switch |
| `POST` | `/socials` | Social JSON | Creates social coordinate |
| `PUT` | `/socials/:id` | Social JSON | Updates social coordinate |
| `DELETE`| `/socials/:id`| None | Deletes social coordinate |
| `PATCH`| `/socials/reorder`| `{ items: [{ id, order }] }` | Reorders social handles |
| `POST` | `/skills` | Skill JSON or Array of Skills | Single or batch skill creation |
| `PUT` | `/skills/:id` | Skill JSON | Updates skill competency |
| `DELETE`| `/skills/:id` | None | Deletes skill |
| `POST` | `/projects` | Project JSON (slug auto-generated) | Creates case study |
| `PUT` | `/projects/:id` | Project JSON | Updates case study |
| `DELETE`| `/projects/:id` | None | Deletes case study |
| `PATCH`| `/projects/reorder`| `{ items: [{ id, order }] }` | Reorders case studies |
| `POST` | `/experience` | Experience JSON | Creates career milestone |
| `PUT` | `/experience/:id` | Experience JSON | Updates career milestone |
| `DELETE`| `/experience/:id` | None | Deletes career milestone |
| `POST` | `/education` | Education JSON | Creates academic credential |
| `PUT` | `/education/:id` | Education JSON | Updates academic credential |
| `DELETE`| `/education/:id` | None | Deletes academic credential |
| `POST` | `/certifications` | Certification JSON | Creates certification |
| `PUT` | `/certifications/:id`| Certification JSON | Updates certification |
| `DELETE`| `/certifications/:id`| None | Deletes certification |
| `PUT` | `/resume` | `{ resumeUrl, fileName, version, summaryText }` | Updates master resume |

---

## 5. Virtual Filesystem (`/v1/fs`) Mapping

Client applications can ingest an App-scoped, published, field-filtered hierarchical tree from `GET /v1/fs` when `include.fs.enabled` is true. Send the App token in the Authorization header:

```json
{
  "projects": {
    "real-time-order-flow-dashboard": {
      "type": "dir",
      "meta": {
        "id": "66e14a2b9f84b3d14c2810a1",
        "title": "Real-time Order Flow Dashboard",
        "slug": "real-time-order-flow-dashboard",
        "mode": "solo",
        "role": "Lead Full Stack Engineer",
        "keyMetric": "Latency: <12ms (WebSocket)",
        "shortDescription": "Sub-15ms WebSocket visualization...",
        "highlights": ["..."],
        "stack": ["React", "Node.js", "WebSockets", "Redis", "TypeScript"],
        "links": { "github": "...", "live": "..." },
        "caseStudyBody": "# Overview...",
        "order": 0,
        "featured": true
      }
    }
  },
  "experience": {
    "tech-innovations-corp": {
      "type": "file",
      "meta": {
        "id": "66e14a2b9f84b3d14c2810b2",
        "company": "Tech Innovations Corp",
        "role": "Full Stack Engineer",
        "employmentType": "Full-time",
        "period": "June 2024 - Present",
        "location": "Remote",
        "description": "Building distributed real-time web services...",
        "achievements": ["..."],
        "technologies": ["Node.js", "React", "MongoDB", "Redis", "Docker"]
      }
    }
  },
  "education": {
    "btech-in-cse": {
      "type": "file",
      "meta": {
        "institution": "University Institute of Technology",
        "degree": "B.S. in Computer Science & Engineering",
        "period": "2022 - 2026",
        "grade": "GPA: 3.9 / 4.0",
        "location": "San Francisco, CA"
      }
    }
  },
  "skills.txt": [
    "Docker", "Express", "JavaScript", "Kubernetes", "Linux / Bash", "MongoDB", "Node.js", "Python", "React", "Redis", "TypeScript", "WebSockets"
  ],
  "socials.txt": [
    { "platform": "GitHub", "url": "https://github.com/developer", "label": "github.com/developer", "username": "developer" },
    { "platform": "LinkedIn", "url": "https://linkedin.com/in/developer", "label": "linkedin.com/in/developer", "username": "developer" }
  ],
  "resume.pdf": {
    "resumeUrl": "https://drive.google.com/file/d/...",
    "driveUrl": "https://drive.google.com/file/d/...",
    "fileName": "Resume_Master.pdf",
    "version": "v2026.09",
    "summaryText": "Full Stack Systems Engineer...",
    "lastUpdated": "2026-09-10T15:00:00.000Z"
  },
  "profile": {
    "name": "Portfolio Administrator",
    "headline": "Full Stack Engineer · Systems & Architecture",
    "email": "admin@example.com",
    "statusText": "Available for High-Impact Software Engineering Roles",
    "isAvailableForHire": true,
    "terminalUser": "admin",
    "terminalHost": "portfolio",
    "bootGreeting": "PORTFOLIO_SYSTEM v2026.09 - POST INITIATED",
    "metrics": [
      { "label": "API Latency", "value": "<15ms", "description": "p99 WebSocket benchmark" },
      { "label": "Uptime", "value": "99.98%", "description": "Production services" }
    ]
  }
}
```

---

## 6. Setup, Seeding & Maintenance Commands

### 6.1. Safe Database Initialization (`npm run setup`)
Run this once or whenever verifying indexes:
```bash
cd server
npm run setup
```
- Verifies MongoDB Atlas connectivity.
- Ensures indexes across all 8 collections.
- Upserts the admin account with bcrypt hashing.
- Leaves existing content completely intact without adding mock data.

### 6.2. Clean Slate Reset (`npm run setup:fresh`)
After independently reviewing the target and taking a backup, pass its exact database name to confirm the destructive operation. This drops the legacy and content collections (and their old global indexes), then recreates the configured primary account:
```bash
cd server
npm run setup:fresh -- --confirm Portfolio_db
```

### 6.3. Seeding Sample Fixtures (`npm run seed`)
Populates the 8 collections with the complete Section 7 sample fixtures:
```bash
cd server
npm run seed
```

### 6.4. Managing Admin Credentials (`npm run admin`)
```bash
cd server
npm run admin -- newemail@example.com newPassword123
```

### 6.5. Running the Backend Server
```bash
cd server
npm run dev
# Running on http://localhost:5000
```

### 6.6. Running the Admin CMS Console
```bash
cd client
npm run dev
# Running on http://localhost:5173
```
