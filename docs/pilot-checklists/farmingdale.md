# Pilot Checklist — Farmingdale 11735

First launch community. Already seeded in [`packages/db/seed/index.ts`](../../packages/db/seed/index.ts). Service area: Farmingdale + adjacent Bethpage (11714) for overflow referrals.

See the general playbook in [`05_Partner_Playbook.md`](../05_Partner_Playbook.md) for tier definitions, SOP, and escalation paths. This file owns the Farmingdale-specific decisions.

---

## contacts_to_confirm

Before Farmingdale go-live the operator MUST replace every placeholder below with real, confirmed values. **Go/no-go blocker for the Farmingdale rollout** (see [`../29_M8_Pilot_Readiness.md`](../29_M8_Pilot_Readiness.md) go/no-go matrix).

| Field | Placeholder in this checklist | Where | Confirm by |
|---|---|---|---|
| Primary anchor email | `ministry@stkilianparish.org` (guessed from parish website) | §1 Initial email draft | Verified phone call to St. Kilian Parish Social Ministry; ideally the pastor's office confirms the current ministry alias. |
| Backup anchor email | none documented | §1 Target organizations | Obtain from Hope for the Future and St. Martin of Tours via a direct phone call. |
| Pilot target date | `TBD` | §3 Soft-launch Day-0 | Set jointly with the anchor after Step 4 of the recruiting SOP; must be a day the anchor is physically on-site. |
| On-call engineer + project lead names | Unassigned in §3 Pre-dawn | §3 Pre-dawn | Assigned ≥ 48h before launch and pinned in Slack `#ops-critical`. |
| Legal/MOU countersignature | Pending | — | Anchor org signs [`mou-template-en.md`](./mou-template-en.md) or [`mou-template-zh.md`](./mou-template-zh.md) before the seed invite is revoked. |

Do not proceed past §2 Step 3 in production if any row above is unresolved.

---

## 1) Anchor candidate identification

### Target organizations (ranked)
1. **St. Kilian Parish Social Ministry** — 140 Elizabeth Street, Farmingdale, NY 11735; 516-756-9656. Pantry Mon–Tue 09:30-12:30. Already in the seed directory (`providerId`). Primary candidate.
2. **Hope for the Future** — 131 Verdi Street, Farmingdale, NY 11735; 631-752-5771. Evening pantry Thu 16:00-18:00. Already in the seed directory (`providerId2`). Strong fallback, especially for working families.
3. **St. Martin of Tours (Bethpage)** — 208 Broadway, Bethpage, NY 11714; 516-931-7332. Overflow candidate for residents just outside 11735. Not primary.

### Contact template — English
Subject: `Local pilot: privacy-first mutual aid app for Farmingdale residents`

```
Hi <Name>,

We are a student team at NYU building WeaveNYC, a privacy-first mutual
aid platform for NYC-area neighborhoods. Farmingdale 11735 is our first
pilot community.

We would love to invite <Organization> to be our founding Anchor partner.
As an Anchor, you would:
  - post announcements (e.g., pantry hour changes, drives)
  - review a small number of posts flagged as higher-risk
  - help keep the community safe

We provide the tooling, the training, and the on-call support. The pilot
is free and runs six months under a short MOU. Time commitment averages
about one hour per week.

Would you have 30 minutes next week for a demo?

Thanks,
<Your Name>
WeaveNYC Team
oncall@weavenyc.org
```

### Contact template — Simplified Chinese (for outreach to ZH-speaking pantry volunteers)
邮件主题：`WeaveNYC 邻里互助 App — 想邀请贵机构成为 Farmingdale 首个社区合作伙伴`

```
您好 <称呼>，

我们是 NYU 学生团队，正在开发 WeaveNYC，一个以隐私保护为优先的
邻里互助 App。Farmingdale 11735 是我们的第一个试点社区。

我们很希望邀请<机构名称>成为第一批社区合作伙伴（Anchor）。作为
Anchor 您将：
  - 发布社区公告（例如食物派发时间、活动信息）
  - 审核少量需要二次确认的高风险帖子
  - 协助维护社区秩序

技术工具、培训以及值班支持由我们团队提供；试点免费，为期六个月，
您每周大约投入一小时。

能否约一次 30 分钟的线上 demo？

谢谢，
<您的姓名>
WeaveNYC 团队
oncall@weavenyc.org
```

### Initial email draft (ready to send)
Send to `ministry@stkilianparish.org` (placeholder — confirm on partner website before sending). CC: project lead and community lead.

---

## 2) Invite code + TOTP activation rehearsal

