# Developer Setup & Deployment Guide

This guide walks through configuring, running, and deploying the **Admin Panel CMS** and its accompanying Express backend.

---

## 1. Prerequisites

Ensure your environment satisfies the following minimum requirements:
- **Node.js:** v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm:** v9.0.0 or higher
- **MongoDB:** A free tier [MongoDB Atlas](https://www.mongodb.com/atlas) cluster or local MongoDB instance (v6.0+)
- **Git:** Installed and initialized in your repository

---

## 2. MongoDB Atlas Configuration

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Create a new project or select an existing cluster.
3. Under **Security > Database Access**:
   - **CMS Backend User (`cms_rw`):**
     - Click **Add New Database User** and select **Password Authentication**.
     - Create a username (e.g., `cms_rw`) and a secure password.
     - Under **Database User Privileges**, assign **readWrite** permissions specifically scoped to your database (`Portfolio_db`).
   - **External Consumers:** Do not create or share a MongoDB user for a portfolio site. Create a scoped App and use its `pk_` token in a browser or `sk_` token on a server through `/v1`.
   - **Security Guarantee:** The MongoDB credential stays on the CMS backend and never reaches a browser or consumer application.
4. Under **Security > Network Access**:
   - Click **Add IP Address**.
   - For local development, add your current IP address or add `0.0.0.0/0` (allow access from anywhere) with caution.
5. Under **Deployment > Database**:
   - Click **Connect** on your cluster.
   - Choose **Drivers** (Node.js).
   - Copy your connection string. It will look like:
     ```
     mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your credentials, and append your database name before query parameters (e.g., `/Portfolio_db?retryWrites=true&w=majority`).

---

## 3. Backend Setup (`server/`)

### 3.1. Install Dependencies
```bash
cd server
npm install
```

### 3.2. Environment Configuration
Create your local environment file:
```bash
cp .env.example .env
```

Generate a secure 32+ character JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://cms_rw:YourSecurePassword@cluster0.abcde.mongodb.net/Portfolio_db?retryWrites=true&w=majority
JWT_SECRET=paste_your_generated_64_character_hex_string_here
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_strong_admin_password_123!
CLIENT_ORIGIN=http://localhost:5173
```

### 3.3. Initialize the Database
Build database collection indexes and upsert the admin credentials:
```bash
npm run setup
```

*(Optional)* After reviewing the exact target database and taking a backup, a fresh setup requires its database name as explicit confirmation. It drops the legacy and content collections, including their old global unique indexes:
```bash
npm run setup:fresh -- --confirm Portfolio_db
```

*(Optional)* Seed sample structured content for initial review:
```bash
npm run seed
```

### 3.4. Launch Development Server
```bash
npm run dev
```
Verify the server responds:
```bash
curl http://localhost:5000/api/health
# {"status":"OK","message":"Portfolio API is running smoothly."}
```

---

## 4. Frontend Setup (`client/`)

### 4.1. Install Dependencies
Open a second terminal window:
```bash
cd client
npm install
```

### 4.2. Environment Configuration
Create the client environment file:
```bash
cp .env.example .env
```

Configure `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 4.3. Launch Client Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`. You will be automatically redirected to `/admin/login`.

---

## 5. Production Deployment

### 5.1. Building the Frontend
Compile the production bundle:
```bash
cd client
npm run build
```
This produces optimized static assets in `client/dist/`.

### 5.2. Running Backend with PM2
For continuous production uptime, run the Node server with PM2:
```bash
npm install -g pm2
cd server
pm2 start server.js --name "admin-panel-api"
pm2 save
pm2 startup
```

### 5.3. Production CORS
In production, update `CLIENT_ORIGIN` in `server/.env` to match your production domain:
```env
CLIENT_ORIGIN=https://admin.yourdomain.com
```

---

## 6. Common Troubleshooting

### CORS Policy Errors
- **Symptom:** Browser console outputs `Blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`.
- **Solution:** Verify the client port matches the origin allowed in `server/server.js`. In development mode (`NODE_ENV !== 'production'`), dynamic localhost regex matching is automatically enabled for all local ports (`5173`, `5174`, `3000`).

### MongoDB Authentication Failure
- **Symptom:** `MongoServerError: bad auth : authentication failed`.
- **Solution:** Check your password in `MONGODB_URI`. If your password contains special characters (`@`, `:`, `/`), URL-encode them (e.g., `@` becomes `%40`).

### Admin Login Rejected
- **Symptom:** `Invalid email or password` on the login screen.
- **Solution:** Run `npm run admin` inside the `server/` directory to re-hash and re-sync your admin account directly from your active `server/.env` file.
