# WeaveNYC Pilot — On-Call Runbook (Reality Edition)

Status: current as of 2026-04-20. Supersedes the aspirational rotation described in `docs/11_Ops_Runbook.md §6` for the pilot period.

> **Honest framing.** WeaveNYC is an NYU student-led pilot. We do not have 24/7 engineering coverage, a PagerDuty tier, or a formal rotation. This document describes the *actual* arrangement so anchors who sign the MOU know what to expect and the single engineer knows when they can sleep.

---

## 1. The arrangement

- **Primary on-call:** a single engineer (the current maintainer of `main`). No rotation during the six-month pilot — the same person carries the phone throughout.
- **Expected acknowledgement**
  - Business hours (Mon-Fri 09:00-19:00 ET): best effort, target **15 minutes**.
  - Off-hours (evenings, weekends, holidays): best effort, target **30 minutes** — but see §5 on what "best effort" actually means at 03:00 on a Sunday.
- **No phone SLA.** The MOU (`docs/pilot-checklists/mou-template-en.md §4.2`) uses the language "target acknowledgment"; this is not a contractual promise of 24/7 engineering coverage. If we cannot meet the target, we communicate that fact to the affected anchor by email within the next business day.

---

## 2. Contact ladder

Use the first channel that is available and move to the next if the primary does not acknowledge within 15 minutes.

1. **Primary engineer** — on-call pager (email + text as configured in `oncall@weavenyc.org`). Slack DM to the engineer's handle is the fastest channel.
2. **Project lead** — the NYU faculty advisor / student lead listed in the MOU's primary contact slot. Same channels; do not expect an immediate engineering response but decisions about user-facing communication route through the lead.
3. **Community anchors** — the anchor admin accounts for Farmingdale, Queens Corona, Bronx Hunts Point. Loop them in for incidents that require moderator action (takedown, site-wide announcement, pausing writes) but not for pure infra failures.
4. **Backup engineer** — there is no formal backup. If the primary is unreachable for >90 minutes, the project lead decides whether to pause the service (see §4) until the primary is available.

All of the above also exists in the MOU under §4.2 ("Incident response") — the MOU intentionally refers to this document for the full ladder.

---

## 3. What counts as a page

Only these warrant an out-of-hours interrupt. Other findings get a morning-meeting write-up.

| Severity | Trigger | Expected first action |
|---|---|---|
| **P0** | Total outage (`/readyz` red on all five services > 10 min), confirmed data leak, safety incident (threat to an anchor or resident), moderation backlog > 200 unreviewed reports | Ack in ≤ 15m / ≤ 30m per §1; follow `docs/11_Ops_Runbook.md §7.x` playbooks; post to public status page within 30 min. |
| **P1** | Single service degraded > 15 min, 5xx rate > 5% sustained, anchor dashboard unusable | Ack during business hours within 2h; no phone call at 03:00. |
| **P2** | UI glitch, single-user report, metrics dashboard flake | Next business morning, no page. |

Downgrading is ENCOURAGED. A false P0 costs trust and sleep. If you're not sure, default to P1 and re-evaluate after a full status check.

---

## 4. Off-hours behaviour ("best effort")

If the pager goes off at 02:00 on a Sunday:

1. Acknowledge if you can. Even a "seen, triaging" post counts as acknowledgement for MOU purposes.
2. Do `curl https://api.weavenyc.org/readyz | jq .checks` and `curl https://resources.weavenyc.org/resources?zip=11735 -o /dev/null -w '%{http_code}\n'` as the 30-second triage.
3. If the fix is scriptable via `scripts/ops/reset-to-last-good-image.sh` or a CF Pages rollback (`wrangler pages deployment rollback`), do it. This is the happy path.
4. If the fix is not obvious in 10 minutes, **pause writes and sleep**:
   ```bash
   # Tell the pwa to show a banner. The exact mechanism is the
   # server-config toggle documented in docs/11_Ops_Runbook §7.x.4.
   # Anchors receive the SMS template in docs/29_M8_Pilot_Readiness §4.3.
   ```
   A night of read-only mode is less bad than a sleep-deprived code edit. File a P0 in the tracker for morning handling.
5. Email `oncall@weavenyc.org` with a one-line timeline. The project lead may choose to notify anchors in the morning.

**Explicit expectation:** the MOU does not promise that a human will be actively fixing the system at 02:00. It promises we'll try, communicate if we can't, and land the fix during business hours the following day.

---

## 5. What MOUs can and cannot say

- ✅ "Target acknowledgement of 15 minutes during business hours; 30 minutes off-hours, on a best-effort basis."
- ✅ "Incident notifications sent via email to the anchor's primary contact within the next business day."
- ❌ "24/7 on-call rotation."
- ❌ "Guaranteed 15-minute response at any time."
- ❌ "PagerDuty / formal SRE escalation."

The MOU template now reflects these limits. Signed MOUs must match the text in `docs/pilot-checklists/mou-template-en.md §4.2` — anchors should not be promised anything beyond it.

---

## 6. Monthly check-in (instead of a rotation)

Because we don't rotate, we compensate with transparency:

- Once a month, the primary engineer publishes an "on-call summary" to the shared drive: number of pages, ack times vs. target, anything that had to wait until the next morning.
- If the primary is going to be unavailable for more than 3 consecutive days (vacation, exams, illness), post it in the project channel at least 72h ahead and put the PWA into read-only mode if no substitute is available.
- The project lead uses these summaries to decide whether the pilot needs a second engineer before extending into a year-two rollout.

---

## 7. Quick links

- `docs/11_Ops_Runbook.md §7` — playbooks for specific failure modes.
- `docs/29_M8_Pilot_Readiness.md §3` — rollback SOP (scripts, commands).
- `docs/29_M8_Pilot_Readiness.md §4` — user-facing incident templates (status page, SMS, banner).
- `scripts/ops/reset-to-last-good-image.sh` — App Runner rollback (A8 P0-4).
- `scripts/ops/incident-snapshot.ts` — dumps the state we want to see in a postmortem.
