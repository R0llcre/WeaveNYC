# WeaveNYC — Live Demo Script (10 Scenes · ~12 minutes)

Keep this doc open on your second monitor. Every scene has: duration · what to click · what to say.

> **Hook (do not skip)**: "WeaveNYC is a privacy-first mutual-aid platform for NYC's most vulnerable communities. In the next 12 minutes I'll show you four clouds, one PWA, zero Potemkin — and the audit trail that proves it."

Legend: **MONEY SHOT** = the one slide that earns the deck. **RISK DEMO** = a thing that could fail live; have a fallback screenshot ready.

---

## Scene 0 — Hook + the multi-cloud proof (60s)

**Duration**: 60s
**Click**: Your terminal, on the WeaveNYC repo root. Run:
```bash
pnpm demo:multicloud
```
**Say**: "Before I show any UI, here's the infrastructure. Six rows, all green, one second. Cloudflare is serving the PWA and the anchor admin. AWS App Runner is serving the API. GCP Cloud Run is serving the resource directory. Azure Container Apps is serving notifications. Every row is a different cloud responding to a different HTTPS endpoint. You'll see this table again — keep the green rows in mind."

---

## Scene 1 — Open the PWA (60s)

**Duration**: 60s
**Click**: `https://weavenyc.org` in incognito (clean cache).
**Say**: "This is the resident-facing PWA. Installable on iOS and Android without an app store — important for communities where people don't want to register in Apple's or Google's directory just to get groceries. Fraunces serif, vermillion accent — we call it 朱砂, cinnabar — editorial voice, not Big-Tech-blue sterile." *(Scroll down; show the resource directory tab.)*

---

## Scene 2 — Resource directory: the breadth demo (90s)  ·  **MONEY SHOT**

**Duration**: 90s
**Click**: Tap the Resource Directory tab → enter ZIP `11368` (Queens Corona) → watch results render.
**Say**: "Type in a ZIP. The PWA on Cloudflare calls the API on App Runner, which forwards to a resource-directory service on Cloud Run — routed through a Cloudflare Worker proxy at `resource-dir.weavenyc.org` so the Cloud Run URL is never directly public. The data came from real upstream sources: CFC, Island Harvest, NYC OpenData. Three covered ZIPs today, three communities, real addresses, real phone numbers, real hours. This is the breadth story: one tap, four clouds, one answer in under half a second."

---

## Scene 3 — Publish a post (60s)

**Duration**: 60s
**Click**: Tap the Post tab → write "Need help moving Sunday, Bronx Hunts Point area". Publish.
**Say**: "A resident publishes a help-request. The post goes through the anchor-review queue — more on that in Scene 5. But watch what happens if I go offline." *(Turn off WiFi on the phone.)* "Compose another post, hit publish — it goes to the offline outbox. That's PR #47. When I come back online, it flushes." *(Turn WiFi back on.)* "Subway-safe writes. This matters because our pilot communities actually ride the subway."

---

## Scene 4 — P2P sync between two phones (90s)  ·  **RISK DEMO**

**Duration**: 90s
**Click**: Open `https://weavenyc.org` in a second browser profile (or second phone if you have two). In profile A, create a community-local post. In profile B, wait for the sync indicator.
**Say**: "Two browsers, same community, different sessions. The P2P sync protocol delivers community-local state without routing every message through the central API. PR #44 added protocol versioning so old clients and new clients can coexist during rollout. This is the privacy surface — if your community's post never needs to leave your community, it doesn't." *(If the live demo hangs, cut to screenshot. This is the most likely scene to fail live.)*

---

## Scene 5 — Anchor admin reviews (75s)

**Duration**: 75s
**Click**: Open `https://admin.weavenyc.org` in a separate tab. Log in as Queens anchor (pre-provisioned test account). Open review queue. Approve the post from Scene 3.
**Say**: "Every community has a human anchor — the trusted neighbor who signs an MOU and runs the moderation queue. They get TOTP. They see the post, the reporter history, the safety flags. They click approve. This is the social fabric layer: technology enforces the rules, humans enforce the norms."

---

## Scene 6 — Chat safety in action (75s)  ·  **RISK DEMO**

**Duration**: 75s
**Click**: In the PWA, start a chat. Send "call me at +1-212-555-0123". Watch it get blocked with a human-readable reason.
**Say**: "We block E.164 phone numbers, Luhn-valid bank account numbers, and a hate/harassment blocklist. Server-side. That's PR #57. The user sees why. If someone blocks an abuser, PR #58 severs the abuser's live WebSocket — they can't keep sending on an already-authenticated connection." *(If the block message doesn't render live, show the chat-safety E2E report instead.)*

---

## Scene 7 — Observability (60s)

**Duration**: 60s
**Click**: Open a terminal: `curl -s https://api.weavenyc.org/readyz | jq`. Then: `curl -s https://api.weavenyc.org/metrics | grep http_requests_total`.
**Say**: "Every service exposes `/readyz` and `/metrics`. Five deep probes — Postgres, Redis, chat realtime, P2P sync, JWT sign-verify. Prometheus-text metrics with route-labelled counters — cardinality bounded to the registered Fastify schema per PR #64. `pino` redacts tokens and PII before logs hit CloudWatch. Sentry's `beforeSend` runs a second pass that drops events containing E.164 phones or Luhn-valid bank numbers — even if they leak into a stack trace." *(Optionally flip to [`docs/demo-evidence/metrics-snapshot.md`](./demo-evidence/metrics-snapshot.md).)*

---

## Scene 8 — The audit trail (90s)

**Duration**: 90s
**Click**: Open [`docs/demo-evidence/commit-timeline.md`](./demo-evidence/commit-timeline.md) on the projector. Scroll through the 4 waves.
**Say**: "31 merged PRs in 4 review waves over 4 days. Every PR has a public GitHub hash and a merge commit. Eight reviewers, four areas each round, four rounds. The audit reports are in [`docs/demo-evidence/audit-archive/`](./demo-evidence/audit-archive/) — every P0 and P1 finding is linked to the PR that closed it. Every downgrade is named — Sentry DSN not yet provisioned, Prometheus scraper not yet deployed — those are first-week-of-pilot work. Everything else shipped."

---

## Scene 9 — Known gaps + closing (45s)

**Duration**: 45s
**Click**: Open [`docs/demo-evidence/known-gaps.md`](./demo-evidence/known-gaps.md).
**Say**: "Here's what we **don't** ship. No native app — PWA only. No payments. No push notifications yet. Three ZIPs, not five. Zero real pilot users — we are gated on three MOU signatures. Every code path connects to a real production backend. Flipping go-live is one environment variable."

---

## Closing — "Do you have real users?"

> "No. Every code path connects to real production backends. The three MOU signatures are our only remaining gate. Today we can prove the system works end-to-end, across four clouds, under an 8-person audit with a full paper trail. When the first anchor activates TOTP in production, the counters in [`metrics-snapshot.md`](./demo-evidence/metrics-snapshot.md) start moving. Everything you saw in the last 12 minutes is live. The pilot is a partner-signature away, not a code deploy away."
