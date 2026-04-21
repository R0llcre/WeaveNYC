# WeaveNYC — Commit Timeline (2026-04-18 → 2026-04-21)

31 merged PRs, 4 review waves. SHA + ISO timestamps pulled from `git log` and cross-checked against `gh pr list --state merged`.

Regenerate with:
```bash
git log --format="- **%h** (%ci) — %s" --since="2026-04-18"
gh pr list --state merged --limit 40 --json number,title,mergedAt
```

---

## Pre-wave foundation (PRs #28–#36)

Deploy-workflow + design-system groundwork that predated the formal review waves.

- **fc342b3** (2026-04-18 18:14:14 -0400) — fix(cf): use CLOUDFLARE_API_TOKEN directly (user granted Pages:Edit scope) — **PR #31**
- **71da212** (2026-04-18 18:42:43 -0400) — fix(admin): enable next output:export for Cloudflare Pages deploy — **PR #32**
- **1f3f1da** (2026-04-18 18:59:19 -0400) — fix(shell): Post tab href /post → /posts/new (404 → compose page) — **PR #33**
- **333eca9** (2026-04-19 00:26:30 -0400) — fix(pwa): trailing slash on all static-route hrefs (fix 404 on tab nav) — **PR #34**
- **9250ee4** (2026-04-19 13:19:04 -0400) — fix(i18n+routes): native-voice zh rewrite + restore settings shim — **PR #35**
- **a6dd7f8** (2026-04-19 23:39:27 -0400) — feat(design): editorial 朱砂 redesign — Fraunces serif + vermillion accent — **PR #36**

---

## Wave 1 — P2P + UX (PRs #37–#44)

Eight PRs. Closed the first-round audit findings on P2P sync (server hardening, client reliability, Zod validation, two-context E2E) and PWA UX coherence (Verify page, shell routing, dead button removal).

- **02e6c78** (2026-04-20 01:35:54 -0400) — fix(pwa): UX coherence — Verify framing + routing repair + interaction polish — **PR #37**
- **0fc1fc3** (2026-04-20 18:52:23 -0400) — refactor(pwa): remove dead create-session button on /community/join — **PR #38**
- **afc1307** (2026-04-20 19:57:52 -0400) — fix(p2p): server security + observability hardening — **PR #39**
- **60d9926** (2026-04-20 20:04:29 -0400) — fix(p2p): client reliability + Sentry wiring — **PR #40**
- **c1af8e6** (2026-04-20 20:27:20 -0400) — test(p2p): two-context E2E + wire-format compat fixtures — **PR #41**
- **a1c5167** (2026-04-20 20:29:01 -0400) — fix(api): defensive guard + diagnostic log on /metrics — **PR #42**
- **9b82088** (2026-04-20 21:59:12 -0400) — feat(p2p): UX informed consent + sync visibility + error i18n — **PR #43**
- **2684821** (2026-04-20 22:25:00 -0400) — feat(p2p): protocol_version handshake + client runtime Zod validation + hot-path index — **PR #44**

---

## Wave 2 — Ops + Resources (PRs #45–#56)

Twelve PRs. Closed the second-round findings on deployment ops (App Runner rolls, Redis→Upstash), resource-directory on Cloud Run (sidecar distance, rate-limit, scheduled imports, completeness guard), write-path correctness (idempotency keys, atomic concurrency), and auth hardening (P0 re-auth bypass, anchor activate rate-limit, server-side logout).

- **96ddcc8** (2026-04-20 22:22:07 -0400) — fix(ops): api-gateway deploy actually rolls + Prometheus alert rules — **PR #45**
- **be196b7** (2026-04-20 22:52:25 -0400) — fix(ops): wait for App Runner RUNNING before update-service — **PR #46**
- **082bd28** (2026-04-21 01:45:03 -0400) — feat(pwa): offline outbox for post publish (subway-safe writes) — **PR #47**
- **f6fe642** (2026-04-21 01:52:21 -0400) — fix(concurrency): post review + sendMessage atomic check-and-write — **PR #48**
- **0ae1ff1** (2026-04-21 02:09:24 -0400) — fix(api): Idempotency-Key on POST /v1/posts, /v1/conversations/:id/messages, /v1/chat-safety/report + accept dedup — **PR #49**
- **db44cf7** (2026-04-21 03:02:38 -0400) — fix(auth): close P0 re-auth bypass + anchor activate rate-limit + server-side logout — **PR #50**
- **04ef185** (2026-04-21 03:34:13 -0400) — fix(pwa): gate protected-endpoint buttons on access_token presence (restore /me/verify E2E) — **PR #51**
- **127f8fe** (2026-04-21 03:58:32 -0400) — fix(ops): Redis to Upstash + deploy-workflow no-op guards + rollback SOP commands — **PR #52**
- **fb71a10** (2026-04-21 04:02:56 -0400) — fix(resources): Cloud Run sidecar distance, public rate-limit, hot-path index, completeness guard, scheduled imports — **PR #53**
- **8487b2d** (2026-04-21 04:41:59 -0400) — fix(api): shim app.serviceJwt for @fastify/jwt v9 namespace — **PR #54**
- **9de4975** (2026-04-21 05:22:41 -0400) — fix(api): RESOURCE_DIRECTORY_SERVICE_URL optional + monolith override — **PR #55**
- **e6f9349** (2026-04-21 05:30:42 -0400) — ops: promote runbook appendices to current + wire Prometheus alerts + Sentry sourcemap upload — **PR #56**

