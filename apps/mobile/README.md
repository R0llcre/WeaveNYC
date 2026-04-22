# @weavenyc/mobile

iOS-first React Native app for WeaveNYC, built with Expo SDK 52 and Expo
Router. Shares types + domain logic with the PWA via `packages/shared/`.

> **Phase 1 wave A — M1 scaffold only.** This is the runnable 5-tab shell.
> Atoms, screens, persistence, and maps arrive in wave B. The full i18n
> string port is M5's parallel deliverable.

## Prereqs

- **Xcode 16** with the iOS 16+ Simulator runtime installed
  (`xcode-select --install`, then open Xcode once to accept license)
- **Node 22** (`nvm use 22`)
- **pnpm 10** (`corepack enable && corepack prepare pnpm@10.33.0 --activate`)
- **CocoaPods** (`sudo gem install cocoapods` — only needed for native
  module linking once wave B lands; M1 scaffold does not require it)

## Quick start

From the repo root:

```bash
pnpm install
pnpm mobile:ios
```

The Simulator boots, the bundler compiles, and you land on the 5-tab
shell. Switching tabs re-renders the placeholder screen. Toggling macOS
appearance between Light and Dark modes re-themes the surfaces.

If you only want the Metro dev server (no Simulator):

```bash
pnpm mobile:start
```

## Scripts

All scripts run through pnpm's workspace filter. From repo root:

- `pnpm mobile:start` — start the Expo Metro bundler
- `pnpm mobile:ios` — start bundler + launch iOS Simulator
- `pnpm mobile:typecheck` — strict TS check

Inside `apps/mobile/`:

- `pnpm typecheck`
- `pnpm test` — jest-expo (`@testing-library/react-native`)
- `pnpm lint`
- `pnpm prebuild:ios` — dry-run of the native `ios/` generation (useful
  for validating `app.json` changes without committing native code)

## Folder layout

```
apps/mobile/
  app/                    Expo Router file-system routing
    _layout.tsx           Root providers (Safe area, Restyle, Query, Redux, i18n, Sentry)
    (tabs)/
      _layout.tsx         5-tab bar
      index.tsx           Home
      community.tsx
      share.tsx           (presented as modal)
      inbox.tsx
      me.tsx
  src/
    components/           UI building blocks (atoms arrive in wave B)
    i18n/                 i18next init
    locales/              JSON bundles (en, es, zh-Hans) — chrome namespace seeded
    observability/        Sentry deferred init
    providers/            TanStack Query client
    store/                Redux store (placeholder slice today)
    theme/                Restyle theme tokens (light + dark)
  __tests__/              Jest tests
  app.json                Expo config: bundle id, scheme, associated domains
  babel.config.js         babel-preset-expo + reanimated plugin
  metro.config.js         Monorepo-aware: watchFolders + nodeModulesPaths
  tsconfig.json           Extends ../../tsconfig.base.json
```

## Day-1 dependencies

See `package.json`. The spec is fixed by the N1 dependency-plan doc — any
bumps get reviewed in their own PR. Notable:

- `expo ~52.0.0` with `newArchEnabled: true` and Hermes
- `expo-router ~4.0.0` for file-system navigation
- `@shopify/restyle` for theming (tokens port from the PWA's
  `globals.css`)
- `react-native-mmkv` as the storage backend (wave B wires this into
  query-client persistence)
- `@sentry/react-native` with a deferred post-interaction init
- `i18next` + `react-i18next` for localization
- `@reduxjs/toolkit` + `react-redux` for state (slices port in wave B)

## Dark mode

Follows the OS via `useColorScheme()`. `src/theme/tokens.ts` ships light
and dark palettes; the light variant is the canonical brand surface
(cream paper + vermillion accent), the dark variant is a warm-black
reader-comfort accommodation that keeps the same design language.

## Internationalization

Three locales are wired today: `en`, `es`, `zh-Hans`. The initial locale
is detected from `expo-localization`'s `getLocales()[0].languageTag`
with coarse mapping (any `es-*` → `es`, any `zh-Hans*` or `zh-CN*` →
`zh-Hans`, everything else → `en`). Only the `chrome` namespace has
content in M1; the other namespaces are registered empty so
`useTranslation('home')` doesn't error once wave B starts porting
screens.

## Sentry

Initialization is deferred via `InteractionManager.runAfterInteractions`
so Sentry's SDK does not compete with the first paint (mirrors the PWA's
`requestIdleCallback` post-LCP pattern). It no-ops when
`EXPO_PUBLIC_SENTRY_DSN` is unset — local dev needs no Sentry setup.

`sendDefaultPii: false` + `beforeSend` URL-sanitizer strip querystrings
so WebSocket tokens cannot leak into breadcrumbs.

## Troubleshooting

### "Unable to resolve module @/..." in Metro

Check that the path alias matches between `tsconfig.json`
(`paths: { "@/*": ["./src/*"] }`) and your import. Metro learns the
alias through `babel-preset-expo`'s built-in module resolver via the
`tsconfig.json` paths — restart Metro after editing either file:

```bash
pnpm --filter @weavenyc/mobile start --clear
```

### "CocoaPods could not find compatible versions for pod" during prebuild

Run `pod repo update` once (`cd ios && pod repo update && cd ..`), then
retry `pnpm mobile:ios`.

### pnpm symlinks confuse Metro on the monorepo

If Metro can't find a dep that `pnpm list` clearly shows, the symlink
layer is probably out of sync:

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Reanimated runtime error: `_WORKLET is not defined`

Plugin-order issue. `react-native-reanimated/plugin` MUST be the LAST
entry in `babel.config.js`'s `plugins` array. Restart Metro with
`--clear` after fixing.

### "New Architecture enabled but pods not rebuilt"

After any change to `app.json`'s `newArchEnabled` or a native module's
config plugin, wipe `ios/` and let `expo prebuild` regenerate it:

```bash
rm -rf apps/mobile/ios
pnpm --filter @weavenyc/mobile prebuild:ios
```

### Clearing Metro cache

```bash
pnpm --filter @weavenyc/mobile start --clear
# or nuclear:
watchman watch-del-all 2>/dev/null
rm -rf /tmp/metro-* /tmp/haste-map-*
```

## What's NOT in this scaffold

Explicitly out of scope for M1 (tracked by parallel agents):

- The 20 atoms — wave B (agents M2/M3/M4)
- Full i18n key port — M5
- Persistence (MMKV-backed query cache, offline outbox) — wave B
- Sentry runtime breadcrumbs + performance spans — wave B
- Screen ports beyond the 5 placeholder tabs — waves B and C
- CI workflow — wave 2 (agent M7)
- EAS build + device cert — release ops M8
