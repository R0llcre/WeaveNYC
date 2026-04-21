# WeaveNYC — M8 Pilot Readiness (Go/No-Go + Rollback SOP)

Status: `M8 Pilot Readiness — in progress`

Purpose: gate the transition from rehearsal to real pilot users, and document the rollback SOP to be exercised before go-live.

Companion docs:
- [`05_Partner_Playbook.md`](./05_Partner_Playbook.md) — anchor recruitment and onboarding
- [`pilot-checklists/`](./pilot-checklists/) — per-community checklists, MOU templates, KPI queries
- [`11_Ops_Runbook.md`](./11_Ops_Runbook.md) — general ops SOPs
- [`19_Deployment_Guide.md`](./19_Deployment_Guide.md) — environment matrix and secrets

---

## 1) Go/No-Go Checklist

All twelve items must be checked (green) before inviting real pilot users. If **any** item is unchecked or yellow, do not invite users — rerun the relevant step and re-verify.

- [ ] **M8 code freeze passed** — `main` build green for the last 48 hours, no uncommitted infra drift, no open P0/P1 tickets
- [ ] **8-person review** — zero open review findings on the current pilot branch
- [ ] **Cloudflare Pages deployed** — `weavenyc.org` and `admin.weavenyc.org` reachable, serve the current commit hash, Lighthouse accessibility >= 90
- [ ] **AWS API gateway deployed** — `api.weavenyc.org/healthz` returns 200 with the expected version string
- [ ] **GCP resource-directory deployed** — `resources.weavenyc.org` returns 200 and `/resources?zip=11735` returns a non-empty result
- [ ] **Azure notifications deployed** — `notify.weavenyc.org` internal health returns 200; one test SMS + one test email successfully delivered end-to-end
- [ ] **3 community anchors have signed MOU** — Farmingdale (11735), Queens Corona (11368), Bronx Hunts Point (10474); PDFs stored in the shared team drive with both signatures
- [ ] **Per-community `contacts_to_confirm` resolved** — each of [`pilot-checklists/farmingdale.md`](./pilot-checklists/farmingdale.md), [`pilot-checklists/queens.md`](./pilot-checklists/queens.md), [`pilot-checklists/bronx.md`](./pilot-checklists/bronx.md) has a `contacts_to_confirm` block at the top. Every row must be filled with real, confirmed values (not placeholders, not `TBD`). Farmingdale-specific blockers: `ministry@stkilianparish.org` is a guessed address and the Day-0 launch date is `TBD` — both must be confirmed before Farmingdale go-live.
- [ ] **3 anchors have activated TOTP in production** — `anchor_activated` event exists in `analytics_events` for each of the three communities, and `anchors.status = 'active'` for each
- [ ] **Sentry SDK wired and DSN provisioned (downgraded)** — each of api-gateway, posts-service, match-service, chat-service, resource-directory, notifications-service has the Sentry SDK imported and a DSN available in Secrets Manager / Secret Manager / Key Vault. The stricter gate ("Sentry receiving events from all 5 services") has been downgraded for go-live (A8 P0-3): a real DSN was not yet provisioned in pilot secrets as of 2026-04-20. Acceptance: first Sentry event captured within **48 hours of go-live** via an artificial 4xx trigger per service; documented in the deploy log.
- [ ] **`/metrics` endpoint live and verified by curl (downgraded)** — each runtime exposes `/metrics` (Prometheus text) and a manual `curl` from a maintainer laptop returns >= 10 non-empty lines. The stricter gate ("Prometheus scraping `/metrics`") has been downgraded for go-live (A8 P0-3): no Prometheus server is provisioned in the pilot environment. Scraper deployment is deferred to the **first week of pilot** (tracked under W4D); on-call uses manual `curl /metrics | promtool query instant` as the interim check per `docs/11_Ops_Runbook.md §H.2`.
- [ ] **First 10 test users run through happy path** — pick ZIP → browse resources → create account → publish one post → anchor approves → contact request → match success; zero P0 incidents during the dry run
- [ ] **Pilot rollback SOP tested once in staging** — Section 3 below was exercised end-to-end against the staging environment and the run was documented in the deploy log

---

## 2) Decision Matrix — If an Item Fails

The default answer to any failed gate is "do not go live." Use the matrix below to pick the corrective path.

