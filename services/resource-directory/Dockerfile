# syntax=docker/dockerfile:1.7
#
# Dockerfile for services/resource-directory
# -------------------------------------------
# Multi-stage build targeting Google Cloud Run (W4B-GCP, M8 pilot readiness).
#
# Build context: **repository root**
#   docker build -f services/resource-directory/Dockerfile -t <tag> .
#
# resource-directory only depends on `fastify` + `pg` (no workspace deps),
# so we install the full workspace manifest graph (required by pnpm's
# frozen-lockfile check) but filter the actual dep install down to this one
# package via --filter. That keeps the image tiny and build-cache-friendly.

# ---------- Stage 1: deps (install dev+prod for build) ----------
FROM node:20-alpine AS deps
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# Copy root manifests first so Docker caches the install layer aggressively.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy every workspace package.json (but not sources). pnpm-workspace.yaml
# resolves packages via these files; --frozen-lockfile compares them against
# pnpm-lock.yaml so we must use the real manifests, not stubs.
COPY apps/pwa/package.json ./apps/pwa/
COPY apps/anchor-admin/package.json ./apps/anchor-admin/
COPY services/api-gateway/package.json ./services/api-gateway/
COPY services/chat/package.json ./services/chat/
COPY services/match/package.json ./services/match/
COPY services/notifications/package.json ./services/notifications/
COPY services/posts/package.json ./services/posts/
COPY services/resource-directory/package.json ./services/resource-directory/
COPY packages/db/package.json ./packages/db/
COPY packages/p2p/package.json ./packages/p2p/
COPY packages/shared/package.json ./packages/shared/
COPY packages/test-utils/package.json ./packages/test-utils/

# Install deps only for @weavenyc/resource-directory and its transitive deps.
# Everything else resolves in the graph (for frozen-lockfile) but doesn't
# pull modules into node_modules.
RUN pnpm install --frozen-lockfile \
    --filter @weavenyc/resource-directory... \
    --ignore-scripts

# ---------- Stage 2: build (compile TypeScript) ----------
FROM deps AS build
WORKDIR /repo

COPY services/resource-directory/tsconfig.json ./services/resource-directory/
COPY services/resource-directory/src ./services/resource-directory/src

RUN pnpm --filter @weavenyc/resource-directory build

# ---------- Stage 3: runtime (slim production image) ----------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate \
 && apk add --no-cache tini curl

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    LOG_LEVEL=info

# Manifests needed to install production deps.
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/apps/pwa/package.json ./apps/pwa/
COPY --from=build /repo/apps/anchor-admin/package.json ./apps/anchor-admin/
COPY --from=build /repo/services/api-gateway/package.json ./services/api-gateway/
COPY --from=build /repo/services/chat/package.json ./services/chat/
COPY --from=build /repo/services/match/package.json ./services/match/
COPY --from=build /repo/services/notifications/package.json ./services/notifications/
COPY --from=build /repo/services/posts/package.json ./services/posts/
COPY --from=build /repo/services/resource-directory/package.json ./services/resource-directory/
COPY --from=build /repo/packages/db/package.json ./packages/db/
COPY --from=build /repo/packages/p2p/package.json ./packages/p2p/
COPY --from=build /repo/packages/shared/package.json ./packages/shared/
COPY --from=build /repo/packages/test-utils/package.json ./packages/test-utils/

# Production install, scoped to this service.
RUN pnpm install --frozen-lockfile \
    --filter @weavenyc/resource-directory \
    --prod --ignore-scripts \
 && pnpm store prune

# Bring compiled JavaScript + runtime fixtures.
COPY --from=build /repo/services/resource-directory/dist ./services/resource-directory/dist
COPY --from=build /repo/services/resource-directory/src/fixtures ./services/resource-directory/src/fixtures

RUN chown -R node:node /app
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1

# tini handles PID 1 signal forwarding so Cloud Run can terminate cleanly.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "services/resource-directory/dist/src/server.js"]

# Opt-in ECS batch image. The existing Cloud Run build still selects the
# final server stage below; only the dedicated importer build targets this.
FROM runtime AS importer
USER root
COPY --from=build /repo/services/resource-directory/src/fixtures ./services/resource-directory/dist/src/fixtures
RUN apk add --no-cache poppler-utils ca-certificates \
 && curl --fail --silent --show-error --location \
      https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
      --output /app/rds-ca.pem \
 && chown node:node /app/rds-ca.pem
USER node
ENV PGSSLROOTCERT=/app/rds-ca.pem
HEALTHCHECK NONE
CMD ["node", "services/resource-directory/dist/src/cli.js", "sync"]

# Keep the existing web-service image as Docker's default build target.
FROM runtime AS server
