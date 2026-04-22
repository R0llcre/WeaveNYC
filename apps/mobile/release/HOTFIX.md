# Hotfix & Rollback Runbook — WeaveNYC iOS

Three tiers of fix, each with a different cost and time-to-users:

| Tier | What it touches | User-side update | Time-to-users | When to use |
|---|---|---|---|---|
| **OTA update** (`expo-updates`) | JS bundle + assets only | Automatic on next launch | 15 min — 2h | 90% of bugs (logic, copy, minor UI, API calls) |
| **Native rebuild + App Store resubmit** | Native modules, Info.plist, icons | User must download from App Store | 24–72h (Apple review) | Anything touching native code |
| **Server-side feature flag** | Flip a DB row | Next API call picks up new value | seconds | Kill a broken screen without a build |

**Default assumption**: try flag first (instant, reversible), then OTA
(minutes), then native rebuild (days). Escalate only if the tier below can't
solve it.

---

## 1. Server-side feature flags — fastest, instant

### What this is

A DB-backed flags table the app reads on cold start + every ~5 min. Flipping
a flag hides a screen, disables a feature, or swaps copy — no build required.

### Minimum viable flag schema

Lives in `services/api-gateway` (spec — to be implemented in wave B, week 9):

```sql
CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_pct SMALLINT NOT NULL DEFAULT 0,  -- 0..100
  rationale   TEXT,                         -- audit trail
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  TEXT NOT NULL
);
```

### Flags we wire Day 1

| Key | Purpose |
|---|---|
| `mobile.chat.enabled` | Kill chat tab without a build |
| `mobile.posts.enabled` | Disable post composer if moderation is overwhelmed |
| `mobile.siwa.enabled` | Disable Sign in with Apple if Apple auth is down |
| `mobile.universal_links.enabled` | Kill UL routing (fall back to Safari) |
| `mobile.push.enabled` | Mute push notifications globally |
| `mobile.background_sync.enabled` | Disable P2P background fetch |

### Client-side consumption

In the app (week 9 implementation):

```ts
const flags = useFeatureFlags();
if (!flags["mobile.chat.enabled"]) return null;
```

### How to flip in an incident

```bash
# Production database access required (see docs/11_Ops_Runbook.md)
psql "$PROD_DB_URL" <<SQL
UPDATE feature_flags
SET enabled = false,
    rationale = 'incident INC-2026-0423-A: chat crash',
    updated_by = 'oncall@weavenyc.org',
    updated_at = NOW()
WHERE key = 'mobile.chat.enabled';
SQL
```

Takes effect within 5 min on every client. File an incident ticket citing
`rationale`.

---

## 2. OTA updates via `expo-updates` — 15 minutes

### What can ship OTA

- Any JavaScript / TypeScript change.
- Any asset already declared in `app.config.ts` (images, JSON, locales).
- Any change that doesn't require recompiling native code.

### What **cannot** ship OTA (requires full rebuild)

- New native modules / dependencies.
- Permission changes (`NSLocationWhenInUseUsageDescription` updates).
- Bundle ID / version / build number changes.
- New `ios.associatedDomains` entries.
- Push notification category changes.

### How to publish an OTA

```bash
cd apps/mobile

# Update the code, test locally on Dev Client.

# Publish to production channel. expo-updates signs the bundle with the
# project's private key (set up via eas update:configure first time).
eas update --channel production --message "hotfix: fix crash on iOS 17.2 when opening resource detail"
```

Users get it:
- On next cold start if they launch within 24h: immediate.
- Otherwise: on the launch after next (first launch checks, second applies).

### Publish OTA channels

| Channel | Who receives |
|---|---|
| `development` | Internal devs with Dev Client |
| `preview` | Internal TestFlight group |
| `production` | External TestFlight + App Store users |

**Sanity checklist before `eas update --channel production`**:

- [ ] Change has been tested on at least one physical iOS device.
- [ ] Native code untouched since last native build (`git diff` against the
      last native release tag shows no changes under `ios/` or
      `app.config.ts` native sections).
- [ ] Sentry release name bumped so new errors tag to the right build.
- [ ] Slack #weave-ios-oncall notified with the diff + rollback plan.

### OTA rollback

If a production OTA turns out to be broken:

```bash
# List recent updates
eas update:list --branch production --limit 5

# Republish the previous good one by its ID
eas update:republish --group <previous-good-update-id>
```