| Failed item | Category | Corrective action | Who decides |
|---|---|---|---|
| Code freeze / review findings | Code quality | Freeze new work. Cherry-pick fixes into a hotfix branch. Re-run CI. | Project lead |
| CF Pages / API / resource-directory / notifications health | Infra | Roll back to previous known-good deploy (see Section 3). Investigate root cause before re-deploying. | On-call engineer |
| Sentry SDK / DSN missing | Observability (downgraded gate — A8 P0-3) | Verify the SDK import exists in the service entrypoint and provision a DSN in the platform secret store. Go-live is OK with DSN + SDK wired; acceptance remains first-event-within-48h via an artificial 4xx. | On-call engineer |
| `/metrics` endpoint missing or empty | Observability (downgraded gate — A8 P0-3) | Verify `/metrics` returns Prometheus text with >= 10 lines via manual `curl`. Scraper deployment is deferred to pilot week 1; do not block go-live on Prometheus infrastructure alone. | On-call engineer |
| Anchor MOU unsigned | Partner | Call anchor. If anchor declines, pause that specific community and launch the other two. A two-community launch is acceptable. | Project lead |
| Anchor TOTP not activated | Partner + security | Re-run the per-community activation walkthrough. Do not launch that specific community until activation is confirmed. | Community lead |
| 10-user happy path hit a P0 | Safety | Do not launch any community. File the bug, fix, re-run the full 10-user happy path. | Project lead |
| Rollback SOP untested | Ops | Run the SOP in staging now. Document evidence. | On-call engineer |

Two-community launch rule: we may launch with 2 of the 3 communities if the third is blocked by a partner issue (MOU not signed, anchor not activated). Do not launch with only 1 community — an n=1 pilot cannot distinguish product issues from community issues.

---

## 3) Rollback SOP

Exercise this entire SOP in staging once before go-live. Document the run (timestamps, commands, screenshots) in the deploy log.

### 3.1 Decide whether to roll back
Triggers that demand an immediate rollback:
- P0 incident (safety, data leak, outage > 10 minutes)
- 500-error rate > 5% sustained over 5 minutes on any service
- Partner anchor reports they cannot use the dashboard and no forward-fix is available in 30 minutes
- Security team (project lead + on-call) agrees

Triggers that do **not** demand rollback (fix forward instead):
- Single user reporting a UI glitch
- Moderation queue length high (not a deploy issue)
- Observability noise without a matching user-visible symptom

### 3.2 Announce
Before touching anything:
1. On-call engineer posts to `#incident` in Slack: `ROLLBACK STARTING — <service> — <reason> — <runbook link>`.
2. Project lead posts the user-facing status message (Section 4.2) to the WeaveNYC status page and resident-app banner.
3. Community lead messages each anchor by SMS: "We are rolling back a bad deploy. No action needed. We'll update in 15 minutes."

### 3.3 Cloudflare Pages rollback (weavenyc.org, admin.weavenyc.org)
Two paths.

**Path A — Dashboard (preferred when you want to see history):**
1. https://dash.cloudflare.com → Workers & Pages → `weavenyc-pwa` (or `weavenyc-anchor-admin`)
2. Deployments tab → locate the last known-good deployment (previous commit hash) → "..." menu → **Rollback to this deployment**.
3. Cloudflare promotes that deployment to production within seconds. Verify by opening an incognito window and checking the commit hash in the footer.

**Path B — Wrangler CLI:**
```bash
# List deployments for the project
wrangler pages deployment list --project-name weavenyc-pwa

# Roll back to a specific deployment ID
wrangler pages deployment rollback <deployment-id> --project-name weavenyc-pwa

# Do the same for admin.weavenyc.org
wrangler pages deployment list --project-name weavenyc-anchor-admin
wrangler pages deployment rollback <deployment-id> --project-name weavenyc-anchor-admin
```

Verify: `curl -sSfL https://weavenyc.org | grep -o 'data-commit="[a-f0-9]\{7\}"'` returns the rolled-back hash.

### 3.4 AWS App Runner rollback (api.weavenyc.org)
App Runner automatically retains the previous service image. Roll back by pointing the service at the previous image tag.

