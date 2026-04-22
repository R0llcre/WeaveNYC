# Mobile Release Ops — Index

Paperwork + infra scripts + documentation to ship WeaveNYC iOS to TestFlight
(week 9) and the App Store (week 10) as a 1-day operation, not a 2-week
scramble.

Produced by agent **M8** in parallel with M1 (foundation), M5 (chat), and
M7 (QR community) during Phase 1 wave A. No application code is touched
here — this is groundwork the code teams will consume in weeks 8–10.

## Read this first

Start at `APPLE_ENROLLMENT.md` — nothing else can happen until the Apple
Developer Program membership is live. The rest of the docs assume
enrollment is complete and the Team ID has been captured.

## Docs

| File | What's in it | Consumer |
|---|---|---|
| `APPLE_ENROLLMENT.md` | Step-by-step to enroll an org in Apple Developer Program. | Founding team (one-time, week 6–7) |
| `CERTIFICATES.md` | Bundle ID reservation, EAS credentials flow, manual p12 fallback. | CTO / DevOps, after enrollment |
| `EAS_CONFIG.md` | Plain-English reference for every field in `../eas.json`. | Mobile engineers, ongoing |
| `UNIVERSAL_LINKS.md` | AASA hosting, path routing, test commands. | PWA + mobile engineers, week 8 |
| `APP_STORE_LISTING.md` | EN/ES/ZH copy, categories, privacy nutrition labels, screenshots plan. | Marketing + founding team |
| `REVIEWER_NOTES.md` | 2-page brief the submitter pastes into ASC review form. | Submitter, week 10 |
| `ASSETS.md` | Icon + splash + adaptive icon specs for design team. | Design team, wave B (week 8) |
| `TESTFLIGHT.md` | Internal → external → promote rollout plan. | Release engineer, weeks 8–10 |
| `HOTFIX.md` | OTA + feature flags + rollback + expedited review runbook. | Oncall engineer, post-launch |

## Config artifacts

Not documentation but shipped in the same PR:

| Path | Purpose |
|---|---|
| `../eas.json` | EAS Build config (dev/preview/production profiles + submit block). |
| `../../../.github/workflows/mobile-build.yml` | CI workflow: typecheck/lint/test + EAS build + PR install-URL comment. |
| `../../pwa/public/.well-known/apple-app-site-association` | Universal Links association file (Team ID placeholder). |
| `../../pwa/public/_headers` | Cloudflare Pages header rule pinning AASA Content-Type. |

## User action items (summary)

See each doc for details; top-level owners:

1. **Enroll Apple Developer Program** (ED + CTO) — `APPLE_ENROLLMENT.md`.
2. **Review listing copy in 3 languages** (founding team + ES/ZH translators)
   — `APP_STORE_LISTING.md`.
3. **Provision demo account** with reviewer-bypass OTP (backend team,
   week 9) — `REVIEWER_NOTES.md` §2.
4. **Deliver icon + splash art** (design team, wave B) — `ASSETS.md`.
5. **Recruit 50 beta testers from PWA userbase** (product, week 9) —
   `TESTFLIGHT.md` §3.

## Not in scope here

Deliberately *not* included in this PR (handled by other agents or a later
wave):

- App source code, `app.config.ts`, RN navigator, native modules — M1 agent.
- `expo-updates`, `@weavenyc/feature_flags` client lib — M1 + backend agents.
- Actual icon PNGs — design team in wave B.
- Actual screenshots / preview video — post-wave-B.
- Sentry for mobile project setup in sentry.io — DevOps lead, week 8.
