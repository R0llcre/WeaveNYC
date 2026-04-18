# Pilot Checklist — Bronx Hunts Point 10474

Third pilot community. Seed data added in parallel work (W5A). Service area: Hunts Point core; overlap with Longwood at the edges.

See the general playbook in [`05_Partner_Playbook.md`](../05_Partner_Playbook.md) for tier definitions, SOP, and escalation paths. This file owns Hunts Point-specific decisions.

---

## 1) Anchor candidate identification

### Target organizations (ranked)
1. **THE POINT CDC** — 25+ years in Hunts Point; community development corporation with deep trust. Most institutionally capable candidate. If they will take it on, they are first-choice.
2. **Bright Temple A.M.E. Church / Project F.I.L.L.** — 812 Faile St, Bronx, NY 10474. Pantry Fri 10:00-12:00. Faith-based, steady presence. Strong Tier A fit.
3. **The Prodigal Center** — 709 Tiffany St, Bronx, NY 10474. Pantry Tue 11:00-13:00 + clothing. Extension of Real Life congregation. Good fallback.
4. **NSHOPP (Neighborhood Self Help by Older Persons Project)** — serves 10,000+ older adults annually in the Bronx. Important Tier B outreach partner for senior residents; probably not primary Tier A because their programming is age-specific.

### Contact template — English
Subject: `Hunts Point pilot — privacy-first mutual aid app partnership`

```
Hi <Name>,

I'm <your name>, with WeaveNYC. We're a student team at NYU building a
free, privacy-first mutual aid app for NYC neighborhoods. Hunts Point
10474 is one of our three pilot communities, and <Organization> is at
the top of our partner list.

We know Hunts Point residents are cautious about yet another app. Our
pitch: residents can browse food resources and post requests without
signing up, and we never sell data or share contact info with third
parties. As the community Anchor, <Organization> would:
  - post announcements to residents in 10474
  - review a small number of posts that get flagged
  - help us understand what residents actually need

We handle tech, training, and 24/7 on-call support. Six-month pilot MOU.
Time commitment: about one hour per week.

Could we meet for 30 minutes, either in person at your office or over
Zoom?

Thanks,
<Your Name>
WeaveNYC Team
oncall@weavenyc.org
```

### Contact template — Simplified Chinese
邮件主题：`WeaveNYC — 邀请贵机构成为 Hunts Point 10474 社区合作伙伴`

```
您好 <称呼>，

我们是 NYU 学生团队，正在开发 WeaveNYC —— 一个主打隐私保护的
邻里互助 App。Hunts Point 10474 是我们在 Bronx 的首个试点社区。

我们很希望邀请<机构名称>加入首批社区合作伙伴（Anchor）。居民无需
注册即可浏览或发帖；我们不会出售或分享任何个人资料。Anchor 每周
投入约一小时：
  - 发布社区公告
  - 审核少量被标注的高风险帖子
  - 帮助我们了解居民的真实需求

技术、培训、值班支持全部由我们团队负责，试点为期六个月、免费。

能否约 30 分钟 demo？线下或线上都可以。

此致
<您的姓名>
WeaveNYC 团队
oncall@weavenyc.org
```

### Initial email draft (ready to send)
For THE POINT CDC, use the form at https://thepoint.org (contact form submits to generic ops alias). For Bright Temple A.M.E., look up the current pastor in a 311/charity directory before emailing — do not send to a generic church alias cold.

---

## 2) Invite code + TOTP activation rehearsal

The Hunts Point community_id will be assigned by the W5A seed. Do not proceed with production invites until W5A is merged.

### Step 1 — Confirm the community exists in production
```sql
SELECT community_id, name, center_zip
FROM communities
WHERE center_zip = '10474'
LIMIT 1;
```

### Step 2 — Generate a fresh invite code
```bash
INVITE_CODE="WEAVE-ANCHOR-10474-$(openssl rand -hex 6 | tr '[:lower:]' '[:upper:]')"
echo "$INVITE_CODE"

INVITE_HASH=$(printf '%s' "$INVITE_CODE" | tr -d '\n' | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print $1}')
echo "$INVITE_HASH"
```