```bash
# Locate the previous image tag (ECR or your registry)
aws ecr describe-images \
  --repository-name weavenyc-api-gateway \
  --region us-east-1 \
  --query 'sort_by(imageDetails,&imagePushedAt)[-3:].{tag:imageTags[0],pushed:imagePushedAt}'

# Update the App Runner service to the previous tag
aws apprunner update-service \
  --service-arn "$APPRUNNER_SERVICE_ARN" \
  --source-configuration "ImageRepository={ImageIdentifier=<previous-tag>,ImageRepositoryType=ECR}"

# Wait until Status is RUNNING
aws apprunner describe-service --service-arn "$APPRUNNER_SERVICE_ARN" \
  --query 'Service.Status'
```

Verify: `curl -sSfL https://api.weavenyc.org/healthz` returns 200 and the expected prior version string.

### 3.5 GCP Cloud Run rollback (resources.weavenyc.org)
Cloud Run keeps all prior revisions. Roll back via traffic split.

```bash
# List revisions
gcloud run revisions list \
  --service weavenyc-resource-directory \
  --region us-east1

# Shift 100% of traffic to the previous known-good revision
gcloud run services update-traffic weavenyc-resource-directory \
  --region us-east1 \
  --to-revisions "<previous-revision>=100"

# Confirm
gcloud run services describe weavenyc-resource-directory \
  --region us-east1 \
  --format='value(status.traffic[].revisionName,status.traffic[].percent)'
```

Verify: `curl -sSfL 'https://resources.weavenyc.org/resources?zip=11735'` returns a non-empty result set.

### 3.6 Azure Container Apps rollback (notify.weavenyc.org)
Container Apps revisions behave like Cloud Run — multiple revisions can exist and traffic is split explicitly.

```bash
# List revisions
az containerapp revision list \
  --name weavenyc-notifications \
  --resource-group weavenyc-prod

# Activate the previous revision if it was deactivated
az containerapp revision activate \
  --name weavenyc-notifications \
  --resource-group weavenyc-prod \
  --revision <previous-revision>

# Shift 100% traffic back
az containerapp ingress traffic set \
  --name weavenyc-notifications \
  --resource-group weavenyc-prod \
  --revision-weight <previous-revision>=100
```

Verify: internal health check returns 200; one test notification end-to-end.

### 3.7 Database migration rollback
Only relevant if the failed deploy shipped a migration. Most pilot deploys will not.

The rollback runner (A8 P0-4) reads the last-applied migration from the
`schema_migrations` tracking table and looks for a paired
`<filename>.rollback.sql` down file under `packages/db/migrations/`.
If the paired file exists, it runs inside a single transaction and the
`schema_migrations` row is removed. If it does NOT exist, the command
FAILS LOUD — forcing a pg_dump + restore path instead of silently
no-op'ing.

```bash
# From the repo root. DATABASE_URL must point at the production DB.
# The "--env production" flag is accepted for documentation symmetry
# but ignored: DATABASE_URL is authoritative.
DATABASE_URL="postgres://..." pnpm db:migrate:rollback --env production

# If the rollback step isn't reversible (e.g., dropped columns, altered enums),
# restore from the most recent pg_dump. See 11_Ops_Runbook §D.4 for the exact
# restore procedure.
pg_restore -h $DB_HOST -U weavenyc -d weavenyc_prod /backup/latest.dump
```

**Before you run this:** verify you have a fresh pg_dump from before the broken migration. If you don't, stop and call the project lead before touching the DB.

Recent risky migrations have paired down files:
- `0013_p2p_sync_compound_index.rollback.sql` — restores the 0009-era index shape.
- `0014_idempotency_keys.rollback.sql` — drops `idempotency_keys`, `uq_messages_client_dedup`, and related artifacts. Roll the application image BACK first, then run this rollback — the post-0014 code assumes the table exists.

### 3.7.1 App Runner image rollback (A8 P0-4)
For infra-only rollbacks (no schema change), pin the App Runner service to a known-good ECR tag:

```bash
# From the repo root. Accepts a bare tag, a short SHA, or a full
# <repo>-<sha> identifier. Prompts for confirmation unless
# WEAVENYC_NO_CONFIRM=1 is set.
scripts/ops/reset-to-last-good-image.sh v0.1.3
```