That re-publishes the older JS bundle under a newer manifest. On-device logic
picks up the "new" (actually reverted) update on next launch. Old-app users
see the reverted version within the usual 24h propagation window.

---

## 3. Native rebuild + App Store resubmit — 24–72 hours

### When

- Anything on the "cannot ship OTA" list above.
- Security patches that touch native.
- Severe issues where the feature-flag kill switch isn't enough.

### Flow

1. Branch: `hotfix/<short-summary>` off the current production release tag.
2. Bump `version` in `app.config.ts` (patch bump for hotfix: `1.0.0` →
   `1.0.1`).
3. Let EAS auto-bump `buildNumber` on build.
4. Open PR. `mobile-build.yml` runs typecheck/lint/test + a preview EAS
   build, comments install URL for review.
5. Smoke on a physical device from the PR preview build.
6. Merge to `main`. `mobile-build.yml` pushes a **production** build and
   auto-submits via `eas submit`.
7. In ASC, the build appears under **TestFlight** and **App Store** tabs.
8. Submit for **App Review** with **Expedited Review** (see below).
9. Approve → release manually.

### Requesting Expedited Review

For urgent hotfixes (crash affecting users, security fix):

1. ASC → **Contact Us** → **App Review** → **Request an Expedited Review**.
2. Explain: the specific crash / security issue, how many users impacted,
   any workaround users currently have (or none).
3. Apple grants 1–2 per year per org; use sparingly. Typical expedited
   turnaround: 4–8 hours.

---

## 4. Full rollback from a broken native release

Scenario: we shipped v1.0.3 to App Store, users are seeing a P0 crash.
Instant user base rollback is impossible (App Store users can't downgrade),
but we can:

1. **Feature-flag kill** the crashing feature (§1) — if one specific screen
   is the culprit.
2. **OTA-revert the JS** (§2 rollback) — if the crash originates in JS land,
   pushing v1.0.2's JS bundle into v1.0.3 fixes it without rebuild.
3. If both above fail: **native rebuild v1.0.4** with the offending code
   reverted via `git revert` of the broken merge on `main`, then expedited
   App Store review.

### How git-level revert propagates

```bash
# On main, find the commit that shipped v1.0.3.
git log --oneline v1.0.3..HEAD

# Revert the specific bad commit (preferred — preserves history).
git revert <bad-sha>

# Or revert the merge if the PR has many commits.
git revert -m 1 <merge-commit-sha>

# Push. mobile-build.yml picks up the push to main:
#   - Builds v1.0.4 (auto-bumped buildNumber).
#   - Auto-submits to ASC.
git push origin main
```

Users stay on v1.0.3 until v1.0.4 is approved and released. During that
window, lean on the feature flag to blunt impact.

---

## 5. Incident command

For anything user-facing in production:

1. **Declare**: post in `#weave-oncall` Slack:
   `INCIDENT: <one-line summary>. IC: <you>. Start: <time>.`
2. **Contain**: flip the relevant feature flag within 10 min of detection.
3. **Communicate**: status page update (if set up) + in-app banner via
   `@weavenyc/feature_flags` (a flag like `mobile.banner.copy` is useful
   here).
4. **Fix**: OTA if possible, native if required.
5. **Post-mortem**: within 1 week, blameless review in
   `docs/11_Ops_Runbook.md` appending a new entry under "Mobile
   incidents".

---

## 6. Quick decision table

User reports a bug. What do you do?

```
Q1: Is the crash/bug in a specific screen that can be hidden?
    YES → flip feature flag (5 min). Ship OTA fix when ready.
    NO  → Q2

Q2: Is the fix pure JS / copy / asset?
    YES → eas update --channel production (15 min). Done.
    NO  → Q3

Q3: Is it a P0 (crash on launch, auth broken, data loss)?
    YES → Expedited App Store review (4–8h).
    NO  → Normal App Store review (24–72h). Ship in the next planned release.
```

---

## 7. Preventing future hotfixes

Add a check to the pre-merge gate:

- [ ] PR description declares: "OTA-safe" or "requires native build"?
- [ ] If OTA-safe, verify no `ios/` or native config diff in the branch.
- [ ] Every new feature has a feature flag entry in the flags table
      migration.

These conventions go in `docs/16_Contribution_Guide.md` in a wave-B follow-up.
