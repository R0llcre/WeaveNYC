# WeaveNYC Design Tokens

The token system in `globals.css` drives every layout, color, radius, and motion decision so the UI stays consistent across 13+ screens and three languages (EN/ES/ZH). Style authors should reach for tokens first; one-off literals go in only when a token genuinely does not fit.

The aesthetic target is a warm, Apple-leaning "neighbor's note" — soft cream backgrounds, a single brand green, subtle glass panels, and generous rounded corners. Light mode only.

## Token inventory

### Color

| Token | Value | When to use |
| --- | --- | --- |
| `--color-bg` | `#fbf9f5` | Page background (cream). |
| `--color-surface` | `rgba(255,255,255,0.82)` | Glass card surface (uses backdrop-filter). |
| `--color-surface-raised` | `rgba(255,255,255,0.94)` | Nested panels, list items, chips within cards. |
| `--color-surface-solid` | `#ffffff` | Solid fallback where translucency hurts readability. |
| `--color-ink-primary` | `#18212d` | Headings, body, primary text. |
| `--color-ink-secondary` | `#425066` | Card body copy, labels. |
| `--color-ink-muted` | `#5a6778` | Hints, timestamps, subtle meta. |
| `--color-accent` | `#0d7a6d` | Brand green — primary buttons, accents. Warmed ~10° from the original `#0e766e` toward jade so it reads as "mutual aid" rather than "corporate teal". |
| `--color-accent-strong` | `#0a5a54` | Hover / pressed, links, active pill text. |
| `--color-accent-soft` | `rgba(13,122,109,0.10)` | Chips, backgrounds of accent surfaces. |
| `--color-success` | `#1f7a46` | Confirmation copy (account deletion scheduled, etc.). |
| `--color-success-soft` | `rgba(31,122,70,0.10)` | Success banner bg. |
| `--color-warning` | `#a85b10` | Non-destructive attention (reserved for M8 pilots). |
| `--color-warning-soft` | `rgba(168,91,16,0.10)` | Warning banner bg. |
| `--color-danger` | `#b93830` | Error text, danger buttons. |
| `--color-danger-strong` | `#8f2a24` | Pressed danger, high-contrast error copy. |
| `--color-danger-soft` | `rgba(185,56,48,0.10)` | Error banner bg, danger-zone tint. |
| `--color-info` | `#1b5aa6` | Informational chips (reserved). |
| `--color-info-soft` | `rgba(27,90,166,0.10)` | Info banner bg (reserved). |
| `--color-border` | `rgba(24,33,45,0.10)` | Default border / divider. |
| `--color-border-strong` | `rgba(24,33,45,0.18)` | Form inputs, dashed containers, hover. |

### Spacing (4px base)

| Token | Value | When to use |
| --- | --- | --- |
| `--space-1` | 4px | Micro gap inside chips, icon-to-text. |
| `--space-2` | 8px | Tight gap (badge/meta). |
| `--space-3` | 12px | Default gap between list items. |
| `--space-4` | 16px | Card content gaps, form spacing. |
| `--space-5` | 20px | Section gap, outer card padding baseline. |
| `--space-6` | 24px | Card outer padding, large gaps. |
| `--space-7` | 28px | Hero padding. |
| `--space-8` | 32px | Shell padding (mobile), hero padding at tablet+. |
| `--space-9` | 36px | Rare — large section gap. |
| `--space-10` | 40px | Shell bottom padding. |
| `--space-11` | 44px | Minimum tap target (iOS HIG). |
| `--space-12` | 48px | Shell bottom padding at tablet+. |

### Radius

| Token | Value | When to use |
| --- | --- | --- |
| `--radius-sm` | 8px | Code snippets, focus-visible fallback, small chips. |
| `--radius-md` | 14px | Buttons, form inputs, small callouts. |
| `--radius-lg` | 20px | List items, resource cards, announcements. |
| `--radius-xl` | 28px | Hero, top-level cards, chat message bubbles. |
| `--radius-pill` | 999px | Pills, status badges, unread counts. |

### Shadow

| Token | When to use |
| --- | --- |
| `--shadow-sm` | Subtle raise for inline buttons, small cards. |
| `--shadow-md` | Default card resting. |
| `--shadow-lg` | Hero, hover elevation for cards. |

All shadows are tuned warm (slightly desaturated, weighted to the south) to avoid the chalky look common to default Material elevations.

### Typography

| Token | Value | When to use |
| --- | --- | --- |
| `--type-display` | 700 36/44 | Hero `h1`. |
| `--type-title` | 600 24/32 | Card `h2`. |
| `--type-body` | 400 16/24 | Body copy baseline. |
| `--type-small` | 400 14/20 | Hints, meta. |
| `--type-micro` | 500 12/16 | Timestamps, captions. |
| `--font-family-base` | `"SF Pro Display", "Segoe UI", system-ui, -apple-system, sans-serif` | All text. No external webfont. |
| `--font-family-mono` | `ui-monospace, "SF Mono", ...` | Code snippets, access-token readbacks. |

### Motion

| Token | Value | When to use |
| --- | --- | --- |
| `--transition-fast` | 120ms ease-out | Button/pill hover, focus ring, color transitions. |
| `--transition-med` | 220ms ease-out | Card hover elevation, resource card lift. |

Button press is a 100ms 0.98 scale (short enough to feel snappy, long enough to register as tactile). All motion is disabled under `prefers-reduced-motion: reduce`.

### Focus ring

3px solid `--color-accent` with 2px offset — meets WCAG 2.2 AA non-text contrast at this pairing against both the cream background and white surfaces. Form inputs additionally show a 3px soft-accent box-shadow halo (less intense than the page-level ring because the border already changes color on focus).

