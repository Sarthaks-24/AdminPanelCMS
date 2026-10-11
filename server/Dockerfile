# API server image. Council 2026-10-11, master plan Phase 0 item 4: one always-on container.
# Build from server/:   docker build -t cms-api .
# Run:                  docker run -p 5000:5000 --env-file prod.env cms-api
#   prod.env holds the plain names (MONGODB_URI, JWT_SECRET, CLIENT_ORIGIN, PUBLIC_API_URL, TRUST_PROXY_HOPS,
#   INVITE_CODE_PEPPER, RESEND_MAIL_KEY, RESEND_FROM_EMAIL, OPERATOR_NAME, SUPPORT_EMAIL, ...); see .env.example.
#   The boot check lists anything missing. Keep prod.env out of the build context and out of git.
# The image includes contract/ (legal.json: the Terms and Privacy versions shared with the client).
# Everything stateful besides MongoDB is in process memory: run exactly ONE replica (docs/DEPLOYMENT.md).
# Node 22 LTS (Node 20 reached end of life on 2026-04-30). Pinned to the multi-arch index digest of
# node:22-alpine as published on 2026-10-12; Dependabot (docker ecosystem) proposes digest bumps.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402

# tini forwards SIGTERM to node as PID 1 so the server's drain-on-SIGTERM handler runs on every deploy.
RUN apk add --no-cache tini

ENV MODE=prod \
    PORT=5000

WORKDIR /app

# Install production dependencies first so this layer is cached between code changes.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .

USER node

EXPOSE 5000

# Liveness only: /livez answers as soon as the process is up. Readiness (Mongo ping) is /readyz, for the platform's probe.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/livez').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
