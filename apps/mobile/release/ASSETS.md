# Icon, Splash & Visual Asset Plan — WeaveNYC iOS

All source assets live under `apps/mobile/assets/`. This file is the spec
the design team works from; the actual PNG/SVG files land in wave B
(week 8) as a separate PR.

---

## 1. App icon — master + generated variants

### Master

| Attribute | Value |
|---|---|
| Filename | `apps/mobile/assets/icon.png` |
| Dimensions | 1024 × 1024 px |
| Format | PNG-24 (no alpha; Apple rejects transparent icons at submit) |
| Color space | sRGB |
| Background | **Solid** — cream `#F5EFE1` to match brand (do *not* leave transparent) |
| Foreground | WeaveNYC mark — the stylized intersecting threads (brand primary `#2F6A58`, secondary `#C87A4A`) |
| Padding | 10% safe-area margin all sides (Apple crops aggressively on some displays) |
| Text? | **No text** in the icon (iOS auto-labels below the icon; doubling looks amateur) |

### Generated variants

Do **not** hand-make smaller variants. Run `expo-icon` (or let EAS Build do it
automatically on first build) to produce every iOS size from the 1024 master:

```bash
cd apps/mobile
npx expo prebuild --platform ios
# produces: ios/WeaveNYC/Images.xcassets/AppIcon.appiconset/ with:
#   Icon-App-20x20@2x.png   (40×40, spotlight)
#   Icon-App-20x20@3x.png   (60×60)
#   Icon-App-29x29@2x.png   (58×58, settings)
#   Icon-App-29x29@3x.png   (87×87)
#   Icon-App-40x40@2x.png   (80×80, spotlight)
#   Icon-App-40x40@3x.png   (120×120)
#   Icon-App-60x60@2x.png   (120×120, home screen)
#   Icon-App-60x60@3x.png   (180×180)
#   Icon-App-1024x1024@1x.png (App Store)
```

All 9 sizes are auto-generated. If the design team updates the master, delete
`ios/` and re-run `expo prebuild`.

### Dark / tinted / clear (iOS 18+)

iOS 18 introduced user-selectable icon variants. To support them:

- `apps/mobile/assets/icon.png` — default (cream background).
- `apps/mobile/assets/icon-dark.png` — dark-mode variant (same mark, ink
  `#1A1A1A` background).
- `apps/mobile/assets/icon-tinted.png` — monochrome; iOS tints it. Provide
  the mark in pure white on transparent (this is the **one** icon where
  alpha is allowed).

Configure in `app.config.ts` (week 9):

```ts
ios: {
  icon: {
    light: "./assets/icon.png",
    dark: "./assets/icon-dark.png",
    tinted: "./assets/icon-tinted.png",
  },
},
```

---

## 2. Splash screen

| Attribute | Value |
|---|---|
| Filename | `apps/mobile/assets/splash.png` |
| Dimensions | 1284 × 2778 px (6.7" reference; iOS scales to all sizes) |
| Background | Cream `#F5EFE1` (matches icon master bg, so no visible seam when app boots) |
| Foreground | WeaveNYC wordmark, centered vertically 40% from top, 70% of width max |
| No loading indicators | iOS adds its own if needed; don't bake in a spinner |

Expo splash config in `app.config.ts`:

```ts
splash: {
  image: "./assets/splash.png",
  resizeMode: "contain",
  backgroundColor: "#F5EFE1",
},
```

### Dark splash

Provide `apps/mobile/assets/splash-dark.png` with ink `#1A1A1A` background,
wordmark in cream. Apple's auto-switching between splash variants follows the
user's system Dark Mode preference.

---

## 3. Adaptive icon (Android — future-proofing)

Android ships a later milestone, but set up the assets now so the
`app.config.ts` doesn't need a follow-up PR when Android unblocks.

| Filename | Dimensions | Purpose |
|---|---|---|
| `apps/mobile/assets/adaptive-icon.png` | 1024 × 1024 | Foreground only; device composites over a background |
| `apps/mobile/assets/adaptive-icon-background.png` | 1024 × 1024 | Solid-color background layer |

Foreground safe zone: center 66% of the canvas. Anything outside that radius
may be cropped by the launcher's shape mask (circle / squircle / rounded
square depending on Android skin).

---

## 4. Notification icon (iOS)

iOS uses the app icon for notifications; no separate asset needed.

(Android ships a small white silhouette for the status bar — deferred to
when Android ships.)

---

## 5. Store-listing assets (screenshots + preview)

Covered in `APP_STORE_LISTING.md` §7–§8. Summary of what the asset pipeline
owes Marketing:

- 5 screenshots × 3 display sizes × 3 locales = 45 PNG files.
- 1 preview video (30 sec, English only for v1.0).

Folder convention once created:

```
apps/mobile/assets/store/
  en-US/
    6.7/  1.png  2.png  3.png  4.png  5.png
    6.5/  1.png  2.png  3.png  4.png  5.png
    5.5/  1.png  2.png  3.png  4.png  5.png
  es-MX/
    6.7/  ...
    ...
  zh-Hans/
    6.7/  ...
    ...
  preview.mov
```

---

## 6. Design-team handoff checklist

When the design team delivers assets in wave B, verify:

- [ ] `icon.png` is 1024×1024, no alpha channel, RGB space (use Preview →
      Tools → Show Inspector).
- [ ] `icon-dark.png` and `icon-tinted.png` match dimensions of the master.
- [ ] `splash.png` loads without flash of white background (backgroundColor
      in config matches the PNG background color exactly).
- [ ] Wordmark in splash is readable on both Dynamic Island and non-DI
      devices (don't use the top 120px of canvas — DI eats it).
- [ ] All filenames lowercased, hyphen-separated, `.png` extension.
- [ ] No PSDs / AIs / PDFs committed — only the generated PNGs.
- [ ] Generated Xcode asset catalog under `ios/` is **not** committed (EAS
      regenerates on every build).

---

## 7. Brand color reference (for designers)

| Name | Hex | Usage |
|---|---|---|
| Cream | `#F5EFE1` | Icon / splash background |
| Ink | `#1A1A1A` | Dark-mode background |
| Thread green | `#2F6A58` | Primary brand accent, wordmark |
| Thread orange | `#C87A4A` | Secondary accent, highlight stroke |
| Text default | `#1F1F1F` | Body |
| Text muted | `#6B6B6B` | Secondary |

Derived from the PWA tokens at `apps/pwa/src/app/DESIGN_TOKENS.md`. Keep in
sync — any brand refresh there must propagate here.