---

## Wave 3 — Safety + Observability (PRs #57–#64)

Eight PRs. Closed the third-round findings on chat safety (hate/harassment blocklist, Luhn-validated bank regex, E.164 phone blocking), chat WebSocket reliability (reconnect, resume, heartbeat, block-disconnect), data migrations (rollback + FKs + retention), deploy-flow ops docs, test coverage (WS hook, chat-safety E2E, /v1/resources smoke, promtool), auth block-propagation (WS Origin, rate-limit, fanout scrub), PWA safety rendering + i18n, and observability hardening (metric cardinality, pino redact, Sentry beforeSend, /readyz depth).

- **591f523** (2026-04-21 05:30:44 -0400) — fix(chat-safety): hate/harassment blocklist + Luhn-validated bank regex + E.164 phone — **PR #57**
- **4d43d49** (2026-04-21 05:38:19 -0400) — fix(chat): WS reconnect + resume + server heartbeat + block disconnect — **PR #58**
- **5eae9e5** (2026-04-21 12:49:13 -0400) — fix(db): 0015 rollback + numbering guard + orphan match_suggestions + analytics FK/CHECK + idempotency FK + updated_at triggers + index tune + analytics retention — **PR #59**
- **9daeda8** (2026-04-21 12:50:00 -0400) — fix(ops+docs): pilot checklists endpoint truth + Vercel→CF Pages + env docs + CI placeholder guard + deploy concurrency + backup schedule + rollback SOP + idempotency docs + chat README — **PR #60**
- **ce87f66** (2026-04-21 12:52:11 -0400) — test: WS hook + block-disconnect + chat-safety E2E + /v1/resources smoke + promtool + Sentry init — **PR #61**
- **8fb5d9f** (2026-04-21 12:54:25 -0400) — fix(auth): enforce block on /v1/match/contact + rate-limit community-access/resolve + WS Origin check + block fanout scrub — **PR #62**
- **9558de1** (2026-04-21 12:54:28 -0400) — fix(pwa): render safety_flags + systemic error i18n + Banner/Toast dismiss label + route fallback i18n — **PR #63**
- **46bd609** (2026-04-21 12:59:10 -0400) — fix(obs): metric cardinality + pino redact + Sentry beforeSend + /readyz depth + alert rules + Sentry env config — **PR #64**

---

## Wave 4 — Closeout (PRs #65–#67)

Three PRs. Closed the final round: CI placeholder guard semantics, deploy uptime ceiling, and Cloud Run public reachability via a Cloudflare Worker proxy (to avoid making the Cloud Run URL directly public).

- **8c2d300** (2026-04-21 13:03:11 -0400) — fix(ci): on-call placeholder guard warns on push, blocks only on explicit go-live — **PR #65**
- **a40db34** (2026-04-21 13:17:47 -0400) — fix(ci): relax post-deploy uptime ceiling 300s → 600s — **PR #66**
- **164dce7** (2026-04-21 15:23:03 -0400) — infra(cloudflare): resource-dir.weavenyc.org Worker proxy to GCP Cloud Run — **PR #67**

---

## Totals

- **4 waves**, **31 merged PRs** between 2026-04-18 and 2026-04-21
- **6 fix(auth/obs/chat-safety) P0 closeouts**: #50, #57, #58, #62, #64 — plus #39 for P2P server-side
- **5 feat PRs**: #36 (design), #43 + #44 (P2P UX + protocol), #47 (offline outbox), plus the pre-wave design system
- **Every PR is public on GitHub**: `https://github.com/R0llcre/WeaveNYC/pull/<N>`
