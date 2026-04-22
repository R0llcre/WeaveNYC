# TestFlight Rollout Plan — WeaveNYC iOS

TestFlight is Apple's official pre-release distribution channel. Used
right, it gives us 2–3 weeks of real-device, real-user feedback before
App Store launch. Used wrong, it eats App Store review time and blocks
submission. This doc is the plan.

**Prereqs**: `APPLE_ENROLLMENT.md` complete, `CERTIFICATES.md` EAS
credentials configured, first production build of v1.0.0 uploaded.

---

## 1. Timeline

| Week | Step | Gate |
|---|---|---|
| 8 | First prod build uploaded, internal TestFlight live | Build passes EAS, uploads to ASC |
| 8 (late) | Internal testing — team + product + design (≤100 testers) | No crashes, core flows work |
| 9 | External testing — 50 invited pilot users from PWA userbase | Apple TestFlight review (~24–48h) |
| 10 (early) | External expansion — open public link up to 10k testers | Stable metrics for 1 week |
| 10 (late) | Submit to App Store Review | No P0/P1 bugs in backlog |

Miss any gate by 48h and delay downstream ones; don't try to catch up by
skipping.

---

## 2. Internal testing (up to 100 testers, no Apple review)

Internal TestFlight is for anyone with a @weavenyc.org account or a user we
explicitly invite. **No Apple review required**; builds are available ~15
minutes after EAS uploads them.

### Who gets internal access

| Group | Headcount | Role in ASC |
|---|---|---|
| Engineering | ~6 | `App Manager` (can manage builds) |
| Product / ED | 2 | `Developer` (can install + leave feedback) |
| Design | 2 | `Developer` |
| Content / translation reviewers | 2 (EN / ES / ZH fluent) | `Developer` |
| Founding advisors | ≤3 | `Developer` |

Total: ≤15 at start; cap at 100 (Apple limit).

### How to invite

1. ASC → TestFlight → **Internal Testing** → **+** → create group
   `WeaveNYC Team`.
2. Add each tester's email (must be an Apple ID linked to their account).
3. TestFlight app on the tester's iPhone pulls the invite automatically;
   user taps "Install" and build appears.

### What to test internally

Smoke test every flow before external expansion:

- [ ] Cold start → home wizard renders in user's system language.
- [ ] Resource search by ZIP returns results within 3 seconds on LTE.
- [ ] "Open now" pill matches provider hours.
- [ ] Anonymous post composer submits.
- [ ] Sign in with Apple completes first time.
- [ ] Magic-link sign-in (email) completes.
- [ ] Phone OTP sign-in completes.
- [ ] Push notification arrives on new chat message (send one from a 2nd
      device).
- [ ] Universal link: iMessage
      `https://weavenyc.org/resources/<known-id>` → tap opens native app.
- [ ] Offline: airplane mode → compose post → come online → outbox drains
      within 30 sec.
- [ ] Language switcher: EN → ES → ZH round-trip preserves all content.

Log every bug in `docs/pilot-checklists/ios-testflight-internal.md` (create
in wave B); P0/P1 block external expansion.

---

## 3. External testing (up to 10,000 testers, Apple reviews once)

External TestFlight exposes the build to people outside the team. **Apple
reviews the first external build** of each major version (~24–48h). Once
approved, subsequent builds on the same version track go live immediately
for up to 90 days.

### Who we recruit for the first 50 beta slots

Source: existing PWA userbase. The PWA has been live since week 2; we have
~200 unique monthly users (as of week 7 metrics dashboard). Pick the 50 with
the best signal:

| Selection criterion | Why |
|---|---|
| Signed in (phone or email) | We can email them |
| ≥3 sessions in last 30 days | Engaged, likely to report bugs |
| Diverse neighborhoods (≥4 of 5 boroughs) | Coverage |
| Mix of languages used | Catches i18n regressions |
| At least 10 anchor-role users | Test the moderator side |

Email template: see `apps/mobile/release/templates/beta-invite-email.md`
(to be drafted in wave B, week 9).

### How external TestFlight works

1. In ASC → TestFlight → **External Testing** → create group `WeaveNYC Pilot`.
2. Invite via **email** *or* **public link**:
   - **Email invite**: paste email addresses; each gets a TestFlight invite
     from Apple. Best for the first 50 curated testers.
   - **Public link**: ASC generates a single URL like
     `https://testflight.apple.com/join/AbCdEfGh`. Share anywhere. Testers
     self-onboard. Good for later expansion to 10k.
