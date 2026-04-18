# Pilot Checklist — Queens Corona 11368

Second pilot community. Seed data added in parallel work (W5A). Service area: Corona + western Elmhurst; heavy Spanish and Mandarin use expected.

See the general playbook in [`05_Partner_Playbook.md`](../05_Partner_Playbook.md) for tier definitions, SOP, and escalation paths. This file owns Corona-specific decisions.

---

## 1) Anchor candidate identification

### Target organizations (ranked)
1. **Together We Can Community Resource Center Inc.** — volunteer-led 501(c)(3) serving Jackson Heights, Elmhurst, Corona. Food pantry registration restricted to 11368 residents. Contact: `togetherwecanrc@gmail.com`. Strongest fit — they already operate a ZIP-restricted pantry.
2. **La Jornada (at Queens Museum) / Together We Can Food Pantry at Queens Museum** — cultural food pantry at Queens Museum. Large footprint, established. Coordinated intake would require working through the Queens Museum partnerships office.
3. **New Life CDC** — Food Pantry serving Elmhurst and Corona low-income residents with weekly non-perishable deliveries. Fallback if #1 and #2 decline.
4. **Centro Corona (Love Wins NYC partner)** — immigrant-centered mutual aid. Strong trust in undocumented community; lower throughput than #1. Good Tier B outreach partner even if not Tier A anchor.

### Contact template — English
Subject: `WeaveNYC pilot in Corona — privacy-first neighbor-to-neighbor help`

```
Hi <Name>,

My name is <your name> with WeaveNYC, a student-led project out of NYU.
We're launching a privacy-first mutual aid app in Corona 11368, and
<Organization> is at the top of our list to partner with.

Because so many Corona residents are new to the US or wary of sharing
personal information, our app lets people browse and post without
signing up. As the community Anchor, you would:
  - post announcements to neighbors in 11368
  - review a small number of posts flagged as higher-risk
  - help us tune the app to what residents actually need

We handle tech, training, and 24/7 incident support. The MOU is a short
six-month pilot. Time commitment: roughly one hour per week.

Could I come by for a 30-minute demo in the next two weeks? Happy to
meet in person or over Zoom, English or Spanish.

Gracias,
<Your Name>
WeaveNYC Team
oncall@weavenyc.org
```

### Contact template — Simplified Chinese (for ZH-speaking volunteers / Flushing-adjacent orgs)
邮件主题：`WeaveNYC — 邀请贵机构成为 Corona 11368 社区合作伙伴`

```
您好 <称呼>，

我们是 NYU 的学生团队，正在开发 WeaveNYC —— 一个主打隐私保护的
邻里互助 App。Corona 11368 是我们在皇后区的首个试点社区。

我们很希望邀请<机构名称>加入为首批社区合作伙伴（Anchor）。作为
Anchor，您每周投入约一小时：
  - 发布社区公告
  - 审核少量高风险帖子
  - 帮我们把产品调整得更贴合居民需求

所有技术、培训、值班支持由我们负责；试点免费，合作时长六个月。
希望能约 30 分钟的线上 demo，中英文皆可。

此致
<您的姓名>
WeaveNYC 团队
oncall@weavenyc.org
```

### Contact template — Spanish (Together We Can / Centro Corona)
Asunto: `WeaveNYC — piloto de ayuda mutua en Corona 11368`

```
Hola <Nombre>,

Soy <su nombre>, del equipo de WeaveNYC, un proyecto estudiantil de NYU.
Estamos lanzando una aplicación gratuita de ayuda mutua en Corona 11368,
y nos encantaría que <Organización> fuera nuestra organización Anchor.

La aplicación permite a los residentes buscar ayuda y ofrecer apoyo sin
compartir su nombre. Como Anchor, ustedes:
  - publicarían anuncios a los vecinos de 11368
  - revisarían algunos avisos marcados como de mayor riesgo
  - ayudarían a que la aplicación sirva a los residentes

Nosotros cubrimos tecnología, entrenamiento y soporte 24/7. Acuerdo de
seis meses, compromiso aproximado de una hora por semana.

¿Podríamos agendar 30 minutos para una demostración?

Gracias,
<Su nombre>
Equipo WeaveNYC
oncall@weavenyc.org
```

### Initial email draft (ready to send)
Send to `togetherwecanrc@gmail.com`. CC: project lead, community lead, and ES-speaking team member.

---

## 2) Invite code + TOTP activation rehearsal

