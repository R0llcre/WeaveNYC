# WeaveNYC — Partner Playbook (Anchor SOP)

Operational playbook for bringing a real NYC community onto WeaveNYC. Written so a new team member can execute without asking questions. Target: one day, one community, from cold email to live TOTP anchor.

Companion files:
- Per-community checklists: [`pilot-checklists/farmingdale.md`](./pilot-checklists/farmingdale.md), [`pilot-checklists/queens.md`](./pilot-checklists/queens.md), [`pilot-checklists/bronx.md`](./pilot-checklists/bronx.md)
- MOU templates: [`pilot-checklists/mou-template-en.md`](./pilot-checklists/mou-template-en.md), [`pilot-checklists/mou-template-zh.md`](./pilot-checklists/mou-template-zh.md)
- KPI queries: [`pilot-checklists/kpi-queries.sql`](./pilot-checklists/kpi-queries.sql)
- Go / No-Go + rollback: [`29_M8_Pilot_Readiness.md`](./29_M8_Pilot_Readiness.md)

---

## 1) Who we onboard

We recognize three partner tiers. Same product, different commitments.

### Tier A — Anchor (signs MOU, activates TOTP)
A local, trusted organization that runs one community node on WeaveNYC. One active anchor per community at a time (enforced by `uq_anchors_active_community`).

Selection bar:
- Has a physical location that residents already visit (pantry, church, community center, food bank)
- At least one paid staffer or long-standing volunteer who can commit ~1 hour/week for six months
- Serves the target ZIP as a primary service area (not a catchment that happens to include it)
- Is comfortable with a public-facing digital account and 2FA
- No conflict of interest with the project team

Anchor responsibilities — contractually binding via MOU:
- Publish announcements (pantry hours, drives, closures, PSAs)
- Review posts that land in `pending_review` within 24 hours
- Triage reports; use block / hide / takedown as appropriate
- Attend a weekly 30-minute check-in during the first month

### Tier B — Outreach Partner (no MOU, no admin access)
Organizations that help us reach residents but do not run the community node. Flyer distribution, tabling, co-posting on social, translating materials. They get an outreach kit and a named point of contact on the project team. They do not get admin credentials.

### Tier C — Advisory (no MOU, no operational role)
Researchers, civic tech folks, attorneys, clinicians who can answer a specific question quickly. Kept in a private Slack channel. We ask; they advise; they do not own anything.

Rule: if anyone other than the Anchor asks for admin access, the answer is no. The product enforces this via [migration `0006_m5_anchor_admin.sql`](../packages/db/migrations/0006_m5_anchor_admin.sql).

---

## 2) Anchor recruiting SOP (5 steps, approx 2-week window)

Fixed sequence. Do not skip a step to compress the timeline.

### Step 1 — Shortlist + warm intro (Day 0 to Day 2)
Output of this step: a list of 3 to 5 candidate organizations for the target ZIP, ranked, with a named human to contact.

