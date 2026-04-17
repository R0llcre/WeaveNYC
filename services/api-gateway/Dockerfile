# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# WeaveNYC api-gateway — multi-stage Dockerfile
#
# Expected build context: monorepo root (the directory containing
# pnpm-workspace.yaml). Build with:
#
#   docker build -t weavenyc-api-gateway \
#     -f services/api-gateway/Dockerfile .
#
# The build is workspace-aware: dependencies are installed once from the
# root via pnpm's frozen lockfile, and the final runner image only ships
# the api-gateway dist bundle plus the transitive workspace libraries it
# loads at runtime (shared, db, p2p + domain services posts/match/chat/
# resource-directory/notifications).
# ---------------------------------------------------------------------------

ARG NODE_VERSION=20
ARG PNPM_VERSION=10.33.0

# ---------------------------------------------------------------------------
# base: shared Alpine node image with pnpm installed directly via npm.
# We avoid `corepack prepare` here because pinned old Node bases (20.18.x)
# ship with a corepack binary whose integrity keys predate current pnpm
# releases and reject the signature bundle (`Cannot find matching keyid`).
# Installing pnpm globally via npm sidesteps the signature verification.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ARG PNPM_VERSION
RUN apk add --no-cache curl tini \
 && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /workspace

# ---------------------------------------------------------------------------
# builder: copy the full workspace source + manifests and then install and
# compile. Installing *after* source copy avoids the subtle layer-merge
# issue where a later `COPY packages ./packages` would overlay an already-
# installed `packages/<name>/node_modules` with a stale/empty tree from the
# build context.
# ---------------------------------------------------------------------------
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
# apps/* are enumerated by pnpm-workspace.yaml — pnpm install would fail
# the workspace resolution if any `apps/*/package.json` is missing, so we
# copy only the manifests (not the Next.js source) to keep the builder
# layer lean.
COPY apps/pwa/package.json apps/pwa/package.json
COPY apps/anchor-admin/package.json apps/anchor-admin/package.json
COPY packages ./packages
COPY services ./services

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build only the subset of packages/services that api-gateway loads at
# runtime. We deliberately skip PWA / anchor-admin (Next.js builds) and
# notifications (separate Azure runtime). api-gateway uses a dedicated
# tsconfig.build.json that excludes test/** to keep the production image
# independent of the test matrix (the api-gateway test suite is verified
# separately in CI).
RUN pnpm --filter @weavenyc/shared build \
 && pnpm --filter @weavenyc/p2p build \
 && pnpm --filter @weavenyc/db build \
 && pnpm --filter @weavenyc/resource-directory build \
 && pnpm --filter @weavenyc/posts build \
 && pnpm --filter @weavenyc/match build \
 && pnpm --filter @weavenyc/chat build \
 && cd services/api-gateway && pnpm exec tsc -p tsconfig.build.json

# Note: we intentionally keep the full (dev + prod) node_modules tree in the
# runner image. Pruning via `pnpm deploy --prod` or `pnpm install --prod`
# requires either injected workspace packages (pnpm 10 default) or TTY, and
# App Runner's 2 GB memory limit comfortably absorbs the extra ~120 MB.

# ---------------------------------------------------------------------------
# runner: minimal production image. Non-root, port 4000, /healthz probe.
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache curl tini \
 && addgroup -S weavenyc -g 1001 \
 && adduser -S weavenyc -G weavenyc -u 1001
WORKDIR /app

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000 \
    LOG_LEVEL=info \
    WEAVENYC_DEPLOY_PROFILE=production

# Workspace root marker so config.ts's findWorkspaceRoot() resolves here.
COPY --from=builder /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /workspace/package.json ./package.json

