# Deploying Portfolio Control: a first-production-deploy guide

This guide takes you from "it runs on my laptop" to a real site on the internet that strangers can sign up to. It assumes you know what a terminal, Git and an `.env` file are, and nothing more. Every step says **what** to do and **why**, so when something looks different on your screen you can still work it out.

There are two ways to host it. Pick one; you don't need both.

| | **Path A: your own server** (VPS, AWS, Azure) | **Path B: a platform** (Render or Railway) |
| :--- | :--- | :--- |
| What you manage | A Linux machine: updates, firewall, Docker | Nothing below your app; the platform runs it |
| How you deploy | `git pull` + one `docker compose` command | `git push`; the platform rebuilds |
| HTTPS | Automatic (Caddy, included) | Automatic (the platform) |
| Cost per month (rough) | $4–12 for the server | $5–7 for the API, dashboard free or ~$1 |
| Good for | Learning how it really works; one bill | Least to look after; easiest first deploy |
| Files in this repo | `deploy/vps/`, `deploy/web.Dockerfile` | `render.yaml`, `server/railway.json` |

If this is your first deploy and you just want it live, choose **Path B with Render**. If you want to understand every moving part, choose **Path A**. Both use the same settings, so you can move later.

Shared costs on both paths: a domain (~$10/year), MongoDB Atlas (free M0), Resend for email (free up to 100 mails/day).

Contents:

