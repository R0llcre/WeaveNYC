# App Store Screenshots — Capture Plan

**Deliverable**: 45 PNG screenshots, uploaded via App Store Connect (ASC) →
App Version → iOS App → Screenshots. 5 screens × 3 display sizes × 3 locales.

**Status**: spec locked; capture not yet run. Owner: mobile lead + design.
Run after the v1.0.0 RC build is on a simulator and the content fixtures in
§4 are seeded.

---

## 1. Required display sizes

App Store Connect as of April 2026 still requires all three sizes below;
rejecting a listing for missing one is the single most common "review
failure" we'd trip on here.

| Size | Resolution (portrait) | Reference device | Simulator identifier |
|---|---|---|---|
| **6.7"** | 1290 × 2796 | iPhone 15 Pro Max / 14 Pro Max / 13 Pro Max | `iPhone 15 Pro Max` |
| **6.5"** | 1284 × 2778 | iPhone 14 Plus / 11 Pro Max / XS Max | `iPhone 14 Plus` |
| **5.5"** | 1242 × 2208 | iPhone 8 Plus (legacy; still required) | `iPhone 8 Plus` (Xcode 15 older-runtime pack) |

Per-size screenshot count: 3–10 allowed, 5 required for parity across
locales. Total assets: **5 × 3 sizes × 3 locales = 45 PNGs**.

---

## 2. Screens to capture

Order matters — ASC displays screenshots in upload order, and the first two
are what shows on the search-results cards.

### Screen 1 — Home wizard

**Route**: `/` (app launch, fresh install, no location granted).
**Caption overlay** (added in Figma after capture; do not bake into the
simulator output):
- EN: *"What do you need right now?"*
- ES: *"¿Qué necesitas ahora mismo?"*
- ZH: *"你现在需要什么帮助？"*

**What must be visible**:
- 4-card intent picker: Food / Health / Housing / Other.
- Language chip in the TopBar showing the active locale.
- "Or enter a ZIP code" fallback text below the cards.
- Trust banner ("Free. No sign-in. No ID required.") at the bottom.

**Setup**:
- Fresh install (delete app state between each locale capture).
- Locale set via Settings → Language before launching.
- Device frame: portrait, system-light theme (matches default).

### Screen 2 — Resource directory

**Route**: `/directory?q=food&zip=10025`.
**Caption overlay**:
- EN: *"Updated daily from city and nonprofit data."*
- ES: *"Actualizado a diario con datos públicos y comunitarios."*
- ZH: *"每天从政府和公益组织数据源更新。"*

**What must be visible**:
- **10+ results** in the scrollable list.
- Results from **multiple source types**: at least one USDA pantry, one
  HRSA health center, one NYC Open Data shelter, one nonprofit (Food Bank
  for NYC or City Harvest).
- Open-now chip green on the first 2 cards.
- Distance badge (".4 mi" / "0.6 km") on each card.
- Source-provenance footer ("USDA · updated today") on visible cards.

### Screen 3 — Resource detail

**Route**: `/resources/la-jornada-corona` (La Jornada pantry in Corona,
Queens — real entry, bilingual service hours, good EN/ES coverage).
**Caption overlay**:
- EN: *"Call, get directions, bookmark — one tap."*
- ES: *"Llama, ve cómo llegar, guarda — un toque."*
- ZH: *"电话、路线、收藏 —— 一键完成。"*

**What must be visible**:
- Resource name, source badge, last-updated timestamp.
- Open-now chip + weekly hours list.
- Three action buttons side by side: **Call** / **Directions** / **Bookmark**.
- Eligibility notes (localized).
- Nearby-related-resources carousel at the bottom.

### Screen 4 — Chat conversation (safety flag visible)

**Route**: `/inbox/abc-123` where thread `abc-123` is the seeded demo
conversation that contains one auto-flagged message (for the purposes of
screenshotting moderation UX).
**Caption overlay**:
- EN: *"Anchors moderate every thread — automatically and by hand."*
- ES: *"Los vecinos verificados moderan cada conversación."*
- ZH: *"每个对话都有认证邻里进行人工和自动审核。"*

