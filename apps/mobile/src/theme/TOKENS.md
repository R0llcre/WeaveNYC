# WeaveNYC Mobile — Design Token Reference

A one-to-one map from the PWA's CSS custom properties
(`apps/pwa/src/app/globals.css`) to the Restyle theme defined in
`./tokens.ts`. Treat this file as the designer-handoff sheet; every token
listed below is real, typed, and consumable via `useAppTheme()`.

**Source of truth:** `apps/pwa/src/app/globals.css` — "Editorial 朱砂"
system.
**Consumer API:** `import { useAppTheme } from '~/theme';`

---

## Navigation

1. [Colors — surfaces](#colors--surfaces)
2. [Colors — ink (text)](#colors--ink-text)
3. [Colors — borders & dividers](#colors--borders--dividers)
4. [Colors — accent (vermillion)](#colors--accent-vermillion)
5. [Colors — semantic siblings](#colors--semantic-siblings)
6. [Colors — legacy / status aliases](#colors--legacy--status-aliases)
7. [Colors — focus ring](#colors--focus-ring)
8. [Spacing scale](#spacing-scale)
9. [Border radii](#border-radii)
10. [Typography variants](#typography-variants)
11. [Font families](#font-families)
12. [Shadows](#shadows)
13. [Motion — durations](#motion--durations)
14. [Z-index scale](#z-index-scale)
15. [Focus ring geometry](#focus-ring-geometry)
16. [Unported tokens](#unported-tokens)

---

## Colors — surfaces

The warm paper cream canvas is the brand signature. Dark mode flips to a
warm near-black (`#1a1511`) — explicitly NOT cold gray, so the
"paper/ink" metaphor survives the flip.

| Restyle token (`colors.*`) | PWA variable | Light | Dark | Where used |
| -------------------------- | ------------ | ----- | ---- | ---------- |
| `bg` | `--color-bg` | `#f4ece0` | `#1a1511` | App root, screen background |
| `surface` | `--color-surface` | `#faf6ed` | `#251e18` | Cards at rest |
| `surfaceRaised` | `--color-surface-raised` | `#ffffff` | `#2e2620` | Modals, elevated sheets |
| `surfaceSunken` | `--color-surface-sunken` | `#ecdfca` | `#1f1914` | Inset fields, list rows |
| `surfaceSolid` | `--color-surface-solid` | `#ffffff` | `#2e2620` | Back-compat alias; sheets |
| `overlay` | `--color-overlay` | `rgba(26,31,36,0.48)` | `rgba(0,0,0,0.66)` | Modal scrim, sheet backdrop |
| `illustrationSoft` | `--illustration-soft` | `rgba(199,61,61,0.06)` | `rgba(232,90,90,0.08)` | Decorative accent washes in empty states |
| `paper` | `--color-paper` (alias of `--color-bg`) | `#f4ece0` | `#1a1511` | Legacy alias — prefer `bg` |

## Colors — ink (text)

Warm grey-browns, not true black. Contrast ratios hit AAA for body copy.

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `inkPrimary` | `--color-ink-primary` | `#1a1f24` | `#f0e8dc` | Headlines, body copy |
| `inkSecondary` | `--color-ink-secondary` | `#4a4a4e` | `#c8bfae` | Subheads, captions |
| `inkMuted` | `--color-ink-muted` | `#6e6157` | `#a39888` | Metadata, helper text |
| `inkInverse` | `--color-ink-inverse` | `#ffffff` | `#1a1511` | Text on accent fills |
| `ink` | `--color-ink` (alias) | `#1a1f24` | `#f0e8dc` | Semantic alias for `inkPrimary` |

## Colors — borders & dividers

Borders replace shadows as the primary separation tool in this design
system. Alphas of warm-ink on cream (light) flip to cream-ink on
warm-black (dark).

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `border` | `--color-border` | `rgba(26,31,36,0.14)` | `rgba(240,232,220,0.12)` | Default component edge |
| `borderStrong` | `--color-border-strong` | `rgba(26,31,36,0.28)` | `rgba(240,232,220,0.24)` | Focused inputs, emphasised edges |
| `divider` | `--color-divider` | `rgba(26,31,36,0.08)` | `rgba(240,232,220,0.08)` | Hairline list separators |

## Colors — accent (vermillion)

The single signal colour. One accent for every primary CTA + link.

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `accent` | `--color-accent` | `#c73d3d` | `#e85a5a` | Primary CTA fill, link colour |
| `accentStrong` | `--color-accent-strong` | `#9d2c2c` | `#f07878` | Hover / pressed state on CTA |
| `accentSoft` | `--color-accent-soft` | `rgba(199,61,61,0.08)` | `rgba(232,90,90,0.14)` | Hover tint, pill bg |
| `accentInk` | `--color-accent-ink` | `#ffffff` | `#1a1511` | Text colour on accent fill |
| `chopmark` | `--color-chopmark` (alias) | `#c73d3d` | `#e85a5a` | Legacy alias — prefer `accent` |

## Colors — semantic siblings

Three tonal siblings — verified / urgent / danger / info — sit in one
family and never compete with the primary vermillion accent.

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `verified` | `--color-verified` (苔绿 moss green) | `#4a7c5e` | `#6aa07f` | Verified badge, trust signal |
| `verifiedStrong` | `--color-verified-strong` | `#2f5a3f` | `#8cbfa1` | Pressed verified CTA |
| `verifiedSoft` | `--color-verified-soft` | `rgba(74,124,94,0.12)` | `rgba(106,160,127,0.18)` | Verified chip bg |
| `community` | `--color-community` (alias verified) | `#4a7c5e` | `#6aa07f` | Community/mutual-aid signals |
| `communitySoft` | `--color-community-soft` | `rgba(74,124,94,0.08)` | `rgba(106,160,127,0.14)` | Community chip bg |
| `urgent` | `--color-urgent` (琥珀 amber) | `#c8871f` | `#d89c3f` | Urgent flag, time-sensitive badge |
| `urgentStrong` | `--color-urgent-strong` | `#8f5d0f` | `#e8b566` | Pressed urgent CTA |
| `urgentSoft` | `--color-urgent-soft` | `rgba(200,135,31,0.12)` | `rgba(216,156,63,0.18)` | Urgent chip bg |
| `danger` | `--color-danger` (沉红 deep red) | `#8b2a2a` | `#b93838` | Error text, destructive action |
| `dangerStrong` | `--color-danger-strong` | `#6b1e1e` | `#8f2525` | Pressed destructive CTA |
| `dangerSoft` | `--color-danger-soft` | `rgba(139,42,42,0.10)` | `rgba(185,56,56,0.18)` | Error banner bg |
| `info` | `--color-info` | `#3a5b7c` | `#6a8fb3` | Informational banner text |
| `infoSoft` | `--color-info-soft` | `rgba(58,91,124,0.10)` | `rgba(106,143,179,0.16)` | Informational banner bg |

## Colors — legacy / status aliases

PWA kept `success` / `warning` aliases so older selectors keep resolving.
Prefer the semantic-sibling names above; use these only when porting
existing component code.

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `success` | `--color-success` → `verified` | `#4a7c5e` | `#6aa07f` | Legacy alias of `verified` |
| `successSoft` | `--color-success-soft` → `verifiedSoft` | `rgba(74,124,94,0.12)` | `rgba(106,160,127,0.18)` | Legacy alias |
| `warning` | `--color-warning` → `urgent` | `#c8871f` | `#d89c3f` | Legacy alias of `urgent` |
| `warningSoft` | `--color-warning-soft` → `urgentSoft` | `rgba(200,135,31,0.12)` | `rgba(216,156,63,0.18)` | Legacy alias |

## Colors — focus ring

A deep-ink neutral — explicitly NOT the accent red — so focus reads as
"where am I?" not "this is a warning". Dark mode flips cream-on-ink.

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `focusRing` | `--focus-ring-color` | `rgba(26,31,36,0.72)` | `rgba(240,232,220,0.8)` | Border + shadow halo on keyboard/VoiceOver focus |

## Colors — utility

| Restyle token | PWA variable | Light | Dark | Where used |
| ------------- | ------------ | ----- | ---- | ---------- |
| `transparent` | (n/a — RN primitive) | `transparent` | `transparent` | Explicit opt-out of fill |

---

## Spacing scale

4px base scale. PWA `--space-1..12` → Restyle semantic `xs..xxxxxxl`. Use
the semantic name in atoms; the `-1..12` mapping is for cross-repo
parity only.

| Restyle token (`spacing.*`) | PWA variable | Value | Where used |
| --------------------------- | ------------ | ----- | ---------- |
| `none` | (n/a) | `0` | Explicit opt-out |
| `xs` | `--space-1` | `4px` | Icon + label gap, tight inline spacing |
| `s` | `--space-2` | `8px` | Small internal padding (chips, tiny cards) |
| `sm` | `--space-3` | `12px` | Label → input gap, compact rows |
| `m` | `--space-4` | `16px` | Default screen margin, card padding |
| `ml` | `--space-5` | `20px` | Section head → content gap |
| `l` | `--space-6` | `24px` | Section → section break |
| `xl` | `--space-7` | `28px` | (reserved — rare) |
| `xxl` | `--space-8` | `32px` | Hero top padding, screen-level spacing |
| `xxxl` | `--space-9` | `36px` | (reserved — rare) |
| `xxxxl` | `--space-10` | `40px` | Hero bottom padding |
| `xxxxxl` | `--space-11` | `44px` | Safe-area tap target baseline |
| `xxxxxxl` | `--space-12` | `48px` | Major layout gaps |

## Border radii

Tighter, print-like. Pill kept for chips / tags.

| Restyle token (`borderRadii.*`) | PWA variable | Value | Where used |
| ------------------------------- | ------------ | ----- | ---------- |
| `none` | (n/a) | `0` | Explicit opt-out |
| `sm` | `--radius-sm` | `2` | Focus-visible outline radius |
| `md` | `--radius-md` | `4` | Inputs, subtle corners |
| `lg` | `--radius-lg` | `8` | Cards, buttons |
| `xl` | `--radius-xl` | `12` | Hero cards, modals |
| `pill` | `--radius-pill` | `9999` | Chips, tags, avatars |

## Typography variants

The PWA's `font: weight size/line-height family` shorthand split into RN
props. `rem` → `px` at 16px = 1rem.

| Restyle token (`textVariants.*`) | PWA variable | Family | Size | LH | Weight | Where used |
| -------------------------------- | ------------ | ------ | ---- | -- | ------ | ---------- |
| `defaults` | `--type-body` | Inter | 16 | 26 | 400 | Restyle fallback when no variant given |
| `display` | `--type-display` | Fraunces | 32 | 38 | 500 | Hero display, onboarding splash |
| `h1` | `--type-h1` | Fraunces | 40 | 46 | 600 | Screen titles |
| `h2` | `--type-h2` | Fraunces | 26 | 32 | 500 | Section titles |
| `h3` | `--type-h3` (V2-E Inter 600) | Inter | 20 | 28 | 600 | Card titles |
| `h4` | `--type-h4` (V2-E Inter 600) | Inter | 17 | 24 | 600 | List row titles |
| `overline` | `--type-overline` | Inter | 12 | 17 | 500 | Eyebrow labels, uppercase |
| `body` | `--type-body` | Inter | 16 | 26 | 400 | Default body copy |
| `bodySmall` | `--type-body-sm` | Inter | 15 | 24 | 400 | Secondary copy, captions |
| `label` | `--type-label` | Inter | 13 | 18 | 500 | Form labels, chip text |
| `micro` | `--type-micro` | Inter | 12 | 17 | 400 | Metadata, timestamps |
| `small` | `--type-small` (alias bodySmall) | Inter | 15 | 24 | 400 | Legacy alias — prefer `bodySmall` |
| `title` | `--type-title` (alias h2) | Fraunces | 26 | 32 | 500 | Legacy alias — prefer `h2` |

## Font families

Raw family keys live in `theme.fontFamilies` and are consumed by
`textVariants`. The *values* here are the keys registered with
`expo-font` — they must match `fonts.ts` exactly, else the RN runtime
falls back to system fonts.

| Key | PWA variable | Registered name | Source file |
| --- | ------------ | --------------- | ----------- |
| `display` | `--font-family-display` | `Fraunces` | `Fraunces-Variable.ttf` |
| `displayVariable` | `--font-fraunces` | `Fraunces-Variable` | `Fraunces-Variable.ttf` |
| `body` | `--font-family-base` | `Inter` | `Inter-Regular.ttf` |
| `bodyMedium` | `--font-family-base` weight 500 | `Inter-Medium` | `Inter-Medium.ttf` |
| `bodySemiBold` | `--font-family-base` weight 600 | `Inter-SemiBold` | `Inter-SemiBold.ttf` |
| `bodyBold` | `--font-family-base` weight 700 | `Inter-Bold` | `Inter-Bold.ttf` |
| `mono` | `--font-family-mono` | `IBMPlexMono` | (not bundled in M7 — see Unported) |

Font weights (`theme.fontWeights.*`): `regular` = 400, `medium` = 500,
`semibold` = 600, `bold` = 700. RN accepts string numerics for
cross-platform stability.

---

## Shadows

RN shadow props are platform-specific. Each `boxShadow` token bundles
iOS (`shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius`) +
Android (`elevation`) into one object. Consumers spread it into a style
prop.

| Restyle token (`boxShadows.*`) | PWA variable | Light (iOS) | Dark (iOS) | Where used |
| ------------------------------ | ------------ | ----------- | ---------- | ---------- |
| `none` | (explicit none) | 0 | 0 | Explicit opt-out |
| `sm` | `--shadow-sm` → `--shadow-1` (none at rest; border handles sep) | 0 | 0 | Card rest state |
| `md` | `--shadow-md` → `--shadow-2` | `0 2 6 rgba(26,31,36,0.06)` | `0 2 8 rgba(0,0,0,0.4)` | Elevated card, dropdown |
| `lg` | `--shadow-lg` → `--shadow-3` | `0 8 24 rgba(26,31,36,0.10)` | `0 4 16 rgba(0,0,0,0.5)` | Sheets, toasts |
| `xl` | `--shadow-4` | `0 16 40 rgba(26,31,36,0.14)` | `0 8 24 rgba(0,0,0,0.6)` | Modals, FABs |
| `focusRing` | `--shadow-ring-focus` | `0 0 3 rgba(26,31,36,0.32)` | `0 0 3 rgba(240,232,220,0.4)` | Focus halo (emulates CSS outline) |
| `focusRingDanger` | `--focus-ring-danger` | `0 0 3 rgba(139,42,42,0.35)` | (same) | Danger-variant focus (destructive CTAs) |

---

## Motion — durations

RN Animated uses ms integers, not CSS strings. Values match PWA exactly.

| Restyle token (`durations.*`) | PWA variable | Value | Where used |
| ----------------------------- | ------------ | ----- | ---------- |
| `fast` | `--transition-fast` | `120ms` | Hover/pressed state toggles |
| `medium` | `--transition-med` | `220ms` | Modal open, sheet slide |

---

## Z-index scale

PWA had `z-index: 999` hardcoded for skip-link + modal overlays. Named
tokens prevent the "what number do I use?" question.

| Restyle token (`zIndices.*`) | Value | Where used |
| ---------------------------- | ----- | ---------- |
| `base` | `0` | Default stacking |
| `dropdown` | `10` | Inline menus |
| `sticky` | `100` | Sticky headers, FAB |
| `overlay` | `500` | Backdrop / scrim |
| `modal` | `800` | Modals, sheets |
| `toast` | `900` | Snackbars, toasts |
| `skipLink` | `999` | Keyboard skip-nav (matches PWA exactly) |

---

## Focus ring geometry

Border + shadow halo used in atoms on `focused` / `accessibilityRole` events.

| Restyle token (`focusRing.*`) | PWA variable | Value | Where used |
| ----------------------------- | ------------ | ----- | ---------- |
| `width` | `--focus-ring-width` | `3` | Outline thickness |
| `offset` | `--focus-ring-offset` | `2` | Outline spacing from border |

---

## Unported tokens

Tokens the PWA has that could NOT be ported 1:1. Each has a rationale.

| PWA variable | Why skipped | Mitigation |
| ------------ | ----------- | ---------- |
| `--font-family-display` fallback chain (Noto Serif SC, Source Han Serif SC, Songti SC, Georgia) | RN picks only the first registered family; full CSS cascade doesn't exist | iOS "PingFang TC" / Android "Noto CJK" auto-cover CJK glyphs as OS fallback when the text contains codepoints Fraunces doesn't have. Pixel parity not guaranteed vs web. |
| `--font-family-base` fallback chain (Noto Sans SC, "Segoe UI", BlinkMacSystemFont…) | Same — RN picks first family only | Same — OS fallback. Bundling Noto Sans SC would add ~1.3MB × 4 weights = >5MB install size, rejected on cost. |
| `--type-display` `clamp()` fluid sizing | RN has no fluid typography primitive | Pinned to the PWA `clamp()` ceiling (32px display, 40px h1). Mobile viewports are narrower than the breakpoint that would trigger the clamp floor, so no loss in practice. |
| `@media (prefers-reduced-motion)` override | RN has `AccessibilityInfo.isReduceMotionEnabled()` but it's event-driven, not static | Atoms (wave B) will check `AccessibilityInfo` and bypass animations with `durations.fast → 0`. No theme-level change needed. |
| CSS utility classes (`.stack`, `.sr-only`, `.banner--info`) | Not tokens; these are *components* in PWA parlance | Ported as RN components in wave B (M3/M4) — out of scope here. |
| `--font-dm-sans` (legacy alias for Fraunces) | Dead alias, not referenced by any live PWA selector at the time of port | Dropped. If some legacy page re-introduces it, map to `fontFamilies.display`. |

---

## Summary — token count

- **Colors (light + dark):** 40 semantic tokens × 2 variants = **40 entries in `colors`**
- **Spacing:** 13 entries (`none` + `xs`..`xxxxxxl`)
- **Border radii:** 6 entries
- **Text variants:** 13 variants
- **Box shadows:** 7 entries
- **Font families:** 7 named families
- **Font weights:** 4 entries
- **Durations:** 2 entries
- **Z-indices:** 7 entries
- **Focus ring geometry:** 2 entries

**Total distinct tokens:** ~101 (colors alone contribute ~40; full
enumeration at the TypeScript level via `Object.keys(theme.colors)`
etc.).

Every PWA `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, and
`--type-*` variable has a 1:1 destination in this theme. The dark-mode
override block in `globals.css` lines 223–290 maps line-for-line to the
`darkTheme` export in `./tokens.ts`.