The seed value `WEAVE-ANCHOR-11735` is a **development fixture only**. For production, mint a fresh invite. The repo does not yet ship a `scripts/mint-anchor-invite.ts` helper, so we document the Postgres insert path below. (File this as a follow-up if you want a proper script.)

### Step 1 — Generate a fresh invite code on your laptop
```bash
# 16 random uppercase alnum chars, prefixed for human readability
INVITE_CODE="WEAVE-ANCHOR-11735-$(openssl rand -hex 6 | tr '[:lower:]' '[:upper:]')"
echo "$INVITE_CODE"

# SHA-256 of the uppercase, trimmed code — matches hashAnchorInviteCode()
# in packages/db/seed/fixtures.ts and the auth route in api-gateway
INVITE_HASH=$(printf '%s' "$INVITE_CODE" | tr -d '\n' | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print $1}')
echo "$INVITE_HASH"
```

Hand `$INVITE_CODE` to the anchor **over a confidential channel** (Signal or in person). Never paste it into email or Slack.

### Step 2 — Insert the hash into production Postgres
```sql
-- Farmingdale community_id is seeded at 44444444-4444-4444-8444-444444444444
-- If you are not using the seed in production, look it up first:
--   SELECT community_id, name, center_zip FROM communities WHERE center_zip = '11735';

INSERT INTO anchor_invites (
  anchor_invite_id,
  community_id,
  code_hash,
  org_name,
  status,
  expires_at,
  created_at
) VALUES (
  gen_random_uuid(),
  '44444444-4444-4444-8444-444444444444',
  '<paste $INVITE_HASH here>',
  'St. Kilian Parish Social Ministry',
  'active',
  now() + interval '14 days',
  now()
);
```

### Step 3 — Revoke any stale seed invite in the production DB
```sql
UPDATE anchor_invites
SET status = 'revoked'
WHERE community_id = '44444444-4444-4444-8444-444444444444'
  AND code_hash = '0bfcff2038e295d2c298e1267788eb3809785fd648712c16daa33a4d8f1617f1'
  AND status = 'active';
```

### Step 4 — Walk the anchor through activation (live, on a call)

Prerequisite: the anchor must already hold a **verified** (Level 2) session — phone OTP or email magic-link completed on the admin login page. Activation endpoints all require `verified` auth; the server returns `403` otherwise.

1. Anchor opens `admin.weavenyc.org/anchor/activate` and enters `$INVITE_CODE`. The admin UI posts:
   ```
   POST /v1/auth/anchor/activate
   Authorization: Bearer <verified access_token>
   { "invite_code": "$INVITE_CODE" }
   ```
   Response (200) contains `activation_id` (UUID), `community` (id/name/center_zip/join_policy), `otpauth_uri` (shown in the UI as a QR code), and 3 `recovery_codes` shown **once**. The server generates the TOTP secret — clients do not supply one.
2. Anchor scans the QR code (or copies the otpauth URI) into their authenticator app (Google Authenticator / 1Password / Authy). They must also copy or write down the 3 recovery codes now — the server never shows them again.
3. Anchor reads the current 6-digit TOTP code from the authenticator and submits:
   ```
   POST /v1/auth/anchor/activate/confirm
   Authorization: Bearer <same verified access_token>
   { "activation_id": "<uuid>", "totp_code": "123456" }
   ```
   On success the server persists the encrypted TOTP secret and the recovery-code hashes, revokes the anchor's prior non-anchor sessions, records the `anchor_activated` analytics event, and returns a fresh anchor-elevated session bundle (`access_token` + `refresh_token` with `level: "anchor"`).
4. Anchor's row in `anchors` flips to `status = 'active'` and `activated_at` is set. Recovery codes remain written on paper — never photographed, never pasted into Slack or email.
5. **Subsequent sessions** (every time the anchor signs back into admin after this activation): the admin UI re-runs the verified first factor (OTP / magic-link) and then performs the TOTP step-up:
   ```
   POST /v1/auth/anchor/session/start
   { "community_id": "<farmingdale community_id>" }
   → { "challenge_id": "<uuid>", "expires_in_seconds": ... }

   POST /v1/auth/anchor/session/verify
   { "challenge_id": "<uuid>", "totp_code": "654321" }
   → anchor-elevated session bundle (access_token, refresh_token)
   ```
6. Team verifies: `SELECT event_type, occurred_at FROM analytics_events WHERE event_type = 'anchor_activated' AND community_id = '44444444-4444-4444-8444-444444444444' ORDER BY occurred_at DESC LIMIT 1;` — must return one row, timestamp within the last five minutes.