**What must be visible**:
- 3-4 message bubbles between the reviewer-demo account and an anchor.
- **Safety flag banner** across the top of the thread ("This message was
  flagged for review. A community anchor will check it soon.").
- The "Report" affordance in the overflow menu on at least one message.
- Message composer at the bottom with the 1000-char indicator.

### Screen 5 — Community announcements feed

**Route**: `/communities/corona-queens`.
**Caption overlay**:
- EN: *"See what's happening on your block — right now."*
- ES: *"Mira qué está pasando en tu cuadra — ahora mismo."*
- ZH: *"看看你身边正在发生的互助 —— 就在此刻。"*

**What must be visible**:
- Community name + member count in header.
- 3 recent anchor-posted announcements, each with a different emoji /
  category tag (Food / Housing / Free items).
- "Anchor" verified badge next to at least one author.
- Filter pills at the top: All / Food / Housing / Events.
- Bottom-safe-area compose FAB.

---

## 3. Capture workflow

Two options, depending on whether we use Maestro flows (already used in P3-C
for smoke testing) or a direct Expo CLI capture.

### Option A — Maestro (preferred; reproducible)

Reuse the P3-C Maestro fixtures. Each screen has a `screenshot:` step at the
natural pause point in the flow.

```bash
# apps/mobile/.maestro/screenshots-all.yaml  (to be added by design PR)
# Loops EN / ES / ZH, boots the correct simulator, and emits:
#   apps/mobile/release/screenshots/<locale>/<size>/0<n>-<screen>.png

export MAESTRO_OUTPUT_DIR=apps/mobile/release/screenshots
maestro test apps/mobile/.maestro/screenshots-all.yaml \
  --env LOCALE=en --env SIZE=6.7
maestro test apps/mobile/.maestro/screenshots-all.yaml \
  --env LOCALE=es --env SIZE=6.7
maestro test apps/mobile/.maestro/screenshots-all.yaml \
  --env LOCALE=zh --env SIZE=6.7
# ... repeat for 6.5 and 5.5
```

Maestro's built-in `takeScreenshot` matches the booted simulator's framebuffer,
so the 1290×2796 output is device-native — no resampling.

### Option B — expo-cli-capture-screenshots (simpler, needs engineer time)

```bash
cd apps/mobile
pnpm add -D expo-cli-capture-screenshots
# ~/.config/capture-screenshots.config.json pins the 3 simulator IDs + 3 locales
npx expo-cli-capture-screenshots --config ./release/screenshots.config.json
```

Use this if Maestro becomes flaky on the legacy 5.5" simulator (iPhone 8 Plus
runtime is older and sometimes fails on the M-series macs).

### Option C — manual (last resort)

```bash
xcrun simctl boot "iPhone 15 Pro Max"
xcrun simctl launch booted org.weavenyc.app
# drive the UI by hand to each capture point
xcrun simctl io booted screenshot ~/Desktop/wnyc-6.7-en-01-home.png
```

Tedious at 45 shots but always works.

---

## 4. Content fixtures required before capture

The database must have these rows seeded so each screenshot shows real
content (not loading shimmers or empty states):

- **La Jornada pantry** in `/resources` with bilingual EN/ES description and
  a "last updated today" timestamp.
- **10+ visible resources** in `10025` ZIP search results, at least one from
  each of 4 source types (USDA, HRSA, NYC Open Data, partner nonprofit).
- **Corona, Queens** community with 3 pinned announcement posts.
- **Demo conversation `abc-123`** with the auto-flagged message + anchor
  reply.
- **Reviewer-demo account** signed in (phone `+1-555-010-0100`, OTP `246810`
  — matches `REVIEWER_NOTES.md` §2).

Seed via `pnpm --filter @weavenyc/api seed:screenshots` (script lives in
`services/api-gateway/scripts/seed-screenshots.ts`).

---

## 5. Post-capture checklist

- [ ] All 45 PNGs present in `apps/mobile/release/screenshots/<locale>/<size>/`.
- [ ] Filenames follow `0<n>-<screen-slug>.png` (1-indexed, lowercase slug).
- [ ] Resolutions match §1 exactly (ASC rejects off-by-one pixel dimensions).
- [ ] No demo PII visible (no real phone numbers, no real email addresses).
- [ ] No debug overlays, no developer menus, no red-box error messages.
- [ ] Status bar shows 9:41 + full signal + 100% battery (use
      `xcrun simctl status_bar booted override --time "9:41" --cellularBars 4 --batteryState charged --batteryLevel 100`
      before each capture).
- [ ] Overlay captions added in Figma (layer: `overlay-<locale>`) and exported.
- [ ] Final 45 files uploaded via ASC → Media Manager; ASC's auto-crop off.

---

## 6. Reference — Apple's screenshot spec source of truth

- <https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/>
- <https://help.apple.com/app-store-connect/#/devd274dd925>

If Apple changes the required sizes mid-cycle (has happened twice in the
last 3 years), update §1 + the Maestro matrix in the same PR.
