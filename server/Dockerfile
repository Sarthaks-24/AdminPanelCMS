# API server image. Council 2026-10-11, master plan Phase 0 item 4: one always-on container.
# Build from server/:   docker build -t cms-api .
# Run:                  docker run -p 5000:5000 -e MODE=prod -e MONGODB_URI=... -e JWT_SECRET=... -e CLIENT_ORIGIN=... -e TRUST_PROXY_HOPS=1 cms-api
# Everything stateful besides MongoDB is in process memory: run exactly ONE replica (docs/DEPLOYMENT.md).
FROM node:20-alpine

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
