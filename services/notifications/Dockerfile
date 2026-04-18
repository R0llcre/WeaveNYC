# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# WeaveNYC notifications-service — multi-stage Dockerfile (Azure Container Apps)
#
# Build context: monorepo root (directory containing pnpm-workspace.yaml).
#
#   docker build -t weavenycpilot.azurecr.io/notifications:v0.1.0 \
#     -f services/notifications/Dockerfile .
#
# The notifications service is an OTP (SMS via Twilio) + magic-link (email via
# Resend) delivery runtime. In production it is deployed to Azure Container
# Apps (external ingress on notify.weavenyc.org → target port 4105). It only
# depends on the @weavenyc/shared library — no Postgres, no Redis, no other
# workspace services — keeping the image lean (< 250MB compressed).
# ---------------------------------------------------------------------------

ARG NODE_VERSION=20.18.1
ARG PNPM_VERSION=10.33.0

# ---------------------------------------------------------------------------
# base: Alpine node image with pnpm enabled via corepack
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# COREPACK_INTEGRITY_KEYS="" works around the known corepack signature-
# verification bug in node 20.18.x: the bundled corepack's pinned ECDSA key
# id no longer matches the key pnpm's current release is signed with. The
# fix is either (a) upgrade corepack globally first or (b) install pnpm
# directly via npm. We do (a) so corepack still owns the pnpm version.
ARG PNPM_VERSION
RUN npm install -g corepack@latest \
 && corepack enable \
 && corepack prepare pnpm@${PNPM_VERSION} --activate
RUN apk add --no-cache curl tini
WORKDIR /workspace

# ---------------------------------------------------------------------------
# deps: install all workspace dependencies (including dev) from the frozen
# lockfile. Cached across incremental builds when only source files changed.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/pwa/package.json apps/pwa/package.json
COPY apps/anchor-admin/package.json apps/anchor-admin/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/p2p/package.json packages/p2p/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/test-utils/package.json packages/test-utils/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/chat/package.json services/chat/package.json
COPY services/match/package.json services/match/package.json
COPY services/notifications/package.json services/notifications/package.json
COPY services/posts/package.json services/posts/package.json
COPY services/resource-directory/package.json services/resource-directory/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder: compile @weavenyc/shared + @weavenyc/notifications into dist/
# ---------------------------------------------------------------------------
FROM deps AS builder
COPY packages ./packages
COPY services ./services
RUN pnpm --filter @weavenyc/shared build \
 && pnpm --filter @weavenyc/notifications build

# ---------------------------------------------------------------------------
# runner: minimal production image. Non-root, port 4105, /healthz probe.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache curl tini \
 && addgroup -S weavenyc -g 1001 \
 && adduser -S weavenyc -G weavenyc -u 1001
WORKDIR /app

ENV NODE_ENV=production \
    NOTIFICATIONS_HOST=0.0.0.0 \
    NOTIFICATIONS_PORT=4105 \
    LOG_LEVEL=info \
    WEAVENYC_DEPLOY_PROFILE=production

# Workspace root marker so config.ts's findWorkspaceRoot() resolves here.
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/package.json ./package.json

# Compiled workspace library — notifications only imports @weavenyc/shared.
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/packages/shared/package.json ./packages/shared/package.json
# packages/shared at runtime does `require('zod')`; Node resolves that from
# packages/shared/node_modules (a pnpm symlink tree into the root .pnpm
# store). Copy it over so the symlinks land on the zod package.
COPY --from=builder /workspace/packages/shared/node_modules ./packages/shared/node_modules

# notifications dist + package manifest
COPY --from=builder /workspace/services/notifications/dist ./services/notifications/dist
COPY --from=builder /workspace/services/notifications/package.json ./services/notifications/package.json

# node_modules trees (root + notifications) — carry the resolved workspace
# symlinks that Node needs to import @weavenyc/shared + its transitives.
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/notifications/node_modules ./services/notifications/node_modules

RUN chown -R weavenyc:weavenyc /app

USER weavenyc
EXPOSE 4105

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4105/healthz || exit 1

# tini reaps zombies and forwards SIGTERM cleanly so Fastify close hooks fire
# during Container Apps rolling deploys.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "services/notifications/dist/src/server.js"]
