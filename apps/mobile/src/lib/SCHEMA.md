# Mobile persistence schema (Wave B M6)

Port of the PWA's Dexie/IndexedDB layer to three React Native backends:

- **MMKV** (`react-native-mmkv`) — synchronous JSI KV store. Fast. Backs the app's doc-dir.
- **expo-sqlite** — on-device relational store. Indexed scans + transactions.
- **expo-secure-store** — hardware-encrypted Keychain (iOS) / KeyStore (Android). Secrets only.

Every Dexie table / KV key from `apps/pwa/src/lib/db.ts` maps to exactly one of these backends. The same exported function names in `apps/mobile/src/lib/persistence.ts` preserve the PWA call contract, so Wave C/D atoms and screens can use the PWA helpers verbatim.

---

## Backend selection — Dexie → mobile mapping

| PWA Dexie store / KV key | Mobile backend | Location |
|-|-|-|
| `kv["preferences"]` | MMKV | `kv:preferences` |
| `kv["auth-session"]` (user + issued_via + fallback) | MMKV | `kv:auth-session` |
| `kv["auth-session"]` (refresh_token) | SecureStore | `wvnc_refresh_primary` |
| `kv["community-current"]` | MMKV | `kv:community-current` |
| `kv["p2p-event-log:<communityId>"]` | MMKV | `kv:p2p-event-log:<communityId>` |
| `joinedCommunities` table | MMKV | `joined-community:<communityId>` |
| `drafts` table (`post-draft`) | MMKV | `draft:post-draft` |
| `pendingPosts` table | SQLite | `pending_posts` |
| `postCache` table | SQLite | `post_cache` |
| `announcementCache` table | SQLite | `announcement_cache` |
| `p2pSyncState` table | SQLite | `p2p_sync_state` |
| `p2pEventCursor` table | SQLite | `p2p_event_cursor` |
| `p2pKeys` table (metadata only) | SQLite | `p2p_key_meta` |
| P2P private keys (new in mobile) | SecureStore | `wvnc_p2p_key_<communityId>` |

Total: **10** PWA table/KV keys → **3** MMKV prefixes, **6** SQLite tables, **2** SecureStore namespaces (metadata table + schema-version row brings SQLite count to **7**).

The rationale for splitting across backends, per group:

- **Small hot-path KV** (preferences, session metadata, current community, post drafts, joined communities) — MMKV. JSI-sync reads are measured in microseconds; no batching, no cursor, no query planner needed. MMKV is the right default for anything that's a single-key-by-id fetch on every screen mount.
- **Relational / indexed data** (outbox, post cache, announcement cache, P2P state) — SQLite. These tables need `WHERE community_id = ?` scans (the outbox UI scopes by current community), `ORDER BY created_at` (drain oldest-first), and bulk round-trips. MMKV can't service those efficiently.
- **Secrets** (refresh_token, P2P private keys) — SecureStore. The Keychain/KeyStore is hardware-encrypted and survives a process kill without leaking to an attacker with filesystem access. MMKV and SQLite live in the app's doc-dir, which is exposed on jailbroken devices.

---

## MMKV prefixes

MMKV is a single shared instance (`id: "weavenyc-mobile"`). Each logical "table" owns a prefix; keys are namespaced as `<prefix>:<id>`.

| Prefix | Row shape | Notes |
|-|-|-|
| `kv` | `{ key: string, value: unknown }` | Generic KV. Used for singletons (preferences, auth metadata, current community). |
| `joined-community` | `{ communityId: string, value: JoinedCommunity }` | One row per joined community. `.toArray()` iterates every `joined-community:*` key. |
| `draft` | `{ key: string, value: PostDraftState }` | Currently holds one row (`draft:post-draft`). Prefixed for future per-community drafts. |

---

## SQLite tables

One on-device database: `weavenyc.db`. Schema initialised on first `getSqliteDb()` call; `metadata.__version` row tracks forward-only migration version.

### `metadata`

Forward-migration anchor. No payload — every user row is a `{ key, value }` pair.

```sql
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);
```

- `metadata.__version` — integer stringified. Current value: `1`. Future migrations read this, apply `ALTER TABLE` steps forward-only, bump the row.

