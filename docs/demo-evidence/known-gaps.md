# Known Gaps

Honest list of what WeaveNYC does **not** ship today. Disclosing these upfront keeps the demo honest and short-circuits half the "what about X?" pipeline.

## Platform

- **No native mobile app.** PWA only. We cover the subway-offline case with an [offline outbox](./commit-timeline.md#wave-2--ops--resources-prs-4556) (PR #47) — post publishes queue locally and flush on reconnect — but we have no Swift or Kotlin client and no plans to add one until post-pilot.
- **No payments / donations / mutual-aid money flow.** The pilot intentionally does not touch money. If two residents want to exchange value, the platform connects them; cash changes hands offline.
- **No end-user push notifications.** Azure notifications-service (PR #57, PR #67) sends transactional SMS + email (OTP, anchor activation, rollback warnings). Push (FCM / APNs) is M9 scope.

## Partner + intake surface

- **Partner intake forms are stubbed to MOU templates.** A real partner today signs a PDF MOU from [`templates/`](../../templates/). We do not have a self-serve partner portal. Onboarding is high-touch by design for the 3-community pilot.
- **Anchor TOTP is real** (implemented in PR #50 re-auth-bypass close), **but the pilot anchors have not activated TOTP in production yet** — blocked on partner MOU signatures. Tracked in [M8 Go/No-Go](../29_M8_Pilot_Readiness.md#1-gono-go-checklist).

## Resource directory coverage

Live in 3 of 5 target NYC areas:
- **Covered**: Queens Corona (11368), Bronx Hunts Point (10474), Farmingdale / Nassau County (11735)
- **Not covered**: Staten Island, Brooklyn — data sources identified but not ingested into the Cloud Run backend

Import jobs for the 3 covered areas run on the schedule wired in PR #53 (Cloud Run scheduled imports) and PR #60 (retention). Adding a 4th community is a data-ingestion task, not a code change.

## Pilot + users

- **Zero real pilot users.** Pilot gated on 3 partner MOU signatures (see [`29_M8_Pilot_Readiness.md §1`](../29_M8_Pilot_Readiness.md#1-gono-go-checklist)).
- **Every code path connects to real production backends.** Flipping "go-live" is one env var (`PILOT_INVITE_MODE=open`) away — not a code deploy.
- **Every observability counter is live and emits zeroes**, because no one is generating events yet. The moment the first anchor activates TOTP in prod, `anchor_activated` shows up in `analytics_events` and the dashboard counters start moving.

## Observability — downgraded for pilot week 1

Per the M8 go-live note ([§A8-P0-3](../29_M8_Pilot_Readiness.md#1-gono-go-checklist)):
- **No Prometheus scraper deployed yet.** `/metrics` is live on every runtime and is exercised by CI (`promtool check rules` per PR #61) and by manual `curl`. Scraper rollout is first-week-of-pilot work.
- **No Sentry DSN provisioned in pilot secrets as of 2026-04-20.** SDK + `beforeSend` scrub are wired (PR #40, PR #64). Acceptance gate: first Sentry event captured within 48 h of go-live via a synthetic 4xx.

## Load + scale

- **No formal load test.** Latency numbers in [`metrics-snapshot.md`](./metrics-snapshot.md) are single-user p95, not stress-test. A k6 or Artillery run on `/v1/resources` + WS chat is M9 scope.
- **Single region per cloud.** api-gateway is `us-east-1`, Cloud Run is `us-east1`, Azure is `eastus2`, Cloudflare is global edge. No multi-region failover; rollback is [documented](../29_M8_Pilot_Readiness.md#3-rollback-sop) but untested cross-region.
