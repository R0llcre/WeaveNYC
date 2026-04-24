# EAS Build Configuration — Reference

This file is the human-readable companion to `apps/mobile/eas.json`. Any change
to the JSON **must** be reflected here so the submitter doesn't have to
reverse-engineer what `EXPO_PUBLIC_*` means under deadline pressure.

---

## Build profiles

EAS "profiles" are preset build configurations. We ship three:

| Profile | Distribution | When used | Installer |
|---|---|---|---|
| `development` | Internal (EAS ad hoc) | Day-to-day dev on device | Dev Client (Metro over Wi-Fi) |
| `preview` | Internal (EAS ad hoc) | Designer / PM smoke-test builds on PRs | Simulator + TestFlight internal |
| `production` | App Store | TestFlight external + App Store submit | TestFlight / App Store |

### Channel naming

`channel` ties a build to an OTA update stream (`expo-updates`). We use the
same string as the profile name so promotion is unambiguous.

| Channel | Receives OTA from branch |
|---|---|
| `development` | `main` (auto) and any feature branch manually pushed |
| `preview` | `main` only |
| `production` | tagged releases only (`v1.0.0`, `v1.0.1`) |

The `HOTFIX.md` runbook covers how to push an OTA against a specific channel.

### `autoIncrement: "buildNumber"` — production only

EAS will bump `CFBundleVersion` on every production build so multiple submits
per day don't collide. The human-facing `CFBundleShortVersionString` (semver
like `1.0.0`) stays under manual control in `app.config.ts` — we update it
only on real releases.

### `resourceClass: "m-medium"`

EAS Cloud build machines. `m-medium` is cheaper than `m-large` and fast enough
for an Expo managed RN app (~7–10 min total build). Upgrade to `m-large` if
build times exceed 15 min after we add native modules.

---

## Environment variables

All app-visible env vars must be prefixed `EXPO_PUBLIC_` — anything else is
stripped from the JS bundle at build time. Secrets never live here; use
`eas secret:create` for server-side-only values.

| Var | Dev | Preview | Prod | Purpose |
|---|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:4000` | `https://api.staging.weavenyc.org` | `https://api.weavenyc.org` | Base URL for REST + WS. |
| `EXPO_PUBLIC_SENTRY_DSN` | unset (noop) | `<STAGING_SENTRY_DSN>` | `<PROD_SENTRY_DSN>` | Crash + error telemetry. Matches `apps/pwa/sentry.*.config.ts`. |
| `EXPO_PUBLIC_ENV` | `development` | `preview` | `production` | Feature-flag gate + analytics tag. |

### Secrets set via `eas secret:create` (never in eas.json)

| Secret | Used by | Populated from |
|---|---|---|
| `SENTRY_AUTH_TOKEN` | Sourcemap upload at build end | `sentry.io` → org settings → Auth Tokens, `project:releases` scope |
| `APPLE_APP_SPECIFIC_PASSWORD` | `eas submit` 2FA bypass | <https://appleid.apple.com/account/manage> |
| `EXPO_TOKEN` | CI invocation of `eas` (see `mobile-build.yml`) | `expo.dev` → Access Tokens |

Create with:

```bash
eas secret:create \
  --scope project \
  --name SENTRY_AUTH_TOKEN \
  --value "$SENTRY_TOKEN" \
  --type string
```

Secrets are baked into the build image at build time, not shipped to clients.

---

## Submit config — production iOS

The `submit.production.ios` block tells `eas submit` how to upload the built
`.ipa` to App Store Connect.

| Field | Placeholder | Filled by | When |
|---|---|---|---|
| `appleId` | `<APPLE_ID>` | Team Agent email | After `APPLE_ENROLLMENT.md` step 4 |
| `ascAppId` | `<ASC_APP_ID>` | Numeric App Store Connect record ID | After `CERTIFICATES.md` step 1 |
| `appleTeamId` | `P42VU73CW3` | Membership details page | After enrollment approval |

At submit time, `eas submit` will prompt for the App-Specific Password
(stored as `APPLE_APP_SPECIFIC_PASSWORD` secret in CI, or typed interactively
for manual submits).

---

## Not in eas.json — lives elsewhere

- **Bundle identifier, permissions, icons**: `apps/mobile/app.config.ts` (to
  be created in wave B). Keep `eas.json` concerned only with *how* to build,
  not *what* the app contains.
- **Android keystore**: intentionally omitted. Android ships later; when we
  add it, append an `android` block to each profile.
- **Internal distribution URLs**: EAS dashboard auto-generates; linked by
  `mobile-build.yml` into PR comments (see that file).

---

## Upgrade / change log

When bumping `cli.version`, open a follow-up PR so engineers know to update
their local `eas-cli`. Current minimum: `>= 10.0.0` (matches latest stable
as of this doc).

When adding a new env var:

1. Add to every profile in `eas.json` (set to empty string if unused).
2. Document row in the table above.
3. Update `app.config.ts` to pipe it into `Constants.expoConfig.extra`.
