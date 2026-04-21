# Sentry — PWA sourcemap upload

The PWA ships with Sentry wired in two places:

1. **Runtime SDK** — `sentry.client.config.ts`, `sentry.server.config.ts`,
   `sentry.edge.config.ts`. Inert when `NEXT_PUBLIC_SENTRY_DSN` is unset.
2. **Build-time sourcemap upload** — `next.config.ts` is wrapped with
   `withSentryConfig`. When `SENTRY_AUTH_TOKEN` is present in the build
   environment, `next build` automatically uploads minified sources +
   sourcemaps to the `weavenyc / weavenyc-pwa` Sentry project and then
   deletes the `.map` files from `.next/` (via
   `sourcemaps.deleteSourcemapsAfterUpload: true`) so we never publish
   raw maps to CF Pages. When the token is absent the wrap is inert —
   the build still succeeds and errors arrive with minified stacks.

## Provisioning `SENTRY_AUTH_TOKEN`

The token is a **Sentry Auth Token** scoped to the `weavenyc-pwa`
project. It is the only value that needs to live in GitHub Actions
secrets; the DSN (public, for the client runtime) can live in repo
or env files.

### Steps (one-time per project)

1. Log in to https://sentry.io as a user with org `weavenyc` admin
   access.
2. **Settings → Developer Settings → Auth Tokens → Create New Token.**
3. Name the token `github-actions-pwa-sourcemaps`.
4. Required scopes:
   - `project:read` — list the `weavenyc-pwa` project.
   - `project:releases` — create a release per build.
   - `project:write` — upload source artefacts (sourcemaps) to that
     release. This is the minimum scope that lets the
     `@sentry/nextjs` build plugin succeed.
   - (Do NOT grant `org:admin` or `project:admin` — sourcemap upload
     does not need them and a leaked token should not let the holder
     reconfigure the org.)
5. Copy the token value. Sentry shows it exactly once.
6. Add it to the GitHub repo secrets:
   **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SENTRY_AUTH_TOKEN`
   - Value: (paste the token)
7. Trigger a manual run of the `Deploy PWA` workflow
   (`.github/workflows/deploy-pwa.yml`). In the build step logs look for
   `Uploaded source maps` from the Sentry CLI. If you see
   `Skipping source map upload — no auth token` the secret is not
   reaching the step.

### Rotation

Auth tokens do not expire by default. Rotate on a calendar cadence
(quarterly) or whenever a maintainer leaves the project:

1. Create a new token with the same scopes and name it
   `github-actions-pwa-sourcemaps-YYYYMMDD`.
2. Replace the `SENTRY_AUTH_TOKEN` repo secret value.
3. Trigger one successful deploy using the new token.
4. Delete the old token in Sentry **Settings → Auth Tokens**.

### Local builds

Local `pnpm --filter @weavenyc/pwa build` does NOT need the token —
without it, the Sentry wrap simply skips the upload and the build
succeeds normally. Do not put the token in `.env.local` unless you
are actively debugging the upload path; keep the token scoped to CI.