1. [How the pieces fit](#1-how-the-pieces-fit)
2. [Five ideas that make deploys less confusing](#2-five-ideas-that-make-deploys-less-confusing)
3. [Before you start: accounts and a domain](#3-before-you-start-accounts-and-a-domain)
4. [The production database (MongoDB Atlas)](#4-the-production-database-mongodb-atlas)
5. [Email (Resend)](#5-email-resend)
6. [Your production settings](#6-your-production-settings)
7. [Path A: your own server (VPS, AWS, Azure)](#7-path-a-your-own-server-vps-aws-azure)
8. [Path B: Render or Railway](#8-path-b-render-or-railway)
9. [Create the first admin account](#9-create-the-first-admin-account)
10. [Check that it really works](#10-check-that-it-really-works)
11. [Backups](#11-backups)
12. [Going live: letting people sign up](#12-going-live-letting-people-sign-up)
13. [Day two: updates, rollbacks, monitoring](#13-day-two-updates-rollbacks-monitoring)
14. [Troubleshooting](#14-troubleshooting)
15. [Switching between local and production](#15-switching-between-local-and-production)

---

## 1. How the pieces fit

There are **two programs** to deploy, plus two outside services.

```
                you buy:  example.com
                               │
         ┌─────────────────────┴──────────────────────┐
         ▼                                            ▼
  https://example.com                          https://api.example.com
  THE DASHBOARD (client/)                      THE API (server/)
  static files: HTML, JS, CSS                  a Node.js program that runs all the time
  built once by `npm run build`                answers /api/* (dashboard) and /v1/* (your users' apps)
         │   the browser calls the API ──────────────►│
                                                      ├──► MongoDB Atlas (the database)
                                                      └──► Resend (sends the emails)
```

- **The dashboard** (`client/`) is just files. Any "static host" can serve them. They are built **once**, and the API address is written **into** them during the build.
- **The API** (`server/`) is a program that must run **all the time**, as exactly **one** copy (its rate limits and caches live in memory; two copies would each think they are alone).
- Both live on **one domain you own**: the dashboard on `example.com`, the API on `api.example.com`. This is not cosmetic: login uses a cookie, and browsers only send it when both sit on the same domain (more in [§2](#2-five-ideas-that-make-deploys-less-confusing)).

## 2. Five ideas that make deploys less confusing

**1. Environment variables are the settings.** The code never changes between your laptop and production. Only the settings do: which database, which secret keys, which domain. Locally they live in `server/.env` and `client/.env`. On a platform you type them into its dashboard instead. This project is built so that you never edit code to deploy.

**2. One switch per program.** Each `.env` file has a switch at the top:

| Program | Switch | Off (your laptop) | On (production) |
| :--- | :--- | :--- | :--- |
| API | `MODE` | `MODE=dev` uses the `DEV_*` values | `MODE=prod` uses the `PROD_*` values |
| Dashboard | `VITE_MODE` | `VITE_MODE=dev` | `VITE_MODE=prod` |

You fill in both sets once; flipping the switch picks one. In production, anything missing or wrong **stops the program with a message naming the setting**, instead of starting half-broken. That is on purpose: a refusal at deploy time is much cheaper than a broken signup a user finds.

**3. Build time vs. run time.** The dashboard's settings (`VITE_*`) are read **when it is built** and baked into the files, so changing one means **rebuilding** the dashboard. The API's settings are read **when it starts**, so changing one means **restarting** the API. `VITE_*` values are public (anyone can read them in the browser), so never put a secret there.

**4. DNS points names at machines.** Buying `example.com` gives you a control panel where you add **records**:
- an **A record** says "`example.com` is at IP address `203.0.113.10`" (used with your own server);
- a **CNAME record** says "`api.example.com` is another name for `my-api.onrender.com`" (used with platforms);
- **TXT records** prove you own the domain (Resend and platforms ask for these).

Changes can take minutes, sometimes an hour, to spread. `nslookup api.example.com` shows what the world currently sees.

**5. HTTPS is automatic, but needs DNS first.** Platforms and Caddy (used on Path A) get free certificates from Let's Encrypt, but only after the DNS record points at them. If HTTPS "doesn't work yet", wait for DNS, then retry.

**Why one domain matters (the most common first-deploy failure).** Free addresses like `my-app.onrender.com`, `my-app.up.railway.app` or `my-app.pages.dev` each count as a **separate site** to browsers. A dashboard on one and an API on another means the login cookie is never sent, so login "succeeds" and you are instantly logged out again. The API refuses to start with such a pair, and the dashboard shows a warning on its login page. Use your own domain for both.

## 3. Before you start: accounts and a domain

Create these accounts (all have free tiers):

1. **A domain.** Buy one from a registrar such as Cloudflare Registrar, Porkbun or Namecheap. This guide calls it `example.com`; replace it everywhere with yours.
2. **GitHub**, with this repository pushed to it. Both paths deploy from GitHub.
3. **MongoDB Atlas** (`mongodb.com/atlas`), for the database.
4. **Resend** (`resend.com`), for sign-up and password emails.
5. **Your host:** a VPS provider (Hetzner, DigitalOcean), AWS or Azure for Path A; Render or Railway for Path B.

On your laptop: Node.js 22 (`node -v` should print `v22…`), Git, and for Path A an SSH client (built into Windows 10+, macOS and Linux).

Before deploying, make sure the code is healthy:

```bash
cd server && npm ci && npm test && cd ..
cd client && npm ci && npm run lint && npm test && cd ..
```

Then push and check that the **CI** run on GitHub (the Actions tab) is green.

> **Important for backups:** GitHub only runs *scheduled* workflows (the nightly backup) from the repository's **default branch**. Merge this work into `main` (or make the branch you deploy from the default) before [§11](#11-backups).

## 4. The production database (MongoDB Atlas)

You already have a development database. Production gets its **own**, so a test on your laptop can never touch real users' data.

1. In Atlas, create a **new project** called e.g. `portfolio-prod`, and inside it a cluster. **M0 (free)** is enough to start. Pick a region close to where your API will run.
2. **Database Access → Add New Database User**, two of them:
   - `api_user`, password auto-generated, role **readWrite** on database `Portfolio_prod`. The API uses this one.
   - `backup_user`, role **read** on `Portfolio_prod`. Only the nightly backup uses this one.
   Save both passwords in a password manager now; Atlas won't show them again.
3. **Network Access → Add IP Address.**
   - Path A: add your server's IP address (you get it in [§7](#7-path-a-your-own-server-vps-aws-azure)). Also add `0.0.0.0/0` if you will run the GitHub backup (GitHub's addresses change).
   - Path B: platforms don't have fixed addresses on cheap plans, so add `0.0.0.0/0` ("allow from anywhere"). The strong generated passwords are what protects you.
4. **Connect → Drivers** gives a connection string. Add the database name `Portfolio_prod` after the `/`:

   ```
   mongodb+srv://api_user:<password>@<cluster>.mongodb.net/Portfolio_prod?retryWrites=true&w=majority
   ```

   If the password contains `@ : / ? #` or `%`, URL-encode it (or regenerate one without them).

## 5. Email (Resend)

Signup is email-first: people get a link to set their password. So email must work before anyone can join.

1. In Resend, **Domains → Add Domain**, enter `example.com` (or a subdomain like `mail.example.com`).
2. Resend shows 3–4 DNS records (TXT/MX for SPF and DKIM). Add them at your registrar exactly as shown, then click **Verify**. It can take up to an hour.
3. **API Keys → Create** a key with "Sending access". Copy it (starts with `re_`).
4. Your sender will be something like `Portfolio Control <no-reply@example.com>`. It **must** be on the verified domain: the API refuses to open signup with the test sender `onboarding@resend.dev`.

The free plan sends 100 emails a day; the API keeps itself under 95 and saves 20 of those for password resets. On a paid plan, raise `MAIL_DAILY_CAP` and `MAIL_RESET_RESERVE`.

## 6. Your production settings

Generate three random secrets on your laptop (run the command three times, keep each output):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

One is `JWT_SECRET` (signs logins), one is `INVITE_CODE_PEPPER` (protects invite codes; keep it stable forever), and one is for backups later. Never reuse your development secrets.

### API settings

On **Path A** these go in `server/.env` on the server, with `MODE=prod` and the `PROD_` prefix (for example `PROD_MONGODB_URI=...`). On **Path B** you type them into the platform with the plain names shown here, and `MODE=prod` (`render.yaml` pre-fills some).

| Setting | Example | What it is |
| :--- | :--- | :--- |
| `MODE` | `prod` | The switch. |
| `MONGODB_URI` | `mongodb+srv://api_user:…/Portfolio_prod?…` | From [§4](#4-the-production-database-mongodb-atlas), the `api_user` one. |
| `JWT_SECRET` | 96 random hex characters | Secret 1. Changing it signs everybody out. |
| `INVITE_CODE_PEPPER` | 96 random hex characters | Secret 2. Different from `JWT_SECRET`. |
| `CLIENT_ORIGIN` | `https://example.com` | Where the dashboard lives. Exact: `https`, no trailing `/`. |
| `PUBLIC_API_URL` | `https://api.example.com` | Where the API lives. Shown to your users as their API address. Same domain as above. |
| `TRUST_PROXY_HOPS` | `1` | How many proxies sit in front of the API. `1` on Render, Railway, and Path A (Caddy). |
| `SESSION_COOKIE_SAMESITE` | `lax` | Keep `lax`. |
| `SIGNUP_MODE` | `closed` | Nobody can register yet. You open it from the dashboard later ([§12](#12-going-live-letting-people-sign-up)). |
| `LEGAL_POLICIES_APPROVED` | `false` | Becomes `true` once your Terms and Privacy pages are final. |
| `RESEND_MAIL_KEY` | `re_…` | From [§5](#5-email-resend). |
| `RESEND_FROM_EMAIL` | `Portfolio Control <no-reply@example.com>` | Sender on the verified domain. |
| `PRODUCT_NAME` | `Portfolio Control` | Shown in emails. |
| `OPERATOR_NAME` | `Your Name` | You (or your company), shown in emails. Required before signup can open. |
| `SUPPORT_EMAIL` | `support@example.com` | A real inbox that you read. Required before signup can open. |
| `LOG_LEVEL` | `info` | |

Optional, all with safe defaults when left blank: `MAIL_DAILY_CAP`, `MAIL_RESET_RESERVE`, `MAX_ACCOUNTS`, `SHUTDOWN_DELAY_MS`, the storage guard values, and the two `TURNSTILE_*` captcha keys (leave **both** blank for now; if you add them later, add both). The full list with explanations is in `server/.env.example` and [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

### Dashboard settings

On **Path A** these go in `client/.env` on the server. On **Path B** you type them into the static host's build settings. They are public by design.

| Setting | Example | What it is |
| :--- | :--- | :--- |
| `VITE_MODE` | `prod` | The switch. |
| `VITE_PROD_API_URL` | `https://api.example.com` | The API address (same as `PUBLIC_API_URL`). |
| `VITE_SITE_DOMAIN` | `example.com` | The dashboard's domain, no `https://`. |
| `VITE_SITE_NAME` | `Portfolio Control` | Product name (optional). |
| `VITE_SITE_OPERATOR` | `Your Name` | Who runs the service; quoted in the Terms. |
| `VITE_SITE_JURISDICTION` | `India` | Whose law governs the Terms. |
| `VITE_SITE_SUPPORT_EMAIL` | `support@example.com` | Same as the API's `SUPPORT_EMAIL` (optional; defaults to `support@<domain>`). |
| `VITE_SITE_HOSTING_PROVIDER` | `Hetzner Online GmbH` / `Render Services, Inc.` | Quoted in the Privacy Policy. |
| `VITE_SITE_BACKUP_PROVIDER` | `Cloudflare R2` | Where backups are stored ([§11](#11-backups)). |
| `VITE_SITE_LOG_PROVIDER` | `Render` / `Better Stack` | Where logs are kept. |
| `VITE_SITE_STATUS_URL` | `https://status.example.com` | Optional uptime page link. |

The build **fails** if the API URL, domain, operator or jurisdiction is missing, and tells you which. After building, `cd client && npm run check:launch` lists anything that still looks like a placeholder; it should print nothing before you invite anyone.

---

## 7. Path A: your own server (VPS, AWS, Azure)

You rent one small Linux machine. Docker runs two containers on it: the API, and **Caddy**, a web server that serves the dashboard, forwards `api.example.com` to the API, and gets HTTPS certificates by itself. Everything is described in `deploy/vps/docker-compose.yml`.

### 7.1 Get a server

Any of these works. You want **Ubuntu 24.04**, at least **1 vCPU and 2 GB RAM** (1 GB is too tight to build the dashboard), and a **fixed public IP**.

**A generic VPS (Hetzner, DigitalOcean, Vultr, Linode)** is the simplest and cheapest:
1. Create a server ("droplet", "instance") with Ubuntu 24.04, 2 GB RAM, in a region near you.
2. Under authentication choose **SSH key**, and paste your public key. If you don't have one: `ssh-keygen -t ed25519` on your laptop, then paste the contents of `~/.ssh/id_ed25519.pub`.
3. Note the IPv4 address it shows.

**AWS**, two options:
- **Lightsail** (simplest on AWS): Create instance → Linux/Unix → OS Only → Ubuntu 24.04 → the 2 GB plan. Then **Networking**: attach a **static IP**, and in the IPv4 firewall add **HTTPS (443)** next to the existing SSH and HTTP.
- **EC2**: Launch instance → Ubuntu Server 24.04 → `t3.small` → create or choose a key pair. In **Network settings** allow SSH (22) from *My IP*, and HTTP (80) and HTTPS (443) from anywhere (this creates a *security group*). After launch, go to **Elastic IPs → Allocate → Associate** it with the instance, so the address never changes. Log in as user `ubuntu`.

**Azure**:
1. Create a resource → **Virtual machine** → Ubuntu Server 24.04 LTS → size **B2s** (B1ms works but builds slowly).
2. Authentication: SSH public key. Inbound ports: allow **SSH (22), HTTP (80), HTTPS (443)** (this creates a *network security group*).
3. After creation, open the VM's **public IP address** resource → Configuration → set assignment to **Static**. Log in with the admin username you chose.

Now add this IP to Atlas **Network Access** ([§4](#4-the-production-database-mongodb-atlas)).

### 7.2 Point your domain at it

At your registrar's DNS settings, add three **A records**, all with the server's IP:

| Type | Name | Value |
| :--- | :--- | :--- |
| A | `@` (means `example.com` itself) | `203.0.113.10` |
| A | `www` | `203.0.113.10` |
| A | `api` | `203.0.113.10` |

All three are needed: Caddy requests a certificate for each name, and keeps retrying (and logging errors) for one that doesn't resolve. The layout is fixed: the dashboard on the bare domain, the API on `api.` (so `CLIENT_ORIGIN=https://example.com`, `PUBLIC_API_URL` and `VITE_PROD_API_URL` = `https://api.example.com`).

If your DNS is on Cloudflare, set these to **DNS only** (grey cloud), not "Proxied". Caddy needs to answer directly to get certificates, and the API's caching rules assume no extra proxy.

### 7.3 Prepare the machine

Connect (use `ubuntu@` on AWS, your admin name on Azure, `root@` on most VPS providers):

```bash
ssh root@203.0.113.10
```

Then, on the server:

```bash
# 1. Updates, and automatic security updates from now on.
sudo apt update && sudo apt -y upgrade
sudo apt -y install unattended-upgrades git
sudo dpkg-reconfigure -plow unattended-upgrades

# 2. A firewall: only SSH, HTTP and HTTPS in. (Cloud firewalls from 7.1 are a second layer.)
sudo ufw allow OpenSSH
sudo ufw allow 80,443/tcp
sudo ufw allow 443/udp
sudo ufw enable

# 3. Docker, from Docker's own install script.
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out and back in (exit, then ssh again) so the docker group applies.

# 4. Swap space, so building the dashboard can't run out of memory on a small machine.
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Check with `docker version` and `docker compose version`.

### 7.4 Get the code and the settings onto it

```bash
git clone https://github.com/<you>/<repo>.git portfolio
cd portfolio
git checkout <the branch you deploy, e.g. main>
cp server/.env.example server/.env
cp client/.env.example client/.env
nano server/.env      # Ctrl+O to save, Ctrl+X to exit
```

In `server/.env`: set `MODE=prod`, fill every `PROD_*` value from [§6](#api-settings) (for example `PROD_MONGODB_URI=…`, `PROD_CLIENT_ORIGIN=https://example.com`), and the plain `PRODUCT_NAME`, `OPERATOR_NAME`, `SUPPORT_EMAIL`. You can leave `PROD_TRUST_PROXY_HOPS` blank: the compose file sets it to `1` for you (Caddy is the one proxy). The `DEV_*` values don't matter on the server.

In `client/.env`: set `VITE_MODE=prod` and the values from [§6](#dashboard-settings). `VITE_SITE_DOMAIN` is also what tells Caddy which domain to serve.

For a private repository, use a **deploy key**: `ssh-keygen -t ed25519` on the server, add the `.pub` file in GitHub → Settings → Deploy keys (read-only), and clone with the `git@github.com:` address.

Protect the secrets file: `chmod 600 server/.env`.

One trap: Docker Compose treats `$` inside these files as the start of a variable, so a value like `abc$def` silently becomes `abc`. The hex secrets from [§6](#6-your-production-settings) never contain `$`; if a database password does, write it as `$$` or regenerate it without one.

### 7.5 Start it

```bash
cd deploy/vps
docker compose up -d --build
```

The first run takes a few minutes (it builds both images). Then:

```bash
docker compose ps                 # both "running"; api becomes "healthy"
docker compose logs api | head    # should show: [Env] MODE=prod · database Portfolio_prod
docker compose logs -f web        # watch Caddy get the certificates; Ctrl+C to stop watching
```

If the API exits with `Invalid configuration`, the lines under it name every setting to fix. Edit `server/.env`, then `docker compose up -d` again. If the **build** of `web` fails, the message names the `VITE_*` value to fix in `client/.env`; rerun with `--build`.

Open `https://example.com` and `https://api.example.com/readyz` (should show `{"status":"ready"}`). Continue with [§9](#9-create-the-first-admin-account).

### 7.6 Path A, later on

- **Deploy a new version:** `cd ~/portfolio && git pull && cd deploy/vps && docker compose up -d --build`.
- **Change an API setting:** edit `server/.env`, then `docker compose up -d` (recreates the API).
- **Change a dashboard setting:** edit `client/.env`, then `docker compose up -d --build web`.
- **Logs:** `docker compose logs --since 1h api`. They rotate automatically (10 × 20 MB).
- **Reboots:** both containers restart by themselves (`restart: unless-stopped`).
- **Server snapshots:** turn on your provider's weekly backups/snapshots (a few cents a month). They don't replace database backups ([§11](#11-backups)).

---

## 8. Path B: Render or Railway

The platform builds from GitHub and runs it for you. You only give it settings.

### 8.1 Render (both programs in one place)

`render.yaml` in this repository is a **Blueprint**: it describes both services so you don't click them together by hand.

1. Render dashboard → **New → Blueprint** → connect GitHub → pick this repository and the branch to deploy.
2. Render reads `render.yaml` and shows two services: `portfolio-api` (Docker, the smallest always-on paid instance `0.5c-512mb`, ~$7/month, 1 instance; if Render's screen offers a differently named plan, pick the smallest paid one) and `portfolio-web` (static site, free). It asks for every value marked "sync: false". Fill them from [§6](#6-your-production-settings); for `LEGAL_POLICIES_APPROVED` type `false`. `JWT_SECRET` and `INVITE_CODE_PEPPER` are generated for you (so always create invite codes in the Superadmin panel, never with the `npm run invite` script on your laptop, which wouldn't know that pepper).
   - Why not the free plan for the API? Free instances fall asleep after 15 idle minutes; the first visitor waits ~a minute and every in-memory limit resets. The API must be always on.
3. **Apply.** The first deploy of the API will **fail** with `Invalid configuration`: that's expected until the custom domains exist, because `CLIENT_ORIGIN` and `PUBLIC_API_URL` must be on your own domain. Continue.
4. **Custom domains.**
   - `portfolio-web` → Settings → Custom Domains → add `example.com` (and `www.example.com`).
   - `portfolio-api` → Settings → Custom Domains → add `api.example.com`.
   - Render shows the DNS records to create at your registrar (a CNAME for `api` and `www`, and an A or ALIAS record for the bare domain). Add them, wait for Render to show "Certificate issued".
5. Make sure `CLIENT_ORIGIN=https://example.com`, `PUBLIC_API_URL=https://api.example.com` (API service → Environment) and `VITE_PROD_API_URL=https://api.example.com`, `VITE_SITE_DOMAIN=example.com` (web service → Environment). Then **Manual Deploy → Deploy latest commit** on both.
6. API → **Logs** should show `[Env] MODE=prod · database Portfolio_prod` and no errors. `https://api.example.com/readyz` → `{"status":"ready"}`.
7. API → Settings: set **Pre-Deploy/Shutdown delay** ("Max shutdown delay") to at least 20 seconds if offered, so deploys don't cut requests.

Render deploys again on every push to that branch. Changing a `VITE_*` value needs a new deploy of `portfolio-web` (it is baked in at build).

### 8.2 Railway (API) + a static host (dashboard)

Railway is great for the API. For the dashboard you can either use a free static host (Cloudflare Pages, recommended) or a second Railway service.

**The API on Railway:**
1. Railway → **New Project → Deploy from GitHub repo** → choose the repository.
2. Open the new service → **Settings**:
   - **Root Directory:** `server`. Railway then builds `server/Dockerfile`.
   - **Config-as-code → Railway config file:** `/server/railway.json` (the full path from the repository root; Railway does not look inside the root directory by itself). This file sets 1 replica, no sleeping, a health check on `/readyz` and a graceful shutdown. Check under **Deploy** that the health check path now shows `/readyz`.
   - **Branch:** the one you deploy.
3. **Variables:** add every API setting from [§6](#api-settings) with the plain names, including `MODE=prod` and `TRUST_PROXY_HOPS=1`. Tip: the "Raw Editor" lets you paste them all as `NAME=value` lines.
4. **Settings → Networking → Custom Domain:** `api.example.com`. Railway shows a CNAME (and a TXT for verification): add them at your registrar. Port: Railway passes `PORT` to the app, which listens on it.
5. Deploy. Logs should show `[Env] MODE=prod · database Portfolio_prod`.

Make sure **App Sleeping / Serverless** is off (it is, via `railway.json`) and replicas stay at 1. If Railway ever stops reading `railway.json` (it has announced changes to config-as-code), set the same values by hand in the service settings: 1 replica, serverless off, health check path `/readyz`, draining 20 s. The Hobby plan (~$5/month including some usage) is enough.

**The dashboard, option 1: Cloudflare Pages (free, recommended).**
1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repository.
2. Build settings: Framework preset *None*; **Root directory** `client`; **Build command** `npm ci && npm run build`; **Output directory** `dist`.
3. **Environment variables (Production):** `NODE_VERSION=22`, `VITE_MODE=prod`, and every `VITE_*` value from [§6](#dashboard-settings).
4. Deploy, then **Custom domains → Set up a domain** → `example.com` (and `www.example.com`). If your domain's DNS is on Cloudflare this is one click; otherwise follow the CNAME instructions.
5. Pages reads the generated `_headers` (security headers) and `_redirects` (so `/dashboard/apps` works on reload) automatically.

**The dashboard, option 2: a second Railway service.** In the same project: **New → GitHub Repo** → same repository. Settings → Root Directory: empty (repository root). Variables: `RAILWAY_DOCKERFILE_PATH=deploy/web.Dockerfile` plus every `VITE_*` value from [§6](#dashboard-settings) (Railway passes them to the build). Networking → custom domain `example.com`, **target port 80**. It serves the dashboard with Caddy and the same security headers.

---

## 9. Create the first admin account

Signup is closed, so the first account (you, the **superadmin**) is created by a script, `npm run production:prepare`. It prints which database it will touch, makes you **type the database name** to confirm, creates the database indexes, then asks for your email and a password (12+ characters).

Run it with the **production settings**, from wherever those live:

| Where | Command |
| :--- | :--- |
| Path A | `cd ~/portfolio/deploy/vps && docker compose exec api npm run production:prepare` |
| Render | API service → **Shell** tab → `npm run production:prepare` |
| Railway | On your laptop with the [Railway CLI](https://docs.railway.com/guides/cli): `railway link`, then `cd server && railway run npm run production:prepare` (runs locally with the service's variables) |
| Anything else | Temporarily set `MODE=prod` and the `PROD_*` values in your laptop's `server/.env`, run `cd server && npm run production:prepare`, then set `MODE=dev` again and delete the production values from your laptop. |

The database name it prints must be `Portfolio_prod`, the same as in the API's first log line. If it isn't, stop (Ctrl+C) and fix `MONGODB_URI`.

Then open `https://example.com`, sign in, and **reload the page**. Still signed in? The cookie, domains and HTTPS are all correct.

## 10. Check that it really works

**The automatic check.** From your laptop:

```bash
cd client
npm run smoke -- https://example.com https://api.example.com
```

It checks that the dashboard is allowed to call the API (security policy), that the API accepts the dashboard's login cookie (CORS), that reloading deep pages works, that the two are on the same site, that the public API answers, that the security headers are present, and that `/readyz` and `security.txt` respond. Every line should say `PASS`.

**The walk-through.** In a private browser window:

1. Sign in as the superadmin. Fill in the profile and save; add one project and publish it.
2. Go to **Apps**, create an App of type "Build or server", create a secret key (`sk_live_…`), copy it.
3. From a terminal:

   ```bash
   curl -i -H "Authorization: Bearer sk_live_..." https://api.example.com/v1/projects
   ```

   Expect `HTTP/2 200` and `{"data":[…your project…]}`.
4. Revoke that key in the dashboard; the same `curl` should answer `401` within a few seconds.
5. Log out, use **Forgot password** with your email. The email should arrive within a minute and its link should open your site.
6. Open `https://example.com/dashboard/apps` directly and reload: the page should load, not a 404.
7. **Check the proxy count once.** Find your own public IP (search "what is my IP"), then find one of your requests in the API log: its `"ip"` field must be **your** IP. If it shows a private address like `10.x.x.x` or `172.x.x.x`, there is one more proxy than `TRUST_PROXY_HOPS` says: raise it by 1 and restart. If it's wrong in the other direction you'd see an address you don't recognise; lower it. Getting this right is what keeps one noisy visitor from rate-limiting everybody.

## 11. Backups

Atlas M0 has **no backups of its own**. The repository has a GitHub Actions workflow (`.github/workflows/backup.yml`) that runs every night at 03:00 UTC: it dumps the database, encrypts it, and uploads it to storage you choose, keeping 30 days.

1. **Storage.** Create a bucket somewhere cheap and S3-compatible, e.g. Cloudflare R2 (10 GB free) or Backblaze B2. Create an access key for it.
2. **rclone config.** On your laptop install `rclone`, run `rclone config`, and create a remote (say `backups`) for that bucket. Then `rclone config file` shows where the config is; you'll paste its contents in the next step.
3. **GitHub → repository → Settings → Secrets and variables → Actions → New repository secret**, add:

   | Secret | Value |
   | :--- | :--- |
   | `PROD_MONGODB_URI` | The **backup_user** connection string (read-only), not the API one |
   | `BACKUP_PASSPHRASE` | Secret 3 from [§6](#6-your-production-settings). **Store it in your password manager too: without it the backups can't be opened.** |
   | `BACKUP_REMOTE_DESTINATION` | `backups:your-bucket-name/portfolio` |
   | `RCLONE_CONFIG` | The whole contents of your rclone config file |
   | `BACKUP_HEARTBEAT_URL` | Optional: a "heartbeat" URL from a monitor such as Healthchecks.io or Better Stack. The workflow pings it after every successful backup, and the monitor emails you when a night is missed. |

4. The schedule only runs from the **default branch** (see [§3](#3-before-you-start-accounts-and-a-domain)). Run it once by hand: **Actions → Nightly backup → Run workflow**, and read the log for `Encrypted backup complete`.
5. **Prove you can restore** before you have users. A backup you've never restored is a hope, not a backup. Follow the restore drill in [docs/OPERATIONS.md](docs/OPERATIONS.md#restore-drill) once.

## 12. Going live: letting people sign up

Until now nobody else can register. In order:

1. **Legal pages.** Read your Terms and Privacy pages on the live site (`/terms`, `/privacy`). They quote the `VITE_SITE_*` facts. `cd client && npm run check:launch` must print nothing. Get them reviewed if you can. If you change their text later, bump the versions in `server/contract/legal.json` and redeploy both programs.
2. Set `LEGAL_POLICIES_APPROVED=true` on the API and restart it.
3. Sign in → **Superadmin** panel → set signup to **invite**. If it refuses with "mail not ready", it lists what's missing (sender domain, `OPERATOR_NAME`, `SUPPORT_EMAIL`).
4. Create an invite code in the same panel, send it to **one** person you can watch, and follow their signup in the logs.
5. A few days later, invite more people. Open signup (`open`) only when you are comfortable.

**If something goes wrong after inviting** (the "abort" switch):
1. Superadmin panel → signup → **closed**. Nobody new can join; existing users keep working.
2. For a hard stop: `LEGAL_POLICIES_APPROVED=false` and restart the API.
3. Revoke unused invites, and suspend an account if needed (Superadmin panel).
4. Roll back the code ([§13](#13-day-two-updates-rollbacks-monitoring)). Restore the database only through the restore runbook in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## 13. Day two: updates, rollbacks, monitoring

**Updating.** Work and test locally with `MODE=dev`, push to GitHub, wait for green CI, then:
- Path A: `git pull && docker compose up -d --build` in `deploy/vps`.
- Path B: the platform deploys the push by itself.

**Rolling back a bad release.**
- Render: service → **Events** → pick the previous deploy → **Rollback**.
- Railway: service → **Deployments** → previous one → **Redeploy**.
- Cloudflare Pages: **Deployments** → previous one → **Rollback to this deployment**.
- Path A: `git log --oneline`, then `git checkout <previous-commit>` and `docker compose up -d --build`. Go back with `git checkout <your branch>` once fixed.

**Monitoring (10 minutes, do it).** Create a free monitor at UptimeRobot, Better Stack or Healthchecks.io that requests `https://api.example.com/readyz` every minute and emails you if it isn't `200`. Put its public status page URL in `VITE_SITE_STATUS_URL`. The API writes one JSON log line per request; lines with an `alert` field are worth an email (most log services can alert on a field). See [docs/OPERATIONS.md](docs/OPERATIONS.md#alerts).

**Keep secrets secret.** If a secret leaks: change it on the host and restart. `JWT_SECRET` → everyone is signed out, nothing else breaks. A database password → change it in Atlas, update `MONGODB_URI` (and the backup secret), restart.

## 14. Troubleshooting

| You see | It means | Fix |
| :--- | :--- | :--- |
| API exits with `Invalid configuration` and a list | A setting is missing or wrong; each line names it | Fix those settings, restart |
| `CLIENT_ORIGIN (…) and PUBLIC_API_URL (…) are on different sites…` | Dashboard and API are on different domains (e.g. `*.onrender.com`) | Put both on your domain: `example.com` + `api.example.com` |
| `TRUST_PROXY_HOPS must be set explicitly` | Missing setting | `1` on Render, Railway and Path A |
| Dashboard build fails: `VITE_PROD_API_URL is not set` / `Invalid site identity` | A `VITE_*` value is missing | Add it to `client/.env` or the build settings, rebuild |
| `VITE_MODE="prd" is not a mode` | Typo in the switch | `dev` or `prod` |
| Login works, then you're logged out on reload | Cookie not sent: different domains, or not https | Same domain for both, https everywhere, `SESSION_COOKIE_SAMESITE=lax` |
| Dashboard shows "Network Error" / CORS error in the browser console | `CLIENT_ORIGIN` doesn't exactly match the address in the browser bar, or the dashboard was built with a different API URL | Make `CLIENT_ORIGIN` exact (no `/` at the end, `https`), rebuild the dashboard after changing `VITE_PROD_API_URL` |
| Every user suddenly gets `429 rate_limited` | `TRUST_PROXY_HOPS` too low, so everyone looks like the same IP | `1` behind one proxy (2 if you add a CDN in front) |
| `MongoServerSelectionError` / `/readyz` says 503 | API can't reach Atlas | Atlas Network Access: allow the server IP (or `0.0.0.0/0` on platforms); check the password in `MONGODB_URI` |
| Signup panel says `mail not ready` | Email isn't production-ready | Verified Resend domain, sender on it, `OPERATOR_NAME` and `SUPPORT_EMAIL` set |
| No emails arrive | Resend domain not verified, or spam folder | Resend → Domains shows status; Resend → Logs shows each attempt |
| `/dashboard/apps` gives 404 on reload | The host isn't sending unknown paths to `index.html` | Pages/Netlify: `_redirects` must be in `dist`; Render: the rewrite rule from `render.yaml`; Path A: Caddy does it |
| Caddy logs `challenge failed` / no certificate | DNS doesn't point at the server yet, or ports 80/443 are closed, or Cloudflare proxy is on | Check the A records with `nslookup`, the cloud firewall, set Cloudflare to "DNS only" |
| `web` build is killed on Path A | Out of memory | The swap file from 7.3, or a 2 GB machine |

## 15. Switching between local and production

Your laptop keeps working exactly as before:

```env
# server/.env                     # client/.env
MODE=dev                          VITE_MODE=dev
```

`npm run dev` in both folders runs everything locally against your development database. Without a real Resend key, emails are printed in the API's terminal instead of being sent (look for the verification link there), so you can test signup end to end offline.

To point your laptop at production (rarely needed; for example to run a script), set `MODE=prod` in `server/.env` with the `PROD_*` values filled. Every script prints the database it will touch first, and the dangerous ones make you type its name. Set it back to `dev` straight after.

The deeper references: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) (every setting), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (topology, limits, probes), [docs/OPERATIONS.md](docs/OPERATIONS.md) (backups, restore, incidents).