## Deliberate deviations

1. **iOS HIG vs. Material** — We followed iOS HIG for corner radius (larger, 20–28px) and the 44px tap target floor, but kept the accent as a single green rather than a system tint so the brand stays recognizable across three languages. We did not adopt Material's elevation ladder (0–24dp); our three shadows are enough for this depth of UI.
2. **Shadow weight** — Apple's light-mode shadows are typically neutral gray. We warmed ours slightly (`rgba(23,34,44,...)` vs. pure `rgba(0,0,0,...)`) to match the cream background; pure black shadows read too harsh.
3. **Glass cards, not solid** — The signature "warm Apple" feel is a glass card over a radial gradient. We kept this, with a `@supports not (backdrop-filter)` fallback to `rgba(255,255,255,0.96)` for low-end Android Chrome and older WebViews.
4. **Form density** — Inputs are 44px tall, not the 36–40px common on desktop SaaS, because the target user includes elderly neighbors and gloved hands on shared phones. We intentionally did not use compact density.
5. **No external fonts** — The app must work on spotty 2G/3G in food pantries; loading SF Pro / Inter / Segoe from a CDN is not acceptable. We rely on the system font stack and accept minor rendering differences across platforms.
6. **Danger-zone aesthetic** — The account-delete section uses a soft pink tint (`rgba(185,56,48,0.04)`) with a red summary chevron rather than a loud red banner. For a mutual-aid app targeting vulnerable users, a calm warning reads as more trustworthy than an alarming one.
7. **Pill vs. tab** — We use a single `.pill` class for tab-like navigation (inbox views, language picker, compose steps). This is a conscious simplification: one control pattern with one visual vocabulary, used consistently, is easier to localize and easier for users to learn than a separate tab + pill + chip hierarchy.
8. **Warm accent shift** — The initial `#0e766e` teal read as "corporate / government portal" in the 8-person review. Shifting ~10° warmer to `#0d7a6d` keeps WCAG AA contrast against cream while reading as closer to jade / olive. The cold bluish radial (`rgba(63,112,155,0.07)`) on the body was replaced with a warm cream radial (`rgba(240,206,168,0.08)`).
9. **Button depth hierarchy** — Primary buttons carry a warm ambient shadow (`0 2px 8px rgba(14,118,110,0.22)`) plus an inner top highlight. On hover the shadow deepens (14px blur, 4px offset). Secondary buttons at 8% ink read as subtly tactile without competing with primary. Ghost is reserved for dense inline actions (e.g. chip-like filters) where a border-only affordance is enough. Danger mirrors primary with the red shadow recipe.
10. **Typography hierarchy (3-step)** — Cards now use `h2 = 1.5rem / 2rem` (`--type-title`) and `h3 = 1.2rem / 1.6rem`, restoring a clear 24 → 19 → 16 ladder from card title to subtitle to body. The previous 1.3rem h2 compressed the ladder and made cards feel like flat lists.

## Mobile + Responsive

- **Viewport** — `apps/pwa/src/app/layout.tsx` exports a full `Viewport` config with `width: 'device-width'`, `initialScale: 1`, `maximumScale: 5`, `userScalable: true`, and `viewportFit: 'cover'`. `maximumScale: 5` is intentional: elderly and low-vision neighbors must be able to pinch-zoom; we do not cap at 1.
- **iOS zoom guard** — `body { font-size: 16px; }` and `.field input / textarea { font-size: 16px; }` are explicit. iOS Safari auto-zooms any input below 16px on focus; this breaks the layout and is almost always unintended.
- **Safe-area** — The `.shell`, `.chat-thread`, and `.composer` containers respect `env(safe-area-inset-top / bottom)` via `max(var(--space-N), env(...))`. Non-notched devices get the default space token; notched devices (iPhone 14+, Pixel 8 Pro) get the larger of the two so the composer never tucks under the home indicator.
- **Breakpoints** — 499px (single-column resource grid), 640px (phone → tablet: collapses two-up grids, stacks composer footer, swaps backdrop-filter glass for a solid surface on cheap Android), 720px (chat thread collapses sidebar into single column), 960px (desktop gap bump). All breakpoints are width-based; we don't branch on pointer type.
- **Touch targets** — Pills were previously 40px, now 44px, matching the button min-height and WCAG 2.5.5. Form inputs keep 44px and dropped to 10px vertical padding to cancel the dead gap under the text baseline.

## Tradeoffs

- **Radial gradient hero** adds ~0.2ms to paint on low-end Android but is necessary for the signature look; removing it would flatten the entire brand. Kept.
- **Backdrop-filter glass** is expensive on low-end devices. We gated it with `@supports not` to fall back to a mostly-opaque white, and under `@media (max-width: 640px)` we set `backdrop-filter: none` with a solid surface to stop GPU compositor thrashing during scroll on Android phones. The fallback loses the glass but keeps the layout intact.
- **12-column `.grid`** is retained for the dashboard only. New screens use flex/auto-fit grids because the 12-col system does not earn its complexity on a 960px-max layout.
- **Shell max-width 960px** — This is narrower than a typical desktop SaaS (1200–1440px) on purpose. The app is mobile-primary, and a narrower desktop keeps line-length readable and visual weight consistent across languages (Chinese glyphs are taller, Spanish runs long).
- **Banner vs. inline error** — `.banner` (info/warning/danger/success tones) is used at the top of screens for persistent state (e.g. "Account deletion scheduled"). `.error` + `.success` are inline, per-field. We kept both because a banner is a different affordance from a validation chip — collapsing them would force banners to compete with form copy.