The Queens community_id will be assigned by the W5A seed. Do not proceed with production invites until W5A is merged.

### Step 1 — Confirm the community exists in production
```sql
SELECT community_id, name, center_zip
FROM communities
WHERE center_zip = '11368'
LIMIT 1;
-- Expected: one row. Copy community_id to the clipboard.
```

### Step 2 — Generate a fresh invite code
```bash
INVITE_CODE="WEAVE-ANCHOR-11368-$(openssl rand -hex 6 | tr '[:lower:]' '[:upper:]')"
echo "$INVITE_CODE"

INVITE_HASH=$(printf '%s' "$INVITE_CODE" | tr -d '\n' | tr '[:lower:]' '[:upper:]' | shasum -a 256 | awk '{print $1}')
echo "$INVITE_HASH"
```

Hand `$INVITE_CODE` over Signal or in person. Never email or Slack a live invite.

### Step 3 — Insert into production
```sql
-- Paste the community_id you copied in Step 1.
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
  'Together We Can Community Resource Center',
  'active',
  now() + interval '14 days',
  now()
);
```

### Step 4 — Revoke any demo/seed invite that may have leaked from W5A
```sql
UPDATE anchor_invites
SET status = 'revoked'
WHERE community_id = '<community_id>'
  AND org_name IS NULL
  AND status = 'active';
```

### Step 5 — TOTP activation walkthrough
Same five-sub-step flow as [`farmingdale.md §2 Step 4`](./farmingdale.md#step-4--walk-the-anchor-through-activation-live-on-a-call). Conduct the walkthrough in the anchor's preferred language (EN / ES / ZH). Confirm the `anchor_activated` analytics event fires for the Corona community_id before ending the call.

---

## 3) Soft-launch Day-0 script

### 09:00 — Final checks
- Ruleset: set `review_categories = ['transportation', 'childcare']` (stricter than Farmingdale because Corona has higher immigrant-trust risk)
- `auto_hide_report_threshold = 2`
- `language_preferences = ['en', 'es', 'zh']`
- Two team members verify the Cloudflare Pages build serves ES and ZH locale bundles

### 10:00 — Anchor posts pinned welcome (anchor chooses the language; all three are acceptable)
Title (EN): `Welcome to WeaveNYC — Corona`

Body (EN):
```
Hello neighbors in 11368. Together We Can is piloting WeaveNYC, a free
app to find food resources and help each other in Corona. You don't need
to share your name to browse or post. If something doesn't look right,
please report it — we will look at every report within 24 hours.
Questions? Find us at the pantry.
```

Bilingual variants (ES and ZH) live in `apps/pwa/src/lib/i18n` — anchor can pick from the dropdown inside the admin composer.

### 10:15 — Team amplification
- WhatsApp group for Corona parents (community lead owns this)
- Instagram @centrocorona and @togetherwecan — repost
- Local WeChat group for Fujianese-speaking residents — community lead posts
- Queens Chronicle submission (low priority, fire-and-forget)

### 10:30 — Tabling (optional)
If partnering with Together We Can at their pantry day. Otherwise skip. No tabling alone at subway stops.

### 11:00–14:00 — Staffed standby
Same as Farmingdale. On-call engineer plus one ES-speaker plus one ZH-speaker on Slack.

### 14:00 — Quiet check-in
Same 15-minute call format. Log signups by language if the analytics event payload permits.

---

## 4) Day-7 retro questions

Thirty minutes with the anchor. Corona-specific questions layered on top of the standard list in [`farmingdale.md §4`](./farmingdale.md#4-day-7-retro-questions):

1. Did you see any posts in a language you don't read? How did you handle it?
2. Did anyone mention being afraid the app would report them to the government or to landlords?
3. Are the translated categories clear, or is something miscategorized (e.g. `childcare` vs `eldercare`)?
4. Did you get asked about cash, gift cards, or money transfers? (Red flag — keyword blocklist should already catch `cash only`, but we want qualitative signal.)

---

## 5) Day-30 decision matrix

Same schema as [`farmingdale.md §5`](./farmingdale.md#5-day-30-decision-matrix), with two Corona-specific gates:

- **Language coverage**: at least one of EN / ES / ZH must show > 3 verified matches, or pivot. If all three are near-zero, shut down and re-evaluate whether 11368 is the right ZIP.
- **Trust signal**: if anchor reports that residents are asking privacy-related questions *more* than product questions, flag to project lead for a privacy-comms refresh before continuing.