3. Add a **tester build feedback email** so feedback goes to
   `ios-beta@weavenyc.org` (alias → engineering Slack).

### Apple review of the first external build

What they check (~24–48h):

- Crash-free launch on a reviewer's physical device.
- No obviously broken UI / stubbed-out screens.
- No misleading metadata.
- Permissions prompts make sense (see `REVIEWER_NOTES.md` §3).

**If rejected**: Apple emails a rejection reason to the Team Agent's Apple
ID. Fix → rebuild → re-submit. Each reject burns a day, so pre-check with
the internal group before pushing to external.

### What we test externally

Metrics to watch (Sentry + app analytics):

| Metric | Target | Break-glass |
|---|---|---|
| Crash-free sessions | ≥ 99.5% | < 98% triggers build pause |
| Median cold-start time | < 2.5s | > 4s triggers investigation |
| Push-receive latency (send → notify) | < 30s | > 60s |
| Offline outbox drain success | ≥ 98% | < 95% |
| Sign-in completion rate | ≥ 85% | < 75% |
| Universal-link open rate (taps → native open) | ≥ 90% | < 75% → AASA issue |

Weekly async review of these numbers. If anything is in break-glass, pause
the external track (don't push new builds) until fixed.

---

## 4. Bug-bounty-lite via Slack

Spin up a Slack workspace channel for external testers who want to go deep.

| Channel | Purpose | Headcount |
|---|---|---|
| `#weave-ios-beta` | External tester ↔ engineering chat | Up to 10k, realistically ~20 active |
| `#weave-ios-beta-private` | Engineering-only triage of incoming reports | ~6 |

Invite process: in the TestFlight "What to test" field, include:

> Found a bug or have an idea? Join our beta Slack: <invite link>.
> Or email `ios-beta@weavenyc.org`.

Rotate the Slack invite link every 30 days (standard invite-link hygiene)
so ex-testers who leave the TestFlight group can't lurk indefinitely.

### Triage SLAs

| Severity | SLA to first response | SLA to fix or close |
|---|---|---|
| P0 (crash on launch, auth broken, data loss) | < 4h | < 24h |
| P1 (core flow broken for a segment) | < 24h | < 1 week |
| P2 (minor; workaround exists) | < 1 week | Prioritized in backlog |
| P3 (polish, nice-to-have) | Acknowledged in thread | Backlog |

---

## 5. Promoting from TestFlight → App Store

When all external metrics hold for 7 consecutive days:

1. Freeze the codebase (tag a release branch).
2. Run final checks:
   - `eas build --profile production --platform ios` (fresh binary).
   - Smoke test on a physical device via TestFlight.
   - Verify AASA (`curl -sI ...`) still 200 + `application/json`.
3. `eas submit --platform ios --profile production` (or let the
   `mobile-build.yml` `--auto-submit` flag handle it).
4. In ASC → **Add for Review** → paste copy from `APP_STORE_LISTING.md`,
   screenshots from `ASSETS.md`, reviewer notes from `REVIEWER_NOTES.md`.
5. Submit for App Store review.
6. Typical review: 24–72h.
7. On approval, choose **Manual release** (not auto) so we control the
   go-live moment.

---

## 6. Graceful failure — TestFlight goes sideways

### If external review rejects us

1. Don't retry immediately. Read the entire rejection email carefully.
2. If it cites a specific guideline (e.g. "4.8 — no SIWA"), fix the code
   on a `hotfix/` branch, land it through `mobile-build.yml`.
3. Reply to Apple in ASC → Resolution Center with:
   - Exactly what we changed.
   - Line / file references.
   - New build number that includes the fix.
4. They re-review. Usually a day or two.

### If a metric goes break-glass during external testing

1. Pause new external builds (TestFlight setting → "Stop accepting new
   testers" + don't push new builds).
2. Existing testers keep the old build and can still use it.
3. Fix, ship a new internal build, smoke in internal group, then re-open
   external.

### If a tester reports data loss

Treat as P0 regardless of apparent impact. Full incident response per
`docs/11_Ops_Runbook.md` (existing doc, not this wave).
