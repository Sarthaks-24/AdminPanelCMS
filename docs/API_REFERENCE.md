# REST API Endpoint Reference Manual

This document provides complete technical specifications for every endpoint exposed by the Admin Panel CMS backend server (`server/server.js`).

---

## 1. Global Conventions

- **Base URL (Local):** `http://localhost:5000/api`
- **Content-Type:** `application/json`
- **Response Format:** All successful payloads return JSON objects or arrays with HTTP status `200` (OK) or `201` (Created).
- **Protected Endpoint Authentication:**
  Protected endpoints require an `Authorization` HTTP header with a Bearer JWT token:
  ```http
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  ```
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
- **Response (`200 OK`):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "66e14a2b9f84b3d14c2810a1",
      "email": "admin@example.com"
    }
  }
  ```

### 2.2. Verify Active Session
- **Method:** `GET`
- **Path:** `/api/auth/verify`
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Public
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
- **Access:** Protected (`requireAdmin`)
- **Request Body:** Full or partial Profile JSON.
- **Behavior:**
  - Persists profile bio, metrics, and environment settings.
  - Automatically synchronizes the updated public contact `email` with the corresponding `Email` coordinate in the `socials` collection (`mailto:<email>`, label, and username).
  - **Important:** Does **not** modify the admin account credentials (`Admin.email`); the dashboard login email remains separate and independent.

### 3.3. Update Availability Status
- **Method:** `PATCH`
- **Path:** `/api/profile/availability`
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Public
- **Query Params:** `?featured=true` (optional, filters by featured status)
- **Sort:** Ascending by `order`

### 4.2. Create Social Handle
- **Method:** `POST`
- **Path:** `/api/socials`
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Protected (`requireAdmin`)

### 4.4. Delete Social Handle
- **Method:** `DELETE`
- **Path:** `/api/socials/:id`
- **Access:** Protected (`requireAdmin`)

### 4.5. Reorder Social Handles
- **Method:** `PATCH`
- **Path:** `/api/socials/reorder`
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Public
- **Query Params:**
  - `?category=Languages` (filter by category)
  - `?featured=true` (filter by featured status)

### 5.2. Get Skills Grouped by Category
- **Method:** `GET`
- **Path:** `/api/skills/categories`
- **Access:** Public
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
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Protected (`requireAdmin`)

### 5.5. Delete Skill
- **Method:** `DELETE`
- **Path:** `/api/skills/:id`
- **Access:** Protected (`requireAdmin`)

---

## 6. Projects Studio Endpoints

### 6.1. List Projects
- **Method:** `GET`
- **Path:** `/api/projects`
- **Access:** Public
- **Query Params:**
  - `?featured=true` (featured projects only)
  - `?mode=solo` or `?mode=team` (filter by architecture mode)
  - `?tag=React` (filter by tech stack)

### 6.2. Get Project by ID or Slug
- **Method:** `GET`
- **Path:** `/api/projects/:id`
- **Access:** Public (Accepts MongoDB ObjectID or unique `slug`)

### 6.3. Create Project
- **Method:** `POST`
- **Path:** `/api/projects`
- **Access:** Protected (`requireAdmin`)
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
- **Access:** Protected (`requireAdmin`)

### 6.5. Delete Project
- **Method:** `DELETE`
- **Path:** `/api/projects/:id`
- **Access:** Protected (`requireAdmin`)

### 6.6. Reorder Projects
- **Method:** `PATCH`
- **Path:** `/api/projects/reorder`
- **Access:** Protected (`requireAdmin`)
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

- `GET /api/experience` - Public listing sorted by `order ASC`
- `GET /api/experience/:id` - Public single milestone retrieval
- `POST /api/experience` - Protected milestone creation
- `PUT /api/experience/:id` - Protected milestone update
- `DELETE /api/experience/:id` - Protected milestone deletion

---

## 8. Education Endpoints

- `GET /api/education` - Public listing sorted by `order ASC`
- `GET /api/education/:id` - Public single credential retrieval
- `POST /api/education` - Protected academic credential creation
- `PUT /api/education/:id` - Protected academic credential update
- `DELETE /api/education/:id` - Protected academic credential deletion

---

## 9. Certifications Endpoints

- `GET /api/certifications` - Public listing sorted by `issueDate DESC`
- `GET /api/certifications/:id` - Public single certification retrieval
- `POST /api/certifications` - Protected certification creation
- `PUT /api/certifications/:id` - Protected certification update
- `DELETE /api/certifications/:id` - Protected certification deletion

---

## 10. Resume Hub Endpoints

### 10.1. Get Resume Metadata
- **Method:** `GET`
- **Path:** `/api/resume`
- **Access:** Public
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

### 10.2. Direct Resume Download Redirect
- **Method:** `GET`
- **Path:** `/api/resume/download`
- **Access:** Public
- **Behavior:** Issues an HTTP `302 Found` redirect directly to the active `resumeUrl`.

### 10.3. Update Resume Metadata
- **Method:** `PUT`
- **Path:** `/api/resume`
- **Access:** Protected (`requireAdmin`)
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

## 11. Virtual Filesystem Endpoint

- **Method:** `GET`
- **Path:** `/api/fs`
- **Access:** Public
- **Description:** Returns the complete in-memory JSON hierarchy representing all database entities as files and directories.