### `pending_posts`

Offline write outbox (F1-β). Rows stay until successfully posted OR explicitly discarded. See `docs/offline-outbox.md`.

```sql
CREATE TABLE IF NOT EXISTS pending_posts (
  client_id TEXT PRIMARY KEY NOT NULL,
  community_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  last_error TEXT,
  last_failure_permanent INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL                  -- JSON.stringify(CreatePostInput)
);
CREATE INDEX IF NOT EXISTS idx_pending_posts_community ON pending_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_pending_posts_created_at ON pending_posts(created_at);
```

- `community_id` indexed so the pending-posts UI scopes by current community cheaply.
- `created_at` indexed so the drain pass processes oldest-first.
- `last_failure_permanent` stored as 0/1; converted to boolean at the TS layer.

### `post_cache`

Offline feed cache — one row per `(community_id, scope)` pair.

```sql
CREATE TABLE IF NOT EXISTS post_cache (
  cache_key TEXT PRIMARY KEY NOT NULL,   -- e.g. "comm_1:community" or "comm_1:public"
  community_id TEXT NOT NULL,
  scope TEXT NOT NULL,                   -- "community" | "public"
  value TEXT NOT NULL,                   -- JSON.stringify(CachedPostsValue)
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_post_cache_community ON post_cache(community_id);
```

- `value` JSON round-trips the full `CachedPostsValue` (items + next_cursor + source + updatedAt).
- Tombstones remain in `value.items` with `status: 'removed'` for 7 days (`TOMBSTONE_RETENTION_MS`). After that the replay pass drops them.

### `announcement_cache`

One row per community.

```sql
CREATE TABLE IF NOT EXISTS announcement_cache (
  community_id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,                   -- JSON.stringify(CachedAnnouncementsValue)
  updated_at TEXT
);
```

### `p2p_sync_state`

One row per community. Client-local phase tracker (`'ready'`, `'degraded'`, etc.).

```sql
CREATE TABLE IF NOT EXISTS p2p_sync_state (
  community_id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL                    -- JSON.stringify(P2PSyncStatus)
);
```

### `p2p_event_cursor`

One row per community. Tracks the last successfully-applied `since` cursor.

```sql
CREATE TABLE IF NOT EXISTS p2p_event_cursor (
  community_id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL                    -- JSON.stringify(P2PEventCursor)
);
```

### `p2p_key_meta`

Metadata for the overlay peer identity. Does NOT hold any private key material — that lives in SecureStore.

```sql
CREATE TABLE IF NOT EXISTS p2p_key_meta (
  community_id TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL                    -- JSON.stringify(P2PKeyMaterial)
);
```

---

## SecureStore namespaces

Keys are ASCII-only (alphanum + `.`, `_`, `-`). The adapter prefixes and sanitizes before writing.

| Prefix | Example key | Payload |
|-|-|-|
| `wvnc_refresh` | `wvnc_refresh_primary` | Refresh token (opaque string). Single-user device assumption in Wave B. |
| `wvnc_p2p_key` | `wvnc_p2p_key_comm_abc` | Base64-encoded P2P private-key bytes, per community. |

### Access token — NOT persisted

Per `docs/18 §4.3` and `A1 P1-6`, the short-lived `access_token` is **memory-only**. It is never written to MMKV, SQLite, or SecureStore. On bootstrap the mobile app exchanges the Keychain-stored refresh token for a fresh access token via `POST /v1/auth/refresh`. This preserves the PWA's 15-min-bearer invariant on native.

---

## Migration posture

Because Wave B is a **fresh install** of the mobile app, there is no existing user data on-device to migrate. The initial schema just comes up empty. `metadata.__version = "1"` is seeded on first boot so future schema evolutions can:

1. Read the current version with `SELECT value FROM metadata WHERE key = '__version'`.
2. Apply forward-only `ALTER TABLE` / index creation for each step.
3. Write the new version with `UPDATE metadata SET value = ? WHERE key = '__version'`.

No legacy-format data shims are required. When Wave C / D introduces new columns (e.g. `tombstoned_at` as a native SQLite column rather than embedded JSON), they can be added as nullable via `ALTER TABLE` with zero disruption.