# Compiled workspace libraries — copied whole so that the api-gateway's
# `workspace:*` imports resolve via node_modules symlinks.
COPY --from=builder /workspace/packages/shared/dist ./packages/shared/dist
COPY --from=builder /workspace/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /workspace/packages/p2p/dist ./packages/p2p/dist
COPY --from=builder /workspace/packages/p2p/package.json ./packages/p2p/package.json
COPY --from=builder /workspace/packages/db/dist ./packages/db/dist
COPY --from=builder /workspace/packages/db/package.json ./packages/db/package.json
COPY --from=builder /workspace/packages/db/migrations ./packages/db/migrations

COPY --from=builder /workspace/services/resource-directory/dist ./services/resource-directory/dist
COPY --from=builder /workspace/services/resource-directory/package.json ./services/resource-directory/package.json
COPY --from=builder /workspace/services/posts/dist ./services/posts/dist
COPY --from=builder /workspace/services/posts/package.json ./services/posts/package.json
COPY --from=builder /workspace/services/match/dist ./services/match/dist
COPY --from=builder /workspace/services/match/package.json ./services/match/package.json
COPY --from=builder /workspace/services/chat/dist ./services/chat/dist
COPY --from=builder /workspace/services/chat/package.json ./services/chat/package.json

# api-gateway dist + package manifest
COPY --from=builder /workspace/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /workspace/services/api-gateway/package.json ./services/api-gateway/package.json

# node_modules trees carry the resolved workspace symlinks that Node needs
# at runtime to import the workspace libraries. The api-gateway process
# loads the chat/match/posts/resource-directory domain libraries which
# themselves import `@weavenyc/p2p` and `@weavenyc/shared`; Node's ESM
# resolver walks up from each importer's directory, so every domain
# service needs its own `node_modules/@weavenyc/...` symlink tree.
COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/services/api-gateway/node_modules ./services/api-gateway/node_modules
COPY --from=builder /workspace/services/chat/node_modules ./services/chat/node_modules
COPY --from=builder /workspace/services/match/node_modules ./services/match/node_modules
COPY --from=builder /workspace/services/posts/node_modules ./services/posts/node_modules
COPY --from=builder /workspace/services/resource-directory/node_modules ./services/resource-directory/node_modules
COPY --from=builder /workspace/packages/p2p/node_modules ./packages/p2p/node_modules
COPY --from=builder /workspace/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder /workspace/packages/shared/node_modules ./packages/shared/node_modules

# Entrypoint shim: App Runner / Cloud Run / Container Apps all inject
# secrets as environment variables, but api-gateway's config expects the
# JWT signing keys as PEM *files*. This shim writes the PEM contents to
# /app/.runtime-keys/ and rewrites the env vars to point at those files
# before exec'ing the server process. The shim is idempotent and a no-op
# when the env already points at a real file (local / docker-compose).
COPY <<'EOSH' /usr/local/bin/docker-entrypoint.sh
#!/bin/sh
set -eu
KEY_DIR=/app/.runtime-keys
mkdir -p "$KEY_DIR"

materialize_key() {
  var="$1"; filename="$2"
  val=$(printenv "$var" || true)
  if [ -z "$val" ]; then return 0; fi
  # If the value is already a path to an existing file, leave it alone.
  if [ -f "$val" ]; then return 0; fi
  # Otherwise, write the contents to a file and rewrite the env var.
  path="$KEY_DIR/$filename"
  printf '%s\n' "$val" > "$path"
  chmod 600 "$path"
  export "$var=$path"
}

materialize_key JWT_SIGNING_PRIVATE_KEY jwt-private.pem
materialize_key JWT_SIGNING_PUBLIC_KEY jwt-public.pem

exec "$@"
EOSH
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Ensure file ownership is the non-root runtime user before we drop to it.
RUN chown -R weavenyc:weavenyc /app

USER weavenyc
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/healthz || exit 1

# tini reaps zombie children and forwards signals cleanly (App Runner
# sends SIGTERM on new deployments — Fastify close hooks need the signal
# to flush analytics + purge-job cleanup). The shim runs first to
# materialize PEM secrets, then exec's into node.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "services/api-gateway/dist/src/server.js"]