The script verifies the tag exists in ECR before touching the service, splices it into the live `SourceConfiguration`, and polls until the service returns to `RUNNING`. See `docs/11_Ops_Runbook.md §G.4` for invocation details.

### 3.8 Observability check
After rollback:
1. Re-run the smoke script: `pnpm test:smoke:real --base-url https://api.weavenyc.org`
2. Confirm `/readyz` checks are green:
   `curl -s https://api.weavenyc.org/readyz | jq .checks`
3. Sentry and Prometheus are partially deferred (see §1 downgrade notes and A8 P0-3). Interim:
   - `curl https://api.weavenyc.org/metrics | head` — confirm non-empty metrics output.
   - If Sentry DSN is provisioned, check the dashboard for new issues in the last 5 minutes.

### 3.9 Close the loop
1. On-call engineer posts to `#incident`: `ROLLBACK COMPLETE — <service> — <duration> — <commit>`.
2. Project lead updates the status page.
3. Community lead messages anchors: "We're stable again. Thanks for your patience."
4. Within 72 hours: file a blameless post-mortem. Template in [`11_Ops_Runbook.md §7.7`](./11_Ops_Runbook.md).

---

## 4) User-Facing Incident Template + Public Communication Plan

### 4.1 Internal severity ladder
| Severity | User-visible impact | External comms |
|---|---|---|
| P0 | Service unusable, data leak, safety incident | Public status page + anchor SMS + social within 30 min |
| P1 | Degraded performance, partial outage, single-feature broken | Status page update within 1 hour, no social |
| P2 | Minor bug, UI glitch | Fix-forward, no comms needed |

### 4.2 Public incident message template (paste into status page)

```
[<HH:MM ET> <date>] — <service> degraded

We noticed <plain-English description of the problem>. We are rolling
back the recent change and expect service to return to normal within
<N> minutes. No user action is required.

Your posts, messages, and account are not affected.

We'll post an update here every 15 minutes until this is resolved.
Questions? Contact your community anchor or email oncall@weavenyc.org.
```

### 4.3 Anchor SMS template
Keep it short. Anchors should be able to read it at a glance while moderating their own community.

```
WeaveNYC ops: we are rolling back a bad deploy. No action needed from
you. Expected recovery <N> minutes. Reply STATUS for the latest.
```

### 4.4 Resident app banner
The PWA supports a banner toggle via server config. Copy to paste:

```
Service interruption — we're working on it. Your data is safe.
Last update: <HH:MM ET>.
```

When the incident is resolved, clear the banner and leave a timestamped "Resolved" note on the status page for 24 hours.

### 4.5 Post-mortem (internal only, but safe-to-share aggregate)
Within 72 hours of a P0 resolved event, produce a blameless post-mortem covering: timeline, root cause, user impact, what went well, what didn't, action items with owners and due dates. Share the non-sensitive parts with anchors at their next check-in so they understand what happened.

---

## 5) Residual Risks and Known Gaps

Things that are not blockers for the pilot but are known:

- Post publish funnel (`kpi-queries.sql §5`) needs client-side `composer_opened` and `composer_submitted` events wired into `apps/pwa/src/lib/analytics.ts`. Server-side portion works today; full funnel requires client-side events to be useful.
- `scripts/mint-anchor-invite.ts` does not exist. Anchors are minted via the documented Postgres insert (`pilot-checklists/*.md §2`). If we do more than three communities, this is worth scripting.
- Sentry and Prometheus integration is stubbed in the gateway services but not yet deployed in production wiring. Track under W4D.
- Rollback SOP assumes we have AWS App Runner / GCP Cloud Run / Azure Container Apps provisioned in production. Track under W4B.
- **W4B-GCP status (2026-04-16)**: `services/resource-directory/Dockerfile` builds successfully (local image `381 MB`, `/healthz` returns 200). GCP project `weavenyc-pilot` is created but billing has **not** been linked, so API enablement, Artifact Registry push, Secret Manager, and Cloud Run deploy are blocked. GitHub Actions workflow `.github/workflows/deploy-resources.yml` and IaC reference `infra/gcp/README.md` are shipped and will run end-to-end the moment billing is attached at <https://console.cloud.google.com/billing/linkedaccount?project=weavenyc-pilot>. See `docs/19_Deployment_Guide.md §4` for the deploy guide and `infra/gcp/README.md §6` for current status.