> Endpoint reference (line ranges in `services/api-gateway/src/routes/auth.ts` at the time of writing):
> - `POST /v1/auth/anchor/activate` — registration at line 513
> - `POST /v1/auth/anchor/activate/confirm` — registration at line 606
> - `POST /v1/auth/anchor/session/start` — registration at line 695
> - `POST /v1/auth/anchor/session/verify` — registration at line 746
>
> (Line numbers drift as the file evolves — the handler names are stable; grep for `"/v1/auth/anchor/` in `auth.ts` if the line numbers stop matching.)
>
> Request / response schemas live in `services/api-gateway/src/contracts.ts` (`anchorActivate*` and `anchorSession*`). High-level flow documented in [`../18_Auth_Design.md §3.4`](../18_Auth_Design.md).

### Step 5 — Smoke test
Have the anchor publish one test announcement, then delete it. The team confirms both operations landed via `announcements` and the dashboard shows the count back at zero.

---

## 3) Soft-launch Day-0 script

**Pilot target date:** TBD — set after Step 4 of the recruiting SOP.

### Pre-dawn (night before)
- Project lead posts `Day-0 ready` checklist to Slack: anchor confirmed, on-call named, rollback plan pinned.
- On-call engineer pre-warms the staging clone of the pilot scripts in case of rollback (`scripts/staging/smoke-staging.ts`).

### 09:30 — Final checks
- Ruleset: `review_categories = ['transportation']`, `auto_hide_report_threshold = 2` (matches seed default, appropriate for a first community).
- Two team members verify they can reach `admin.weavenyc.org`, `api.weavenyc.org/healthz`, and `weavenyc.org` from outside the dev network.

### 10:00 — Anchor posts the pinned welcome announcement
Title: `Welcome to WeaveNYC — Farmingdale`

Body (anchor pastes, anchor publishes):
```
Hello neighbors. St. Kilian Parish Social Ministry is piloting WeaveNYC,
a free app for finding food resources and helping each other in
Farmingdale. You don't need to share your name. Browse the pantry list,
post what you need, or offer what you can spare. If you see something
that feels wrong, please report it — we'll read every report within 24
hours. Questions? Stop by Mon or Tue mornings.
```

Anchor publishes via `POST /v1/anchor/announcements` — the admin UI form handles this.

### 10:15 — Team amplification
- Instagram post (template already in `templates/outreach_email_templates.md`), @tag partner
- Partner's WhatsApp / WeChat / parish bulletin: partner does this, in their own voice
- Nextdoor 11735: posted by project lead account (not the anchor)

### 10:30 — Optional tabling
If the partner has open pantry hours, one team member tables with QR codes + A5 flyers. No hard asks — point and smile.

### 11:00–14:00 — Staffed standby
On-call engineer and community lead monitor `analytics_events`, Sentry, and anchor's phone. No code changes during this window.

### 14:00 — Quiet check-in
Fifteen-minute call with the anchor. Log: number of signups, any issues, what surprised them.

---

## 4) Day-7 retro questions

Thirty minutes with the anchor. Record answers in a Google Doc you share with them.

1. How long did moderation take you this week, honestly? (Target: < 60 min cumulative.)
2. Were there any posts that made you uncomfortable? How did you decide?
3. Did anyone come in person and mention the app? What did they say?
4. Is the dashboard showing you what you want, or do you need something different?
5. What's one thing we should change before Day 30?
6. Do you want to continue? (Ask explicitly. Silence is not consent.)

Act on answer 5 within the following week if feasible. If answer 6 is anything other than an enthusiastic yes, escalate to project lead.

---

## 5) Day-30 decision matrix

Pull KPI numbers from [`kpi-queries.sql`](./kpi-queries.sql) filtered to `community_id = '44444444-4444-4444-8444-444444444444'`.

| Signal | Continue | Pivot | Shut down |
|---|---|---|---|
| Verified Matches / week | >= 5 | 1 to 4 | 0 for 3 weeks |
| Weekly anchor-active (reviewed or posted) | Yes | Yes | Anchor inactive 2 weeks |
| Safety incidents (P0/P1) | 0 | <= 1, resolved | >= 2 or unresolved P0 |
| Anchor retention (Day-30 retro: continue?) | Yes | Conditional yes | No |
| Negative community feedback | Isolated | Pattern; actionable | Pattern; not actionable |

Decision rules:
- **Continue**: all rows green. Renew the MOU for the remainder of the 6-month pilot. Introduce a second anchor org as back-up moderator.
- **Pivot**: any yellow. Reduce scope for 30 days (tighter review, smaller geographic radius, outreach pause). Re-evaluate at Day 60.
- **Shut down**: any red. Run the rollback SOP in [`../29_M8_Pilot_Readiness.md`](../29_M8_Pilot_Readiness.md), pause invites for this community, data-retention decisions per MOU.