Actions:
1. Pull the Food Bank For NYC directory (https://www.foodbanknyc.org/get-help/), the `NYC Food Resource Guide` for the neighborhood, and the per-community checklist in this repo for seed candidates.
2. Cross-check with 311 open data / findhelp.org for active status (hours in last 30 days).
3. Rank by the Tier A selection bar above.
4. Prefer a warm intro. If none is available, send a cold email from the Step 2 template.

### Step 2 — First contact (Day 2 to Day 4)
Output: a scheduled 30-minute call and a named point of contact.

Use the cold-email template in the per-community checklist. Do not cold-call pantries during distribution hours. One email, one polite follow-up three business days later, then stop.

### Step 3 — Alignment call (Day 4 to Day 7)
Thirty minutes. Fixed agenda — do not improvise:
1. Five-minute who-we-are, including that this is a student project and what that means for longevity.
2. Ten-minute live demo on a staging URL. Show: resident home, post composer, an anchor review decision.
3. Five-minute walkthrough of anchor responsibilities from section 1.
4. Five-minute data and privacy summary, grounded in the MOU template.
5. Five-minute questions and scheduling.

At the end of the call, send the MOU PDF (EN or ZH) plus a one-page FAQ.

### Step 4 — MOU signature + training (Day 7 to Day 11)
Output: a signed MOU (PDF with wet or e-signature), an agreed go-live date, and a scheduled 60-minute training.

Training covers (screen-share, recorded with their consent so they can replay):
- Redeeming the anchor invite code
- Activating TOTP (authenticator app) and storing recovery codes
- First announcement (dry-run, not published)
- First review-queue decision (dry-run)
- First report resolution (dry-run)

### Step 5 — TOTP activation on production (Day 11 to Day 14)
Output: an anchor account in `status = 'active'`, one `anchor_activated` analytics event, a smoke-tested live admin session.

Exact commands — see the per-community checklist for invite generation. After the anchor completes activation in the production environment, the team on-call verifies:
- `anchor_activated` event in `analytics_events` for the community
- Anchor admin dashboard loads at `admin.weavenyc.org`
- Anchor can publish a test announcement and immediately delete it

If any of these fail, do not invite residents. Loop back to Step 4.

---

## 3) Day-1 / Day-7 / Day-30 rhythm

Same cadence for every community. Project lead is accountable for all items.

### Day 0 — Soft launch (the day we flip residents on)
- 10:00 — anchor posts pinned welcome announcement (template in per-community checklist)
- 10:15 — project team posts to partner's Instagram / WeChat group / Nextdoor
- 10:30 — tabling at partner location if logistically possible
- Staffing: one on-call engineer + one community lead for four hours, both on Slack
- Success signal: at least three verified users, at least one post, zero P0 incidents

### Day 1 — First 24 hours
- Morning: on-call engineer checks `analytics_events`, Sentry, service health
- Noon: 15-minute sync call with anchor (by phone) — any confusion? any scary posts?
- End of day: quick Slack thread summarizing signups, posts, any reports

### Day 7 — First retro (30 minutes with anchor)
Run the Day-7 questions from the per-community checklist. Rule: if the anchor is overwhelmed, reduce the review load by tightening `review_categories` in the ruleset. Do not add features.

### Day 30 — Decision checkpoint
Run the KPI dashboard queries in [`kpi-queries.sql`](./pilot-checklists/kpi-queries.sql) for the community. Apply the Day-30 decision matrix in the per-community checklist: continue, pivot, or shut down.

---

## 4) Go / No-Go gate (before inviting real users)

Hard gate. All twelve items must be green. If any are red or yellow, do not invite real users. Use the anchor account to continue rehearsing.

See the canonical checklist in [`29_M8_Pilot_Readiness.md §1`](./29_M8_Pilot_Readiness.md#1-gono-go-checklist). Summary:

- [ ] M8 code freeze passed (`main` build green, no uncommitted infra)
- [ ] 8-person review: zero open findings
- [ ] Cloudflare Pages: `weavenyc.org` and `admin.weavenyc.org` reachable and serve the current commit hash
- [ ] AWS API gateway: `api.weavenyc.org/healthz` returns 200
- [ ] GCP resource-directory: `resources.weavenyc.org` returns 200
- [ ] Azure notifications: `notify.weavenyc.org` internal health returns 200
- [ ] All three community anchors have signed MOUs on file
- [ ] All three anchors have activated TOTP in production
- [ ] Sentry receiving events from all five services in the last 24 hours
- [ ] Prometheus scraping `/metrics` endpoints successfully
- [ ] First ten internal test users have completed the happy path end-to-end
- [ ] Pilot rollback SOP has been exercised once in staging

---

## 5) Escalation paths

Single on-call rotation. Every community has one accountable anchor and one accountable team member.

| Severity | Examples | First call | Second call | Response target |
|---|---|---|---|---|
| P0 | Service outage; data leak suspected; harassment in-flight; minor-involved report | On-call engineer (`oncall@weavenyc.org`) | Project lead | Ack within 15 min, 24/7 |
| P1 | Single-user error rate spike; moderation queue > 10 items > 24h; anchor locked out | On-call engineer | Community lead | Ack within 2 hours, business hours |
| P2 | UI bug; typo; non-urgent feature request | Issue tracker | N/A | Weekly triage |

### When the anchor goes dark
If an anchor misses two consecutive weekly check-ins or leaves the moderation queue unattended for > 48 hours:
1. Project lead calls the anchor's personal phone.
2. If no response in 24 hours, temporarily raise the `auto_hide_report_threshold` to 1 so reports auto-hide on first flag.
3. If no response in 72 hours, run `UPDATE anchors SET status = 'revoked' WHERE community_id = ...` after project lead sign-off, then pause the community (see rollback SOP).

### Security incident
Immediately route to the Ops Runbook [§7 Incident Response](./11_Ops_Runbook.md#7-incident-response-standard-operating-procedure). Do not post to Slack channels before the on-call engineer confirms scope.

### User-reported safety concern
If a resident reports imminent harm (violence, trafficking, exploitation), project lead contacts NYC 311 / 911 as appropriate. Product-side: invoke the takedown API, preserve the audit log, notify the anchor, and do not delete any records until the incident is closed.

### Media or press
All press routes through project lead. Anchors are not authorized spokespeople for WeaveNYC (this is explicit in the MOU).
