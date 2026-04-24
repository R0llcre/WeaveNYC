# WeaveNYC Maestro E2E Suite

End-to-end flows for the WeaveNYC iOS app, exercising the ten critical
pilot paths that need to survive every PR.

## Quick start

```bash
# 1. Install Maestro (macOS)
brew tap mobile-dev-inc/tap
brew install maestro

# 2. Boot a simulator (one-time)
xcrun simctl boot "iPhone 15"

# 3. Install a dev build of the app
# (From the repo root — requires an EAS dev-client build.)
cd apps/mobile && npx expo run:ios --configuration Debug

# 4. Run the whole suite
maestro test apps/mobile/.maestro/

# 5. Or run a single flow
maestro test apps/mobile/.maestro/03-home-wizard-food-now.yaml
```

## Flows

| # | File | What it covers |
|---|------|---------------|
| 01 | `01-onboarding-language.yaml` | Cold launch → Chinese → trust screen |
| 02 | `02-onboarding-trust-location.yaml` | Trust → ZIP 11368 → home wizard |
| 03 | `03-home-wizard-food-now.yaml` | "Hungry right now" → directory w/ Open now filter |
| 04 | `04-resource-detail-actions.yaml` | Resource detail → Call/Directions/Bookmark visible |
| 05 | `05-verify-otp.yaml` | Phone 5165550123 + OTP 246810 bypass → success |
| 06 | `06-community-qr-join.yaml` | Invite code `DEMO-CORONA` → join Corona Mutual Aid |
| 07 | `07-post-compose-offline.yaml` | Compose → airplane mode → publish → outbox → drain |
| 08 | `08-chat-send.yaml` | Open conversation → send "Hello" → bubble appears |
| 09 | `09-universal-link-post.yaml` | `weavenyc://posts/abc-123` deep link → post detail |
| 10 | `10-danger-undo.yaml` | Delete my data → OTP → "30 days to undo" screen |

## Build matrix

| Flow | Dev build | TestFlight | App Store |
|------|-----------|------------|-----------|
| 01 – 04 | Works | Works | Works |
| 05, 08, 10 | Works (stubbed) | **Needs `AUTH_REVIEWER_BYPASS=1`** | Will fail (and should) |
| 06 | Works (stubbed) | Works | Works (DEMO-CORONA is real) |
| 07 | Works | Works | Works — but backend must accept demo outbox entries |
| 09 | Works | Works | Works |

## Demo OTP bypass — backend contract

Flows 05, 08, and 10 enter OTP `246810` for phone `+15165550123`.
This is a **deliberate review-only bypass**. The backend honors it
only when booted with:

```
AUTH_REVIEWER_BYPASS=1
```

**Phase 3-D reviewer notes (App Store + TestFlight) request the
backend team wire this env var during the Apple-review window and
unwire it after approval.** Action item for backend: gate the bypass
behind a kill-switch in the auth config service, so Ops can flip it
without a deploy.

For local Simulator development against a mocked API, the client-side
verify hook short-circuits when `EXPO_PUBLIC_API_MODE=mock`, so the
network call is never made — the code `246810` is just the UI-visible
value that keeps flow YAML identical across environments.

## Fixtures

`fixtures/demo-users.yaml` lists every demo phone/code used by the
suite. Do **not** add real user PII there.

## CI

`.github/workflows/maestro-e2e.yml` runs the suite on macOS GitHub
runners for every PR touching `apps/mobile/**`. Runs take **~15 min**
because macOS runners are single-tenant VMs and Simulator boot is
slow — don't optimize this lightly, the bottleneck is Apple's.

On merges to `main` we promote to Maestro Cloud for parallel device
coverage (iPhone 15, iPhone SE, iPad).

## Writing new flows

1. Copy the header from an existing flow — `appId` and `tags` must
   match `config.yaml`.
2. Prefer `testID` (native Maestro uses these as `id:`) over
   visible-text matches — copy drifts, testids don't.
3. Every flow should `clearState: true` or `runFlow:` a predecessor
   that does, so suites are order-independent.
4. Keep flows under ~30 steps. If you need more, split into a runFlow.
5. Add the new flow to the table in this README, and to the
   `.github/workflows/maestro-e2e.yml` job description.

## Troubleshooting

- **"Element not found"**: open `maestro studio` and inspect the
  live simulator. If the testid is missing, it's a bug in the screen
  under test, not the flow.
- **Flaky waits**: add `timeout: 8000` to assertVisible for anything
  network-bound. Don't raise beyond 15s — that's a symptom of a slow
  API, not a flow problem.
- **Airplane-mode flows hang**: confirm the Simulator actually toggles
  (check Settings → Wi-Fi). On M1/M2 runners airplane-mode sometimes
  needs a `waitForAnimationToEnd` after toggling.
