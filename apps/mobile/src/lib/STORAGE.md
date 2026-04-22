# Storage migration notes — M2 (PWA → mobile)

This doc maps the PWA's web-storage APIs to their React Native
equivalents so the M6 rewrite of `persistence.ts` + `db.ts` starts
from a pre-agreed shape. The goal of the M2 lib port is **not** to
ship a working persistence layer on mobile — it's to copy the pure
logic over verbatim, leave the storage-bound paths as TODO-guarded
no-ops (see `@/lib/persistence` in this directory, which is a stub
that returns null for every read), and document the target shape so
M6 knows what to build against.

## Surface-by-surface mapping

| PWA surface             | Access pattern (PWA)                         | Mobile replacement               | Access pattern (mobile)                                      | Where it's touched today                                                                       |
| ----------------------- | -------------------------------------------- | -------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `window.localStorage`   | `localStorage.setItem` / `getItem`           | `react-native-mmkv`              | `new MMKV({ id }).set(key, val)` / `.getString(key)`         | `@/lib/api.ts::getOrCreateDeviceId` (device ID); M6 will also route preferences + session here |
| `window.sessionStorage` | `sessionStorage.setItem` / `getItem`         | `react-native-mmkv` (namespaced) | `new MMKV({ id: 'match-intent-storage' }).set(...)`          | `@/lib/match-intent.ts` — M2 already routes through MMKV (persistent, not tab-scoped)          |
| `indexedDB` / Dexie     | `db.table.where(...).toArray()` / `put(...)` | `expo-sqlite`                    | `SQLiteProvider` + typed helpers around `useSQLiteContext()` | `@/lib/persistence.ts` stub today; M6 will back the cached-posts / outbox / P2P tables there   |
| Cookie jar              | `document.cookie`                            | — (n/a)                          | —                                                            | Not used — auth is Bearer-header-only, no cookies to migrate                                   |
| Service worker cache    | `caches.open(...)`                           | — (n/a)                          | —                                                            | Not used on mobile — Expo bundles ship with the app                                            |

## Why MMKV for KV, SQLite for relational

**MMKV** (`react-native-mmkv` v3) — fastest K/V store on RN; synchronous,
typed reads, backed by memory-mapped files. Perfect for small, read-hot
state:

- Device ID (1 key)
- Auth session refresh token (1 key, plaintext is fine because it's
  already persisted — in M8 the refresh token will be mirrored into
  `expo-secure-store` for at-rest encryption, but that's a parallel
  track)
- Preferences (language, ZIP, bookmarks — all ≤1KB)
- Post-draft (1 key, rewritten on every keystroke-throttle)
- Current community (1 key)
- Match-contact intent (1 key, per-session in the PWA; persistent on
  mobile — user expectation is slightly different since there's no
  "tab" on native)

**expo-sqlite** — for multi-row tables where we'd otherwise hand-roll
JSON arrays:

- `pendingPosts` (offline outbox — 0-100 rows, keyed by `client_id`,
  indexed by `community_id` and `created_at` for the drain walk)
- `postCache` (per-community-per-scope cached post list — relatively
  large blob that wants indexed lookups, not a linear scan)
- `announcementCache` (same shape, smaller blob)
- `p2pEventCursor` + `p2pSyncState` + `p2pKeys` (one row per
  `communityId`, could live in MMKV instead — M6 will pick the
  lighter-weight option if there's only ever a handful of communities
  per device)

## Jest-safety

Both MMKV and expo-sqlite ship with JSI bindings that aren't
available under the `node` jest preset. Every stub + port guards the
native module behind a try/catch and falls back to a null/empty
return, which:

1. Keeps the M2 imports test green — the stub module evaluates
   without throwing, even though the underlying native module is
   absent in the test sandbox.
2. Keeps the PWA's SSR-safe pattern intact — the PWA guarded on
   `typeof window === 'undefined'`, we guard on `MMKV constructor
   threw`. Same semantic: "persistence isn't available, treat every
   read as a cache miss and every write as a no-op".

Once `jest-expo` is wired in M6, the jest preset change will unlock
real MMKV/SQLite mocks, at which point the try/catch can stay
(defensive — MMKV can still fail on corrupted files) but tests can
start asserting real round-trips instead of just module-load.

## Secure storage

Out of scope for M2. The PWA stores the refresh token in IndexedDB
(unencrypted). The same data on mobile will move into
`expo-secure-store` in a later task (M8 or wave C), not M2. That
migration is a **separate pass** — not something the lib-port should
try to do opportunistically, because it requires re-shaping the
`saveSession` / `loadSession` interface.

## What M2 does NOT ship

- No real SQLite schema (M6).
- No real MMKV mocks in jest (M6 / wave B jest-expo).
- No secure-storage round-trip for session (M8).
- No migration tool from IndexedDB → SQLite. There's no shared-state
  crossover here because PWA and mobile are two separate apps with
  two separate user caches.