### Step 3 — Insert into production
```sql
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
  '<community_id from Step 1>',
  '<$INVITE_HASH from Step 2>',
  'THE POINT CDC',
  'active',
  now() + interval '14 days',
  now()
);
```

### Step 4 — Revoke seed invites
```sql
UPDATE anchor_invites
SET status = 'revoked'
WHERE community_id = '<community_id>'
  AND org_name IS NULL
  AND status = 'active';
```

### Step 5 — TOTP activation walkthrough
Same five-sub-step flow as [`farmingdale.md §2 Step 4`](./farmingdale.md#step-4--walk-the-anchor-through-activation-live-on-a-call). Hunts Point-specific: schedule the walkthrough call inside the partner's office hours; do not do it over a noisy coffee shop wifi — too many DNS / cert failures in the field this year.

---

## 3) Soft-launch Day-0 script

### 09:00 — Final checks
- Ruleset: `review_categories = ['transportation', 'childcare', 'housing']` (adds `housing` because Hunts Point has higher eviction-fraud risk)
- `auto_hide_report_threshold = 2`
- `language_preferences = ['en', 'es']` (ZH low priority here)
- Confirm all three resource-directory entries for 10474 (Bright Temple, Bronx Academy for Multi Media, Prodigal Center) render in the PWA when testing with ZIP `10474`

### 10:00 — Anchor posts pinned welcome
Title (EN): `Welcome to WeaveNYC — Hunts Point`

Body (EN):
```
Hi neighbors in 10474. THE POINT CDC is piloting WeaveNYC, a free app
for food resources and neighbor-to-neighbor help in Hunts Point. You
don't need to share your name to browse or post. If anything feels off,
report it — we read every report within 24 hours. If you need help using
the app, come find us on a weekday afternoon.
```

ES variant already in i18n bundle; anchor can toggle.

### 10:15 — Team amplification
- Instagram and Twitter — tag THE POINT CDC
- Community newsletter for Hunts Point residents (if partner distributes one)
- Flyer drop at local laundromat and two bodegas — community lead coordinates
- Do **not** post to Nextdoor for Hunts Point. Traffic there is thin and often off-neighborhood.

### 10:30 — Tabling (optional)
Recommended: tabling at Bright Temple Friday pantry 10:00-12:00 if we launch on a Friday. If we launch mid-week, skip tabling and revisit the following Friday.

### 11:00–14:00 — Staffed standby
Same pattern as the other communities. On-call engineer, community lead, ES-speaking team member.

### 14:00 — Quiet check-in
Fifteen minutes with the anchor. Log signup count and any concerns.

---

## 4) Day-7 retro questions

Standard list from [`farmingdale.md §4`](./farmingdale.md#4-day-7-retro-questions), plus Hunts Point-specific:

1. Did you see any posts mentioning landlords, evictions, or housing court? How did you handle them? (Our policy: route to legal aid, do not moderate as spam.)
2. Did anyone ask whether the app is affiliated with the NYPD, ICE, HRA, or DHS?
3. Were there posts about Rikers visitation, parole, or re-entry? How did you handle those?
4. Did residents tell you they don't trust phone apps? What did they suggest instead?

---

## 5) Day-30 decision matrix

Standard schema from [`farmingdale.md §5`](./farmingdale.md#5-day-30-decision-matrix). Hunts Point-specific overrides:

- **Safety incidents**: threshold is stricter. *Any* P0 incident involving a minor, a suspected ICE-related fear post, or an eviction-fraud attempt = automatic project-lead review, regardless of other signals.
- **Trust signal**: if > 20% of posts mention one of the sensitive keywords from the Day-7 retro (eviction, ICE, NYPD, parole), we consider that success (people trust the app enough to raise it) and commit to bringing in a legal-aid / re-entry partner as a Tier C advisor before Day 60.
- **Anchor load**: if THE POINT CDC feels the moderation load is too heavy, we are prepared to add NSHOPP as a co-moderator (this is the only community where we pre-authorize dual anchors; technically implemented via a second row in `anchors` with `status = 'active'` — requires a one-line override of `uq_anchors_active_community`).
