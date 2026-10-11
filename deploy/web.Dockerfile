# Dashboard + public site image: builds client/ and serves client/dist with Caddy.
# Used by the VPS path (deploy/vps/docker-compose.yml) and by a Railway "web" service. Cloudflare Pages,
# Netlify and Render static sites build client/ directly and don't need it.
#
# Build from the repository root:   docker build -f deploy/web.Dockerfile -t cms-web .
# The build reads client/.env if it exists, and any VITE_* build argument (Railway passes service
# variables as build arguments). VITE_MODE=prod is the switch; the build fails if an input is missing.

FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /repo

COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci --no-audit --no-fund

# The client imports server/contract/*.json and renders the consumer docs from docs/ at build time.
COPY server/contract server/contract
COPY docs docs
COPY client client
COPY deploy/headers-to-caddy.mjs deploy/

# Always a production build: a VITE_MODE=dev left in client/.env would otherwise ship a bundle that
# calls localhost. Build arguments override client/.env.
ARG VITE_MODE=prod
ARG VITE_PROD_API_URL
ARG VITE_DEV_API_URL
ARG VITE_SITE_DOMAIN
ARG VITE_SITE_NAME
ARG VITE_SITE_OPERATOR
ARG VITE_SITE_JURISDICTION
ARG VITE_SITE_SUPPORT_EMAIL
ARG VITE_SITE_HOSTING_PROVIDER
ARG VITE_SITE_BACKUP_PROVIDER
ARG VITE_SITE_LOG_PROVIDER
ARG VITE_SITE_STATUS_URL
# Empty build arguments are dropped so they never mask a value in client/.env.
RUN cd client \
 && case "$VITE_MODE" in prod|production) ;; *) echo "web.Dockerfile builds production only (VITE_MODE=$VITE_MODE)"; exit 1;; esac \
 && for v in $(env | grep -o '^VITE_[A-Z_]*=$' | tr -d '='); do unset "$v"; done \
 && npm run build \
 && node ../deploy/headers-to-caddy.mjs dist/_headers > /repo/headers.caddy

# Caddy 2.10 pinned by its multi-arch index digest (2026-10-12); Dependabot can propose bumps.
FROM caddy:2.10.2-alpine@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d
COPY --from=build /repo/client/dist /srv
COPY --from=build /repo/headers.caddy /etc/caddy/headers.caddy
COPY deploy/Caddyfile /etc/caddy/Caddyfile
