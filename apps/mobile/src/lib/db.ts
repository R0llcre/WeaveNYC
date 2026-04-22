/**
 * RN "database" layer — the mobile-side analogue of
 * `apps/pwa/src/lib/db.ts` (Dexie/IndexedDB).
 *
 * The PWA's Dexie instance hosted eight stores (`kv`,
 * `joinedCommunities`, `drafts`, `postCache`, `announcementCache`,
 * `p2pKeys`, `p2pSyncState`, `p2pEventCursor`, `pendingPosts`). Mobile
 * splits those across three backends (see `SCHEMA.md` for the full
 * table + row-shape breakdown):
 *
 *   - MMKV (sync + fast)             kv, drafts, joinedCommunities
 *   - expo-sqlite (relational)       pendingPosts, postCache,
 *                                    announcementCache, p2pSyncState,
 *                                    p2pEventCursor, p2pKeyMeta
 *   - expo-secure-store (Keychain)   refresh_token + P2P private keys
 *                                    (wired from persistence.ts)
 *
 * `getPwaDb()` (yes, the name is kept for parity) returns a
 * Table-shaped object per Dexie "store" that mirrors the subset of
 * Dexie's API the PWA `persistence.ts` actually uses — `.get()`,
 * `.put()`, `.delete()`, `.toArray()`, `.bulkPut()`, `.clear()`, and
 * `.where(field).equals(value).toArray()`. That lets every PWA caller
 * port verbatim.
 *
 * The object shape is always non-null (unlike the PWA which bails when
 * `window === undefined` from SSR); the underlying adapters return
 * empty / no-op results if the native modules aren't wired (e.g. jest
 * Node env). This keeps the calling contract identical: every read can
 * fail-soft, every write is best-effort.
 */

import {
  SQLITE_DB_NAME,
  SQLITE_SCHEMA_VERSION,
  createMmkvAdapter,
  getSqliteDb,
  type MmkvAdapter,
  type SqliteHandle,
} from "@/lib/storage-adapters";

import type {
  CachedAnnouncementsValue,
  CachedPostsValue,
  CreatePostInput,
  JoinedCommunity,
  P2PEventCursor,
  P2PKeyMaterial,
  P2PSyncStatus,
  PostDraftState,
} from "@/lib/types";

export { SQLITE_DB_NAME, SQLITE_SCHEMA_VERSION };

/* ------------------------------------------------------------------ */
/* Dexie-shaped row types — kept identical to the PWA file so the      */
/* ported persistence layer can reference the same generics.           */
/* ------------------------------------------------------------------ */

type KvRow = {
  key: string;
  value: unknown;
};

type JoinedCommunityRow = {
  communityId: string;
  value: JoinedCommunity;
};

type DraftRow = {
  key: string;
  value: PostDraftState;
};

type PostCacheRow = {
  cacheKey: string;
  communityId: string;
  scope: CachedPostsValue["scope"];
  value: CachedPostsValue;
};

type AnnouncementCacheRow = {
  communityId: string;
  value: CachedAnnouncementsValue;
};

type P2PKeyRow = {
  communityId: string;
  value: P2PKeyMaterial;
};

type P2PSyncStateRow = {
  communityId: string;
  value: P2PSyncStatus;
};

type P2PEventCursorRow = {
  communityId: string;
  value: P2PEventCursor;
};

/**
 * Write outbox — posts queued on the device (often while offline) waiting
 * for a successful POST. Mirrors the PWA's `PendingPostEntry` verbatim so
 * `use-outbox-drain.ts` (ported in M2) can call the same persistence API
 * without a shim. See `docs/offline-outbox.md`.
 */
export type PendingPostEntry = {
  /** Primary key — `crypto.randomUUID()` generated at publish-time. */
  client_id: string;
  /** ISO timestamp of the publish tap. Used only for display / ordering. */
  created_at: string;
  /** How many times the drain loop has attempted this entry. */
  attempt_count: number;
  /** ISO timestamp of the most recent drain attempt, or null before first try. */
  last_attempt_at: string | null;
  /** Human-readable error string from the last failed attempt; null on fresh entries. */
  last_error: string | null;
  /** Whether the last failure was a 4xx semantic rejection (no auto-retry). */
  last_failure_permanent: boolean;
  /** Full payload the compose screen built — replayed verbatim by the drain. */
  payload: CreatePostInput;
  /** Community scope so the pending-posts UI can filter by current community. */
  community_id: string;
};

/* ------------------------------------------------------------------ */
/* Dexie-shaped facade                                                 */
/* ------------------------------------------------------------------ */

/**
 * Dexie `Table<T, PK>`-shaped wrapper. Exposes the minimal subset of
 * Dexie's surface the PWA persistence helpers actually call. When a
 * table is backed by MMKV the methods forward to an MmkvAdapter; when
 * it's backed by SQLite they build parameterised queries.
 */
export type TableLike<Row> = {
  get(key: string): Promise<Row | undefined>;
  put(row: Row): Promise<void>;
  delete(key: string): Promise<void>;
  toArray(): Promise<Row[]>;
  /** Only implemented on tables persistence actually uses it on. */
  clear?(): Promise<void>;
  bulkPut?(rows: Row[]): Promise<void>;
  where?(field: string): {
    equals(needle: unknown): {
      toArray(): Promise<Row[]>;
    };
  };
};

/**
 * Top-level facade mirroring the PWA's `WeavePwaDb` Dexie instance.
 * Every field exposes a `TableLike<...>` that the ported persistence
 * code can treat as a Dexie `Table`.
 */
export type WeaveMobileDb = {
  kv: TableLike<KvRow>;
  joinedCommunities: TableLike<JoinedCommunityRow>;
  drafts: TableLike<DraftRow>;
  postCache: TableLike<PostCacheRow>;
  announcementCache: TableLike<AnnouncementCacheRow>;
  p2pKeys: TableLike<P2PKeyRow>;
  p2pSyncState: TableLike<P2PSyncStateRow>;
  p2pEventCursor: TableLike<P2PEventCursorRow>;
  pendingPosts: TableLike<PendingPostEntry>;
  /**
   * Dexie-style transaction shim. The PWA uses this exactly once, in
   * `saveCommunityState`, to atomically `clear + bulkPut` the
   * joinedCommunities store. For MMKV we just run the callback — the
   * cost of a lost-mid-mutation is one stale join badge at worst, and
   * the write is a single hot-path so the probability is negligible.
   */
  transaction<T>(
    mode: "rw",
    tables: TableLike<unknown> | TableLike<unknown>[],
    fn: () => Promise<T>,
  ): Promise<T>;
};

/* ------------------------------------------------------------------ */
/* MMKV-backed table factory                                           */
/* ------------------------------------------------------------------ */

/**
 * Factory for MMKV-backed tables whose row shape is `{ key, value }` /
 * `{ communityId, value }` / `{ key, value }`. Takes a key-getter so the
 * primary-key field name (Dexie's `&key` / `&communityId`) stays
 * explicit in the Table definition.
 */
function mmkvTable<Row>(
  prefix: string,
  getKey: (row: Row) => string,
): TableLike<Row> {
  const adapter: MmkvAdapter<Row> = createMmkvAdapter<Row>(prefix);
  return {
    async get(key: string): Promise<Row | undefined> {
      const value = await adapter.get(key);
      return value ?? undefined;
    },
    async put(row: Row): Promise<void> {
      await adapter.set(getKey(row), row);
    },
    async delete(key: string): Promise<void> {
      await adapter.delete(key);
    },
    async toArray(): Promise<Row[]> {
      const keys = await adapter.keys();
      const rows: Row[] = [];
      for (const k of keys) {
        const v = await adapter.get(k);
        if (v !== null && v !== undefined) {
          rows.push(v);
        }
      }
      return rows;
    },
    async clear(): Promise<void> {
      await adapter.clearPrefix();
    },
    async bulkPut(rows: Row[]): Promise<void> {
      for (const row of rows) {
        await adapter.set(getKey(row), row);
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* SQLite-backed tables                                                */
/* ------------------------------------------------------------------ */

function sqliteSingleColumnTable<Row>(options: {
  tableName: string;
  primaryKeyColumn: string;
  getPrimaryKey: (row: Row) => string;
  serialize: (row: Row) => string;
  deserialize: (json: string) => Row;
}): TableLike<Row> {
  const { tableName, primaryKeyColumn, getPrimaryKey, serialize, deserialize } =
    options;

  return {
    async get(key: string): Promise<Row | undefined> {
      const db = await getSqliteDb();
      if (!db) return undefined;
      const row = await db.getFirst<{ value: string }>(
        `SELECT value FROM ${tableName} WHERE ${primaryKeyColumn} = ?`,
        [key],
      );
      if (!row?.value) return undefined;
      try {
        return deserialize(row.value);
      } catch {
        return undefined;
      }
    },
    async put(row: Row): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(
        `INSERT OR REPLACE INTO ${tableName}(${primaryKeyColumn}, value) VALUES(?, ?)`,
        [getPrimaryKey(row), serialize(row)],
      );
    },
    async delete(key: string): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(
        `DELETE FROM ${tableName} WHERE ${primaryKeyColumn} = ?`,
        [key],
      );
    },
    async toArray(): Promise<Row[]> {
      const db = await getSqliteDb();
      if (!db) return [];
      const rows = await db.getAll<{ value: string }>(
        `SELECT value FROM ${tableName}`,
      );
      const out: Row[] = [];
      for (const r of rows) {
        try {
          out.push(deserialize(r.value));
        } catch {
          // Corrupted row — skip so a single bad write doesn't poison
          // every subsequent read.
        }
      }
      return out;
    },
    async clear(): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(`DELETE FROM ${tableName}`);
    },
    async bulkPut(rows: Row[]): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.withTransaction(async (tx: SqliteHandle) => {
        for (const row of rows) {
          await tx.run(
            `INSERT OR REPLACE INTO ${tableName}(${primaryKeyColumn}, value) VALUES(?, ?)`,
            [getPrimaryKey(row), serialize(row)],
          );
        }
      });
    },
  };
}

function postCacheTable(): TableLike<PostCacheRow> {
  return {
    async get(key: string): Promise<PostCacheRow | undefined> {
      const db = await getSqliteDb();
      if (!db) return undefined;
      const row = await db.getFirst<{
        cache_key: string;
        community_id: string;
        scope: string;
        value: string;
      }>(
        `SELECT cache_key, community_id, scope, value
         FROM post_cache WHERE cache_key = ?`,
        [key],
      );
      if (!row) return undefined;
      try {
        return {
          cacheKey: row.cache_key,
          communityId: row.community_id,
          scope: row.scope as CachedPostsValue["scope"],
          value: JSON.parse(row.value) as CachedPostsValue,
        };
      } catch {
        return undefined;
      }
    },
    async put(row: PostCacheRow): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(
        `INSERT OR REPLACE INTO post_cache(cache_key, community_id, scope, value, updated_at)
         VALUES(?, ?, ?, ?, ?)`,
        [
          row.cacheKey,
          row.communityId,
          row.scope,
          JSON.stringify(row.value),
          row.value.updatedAt ?? null,
        ],
      );
    },
    async delete(key: string): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(`DELETE FROM post_cache WHERE cache_key = ?`, [key]);
    },
    async toArray(): Promise<PostCacheRow[]> {
      const db = await getSqliteDb();
      if (!db) return [];
      const rows = await db.getAll<{
        cache_key: string;
        community_id: string;
        scope: string;
        value: string;
      }>(`SELECT cache_key, community_id, scope, value FROM post_cache`);
      const out: PostCacheRow[] = [];
      for (const r of rows) {
        try {
          out.push({
            cacheKey: r.cache_key,
            communityId: r.community_id,
            scope: r.scope as CachedPostsValue["scope"],
            value: JSON.parse(r.value) as CachedPostsValue,
          });
        } catch {
          /* skip corrupt */
        }
      }
      return out;
    },
    async clear(): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(`DELETE FROM post_cache`);
    },
  };
}

function pendingPostsTable(): TableLike<PendingPostEntry> {
  const rowFromSqlite = (r: {
    client_id: string;
    community_id: string;
    created_at: string;
    attempt_count: number;
    last_attempt_at: string | null;
    last_error: string | null;
    last_failure_permanent: number;
    payload: string;
  }): PendingPostEntry => ({
    client_id: r.client_id,
    community_id: r.community_id,
    created_at: r.created_at,
    attempt_count: r.attempt_count,
    last_attempt_at: r.last_attempt_at,
    last_error: r.last_error,
    last_failure_permanent: r.last_failure_permanent === 1,
    payload: JSON.parse(r.payload) as CreatePostInput,
  });

  return {
    async get(key: string): Promise<PendingPostEntry | undefined> {
      const db = await getSqliteDb();
      if (!db) return undefined;
      const row = await db.getFirst<Parameters<typeof rowFromSqlite>[0]>(
        `SELECT client_id, community_id, created_at, attempt_count,
                last_attempt_at, last_error, last_failure_permanent, payload
         FROM pending_posts WHERE client_id = ?`,
        [key],
      );
      if (!row) return undefined;
      try {
        return rowFromSqlite(row);
      } catch {
        return undefined;
      }
    },
    async put(row: PendingPostEntry): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(
        `INSERT OR REPLACE INTO pending_posts(
           client_id, community_id, created_at, attempt_count,
           last_attempt_at, last_error, last_failure_permanent, payload
         ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.client_id,
          row.community_id,
          row.created_at,
          row.attempt_count,
          row.last_attempt_at,
          row.last_error,
          row.last_failure_permanent ? 1 : 0,
          JSON.stringify(row.payload),
        ],
      );
    },
    async delete(key: string): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(`DELETE FROM pending_posts WHERE client_id = ?`, [key]);
    },
    async toArray(): Promise<PendingPostEntry[]> {
      const db = await getSqliteDb();
      if (!db) return [];
      const rows = await db.getAll<Parameters<typeof rowFromSqlite>[0]>(
        `SELECT client_id, community_id, created_at, attempt_count,
                last_attempt_at, last_error, last_failure_permanent, payload
         FROM pending_posts`,
      );
      const out: PendingPostEntry[] = [];
      for (const r of rows) {
        try {
          out.push(rowFromSqlite(r));
        } catch {
          /* skip corrupt */
        }
      }
      return out;
    },
    async clear(): Promise<void> {
      const db = await getSqliteDb();
      if (!db) return;
      await db.run(`DELETE FROM pending_posts`);
    },
    where(field: string) {
      return {
        equals(needle: unknown) {
          return {
            async toArray(): Promise<PendingPostEntry[]> {
              const db = await getSqliteDb();
              if (!db) return [];
              // Validate field against the known indexed columns — Dexie
              // `.where()` is used only with `community_id` and
              // `created_at` today. Gating avoids SQL-injection via a
              // dynamic column name (even though `field` only comes from
              // our own call sites, keeping this explicit is cheap).
              const allowed = new Set([
                "community_id",
                "created_at",
                "client_id",
              ]);
              if (!allowed.has(field)) {
                return [];
              }
              const rows = await db.getAll<Parameters<typeof rowFromSqlite>[0]>(
                `SELECT client_id, community_id, created_at, attempt_count,
                        last_attempt_at, last_error, last_failure_permanent, payload
                 FROM pending_posts WHERE ${field} = ?`,
                [needle as string],
              );
              const out: PendingPostEntry[] = [];
              for (const r of rows) {
                try {
                  out.push(rowFromSqlite(r));
                } catch {
                  /* skip corrupt */
                }
              }
              return out;
            },
          };
        },
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Public facade — mirrors `getPwaDb()` from the PWA.                  */
/* ------------------------------------------------------------------ */

let instance: WeaveMobileDb | null = null;

/**
 * Returns the single app-wide DB facade. Name kept as `getPwaDb` for
 * parity with the PWA so ported modules (persistence, use-outbox-drain,
 * atoms that directly call storage) don't have to rename their import.
 * An alias `getMobileDb` is exported for future readability.
 */
export function getPwaDb(): WeaveMobileDb {
  if (!instance) {
    instance = buildDb();
  }
  return instance;
}

export const getMobileDb = getPwaDb;

function buildDb(): WeaveMobileDb {
  const kv = mmkvTable<KvRow>("kv", (row) => row.key);
  const joinedCommunities = mmkvTable<JoinedCommunityRow>(
    "joined-community",
    (row) => row.communityId,
  );
  const drafts = mmkvTable<DraftRow>("draft", (row) => row.key);

  const postCache = postCacheTable();

  const announcementCache = sqliteSingleColumnTable<AnnouncementCacheRow>({
    tableName: "announcement_cache",
    primaryKeyColumn: "community_id",
    getPrimaryKey: (row) => row.communityId,
    serialize: (row) => JSON.stringify(row.value),
    deserialize: (json) => {
      const value = JSON.parse(json) as CachedAnnouncementsValue;
      return { communityId: value.communityId, value };
    },
  });

  const p2pKeys = sqliteSingleColumnTable<P2PKeyRow>({
    tableName: "p2p_key_meta",
    primaryKeyColumn: "community_id",
    getPrimaryKey: (row) => row.communityId,
    serialize: (row) => JSON.stringify(row.value),
    deserialize: (json) => {
      const value = JSON.parse(json) as P2PKeyMaterial;
      return { communityId: value.communityId, value };
    },
  });

  const p2pSyncState = sqliteSingleColumnTable<P2PSyncStateRow>({
    tableName: "p2p_sync_state",
    primaryKeyColumn: "community_id",
    getPrimaryKey: (row) => row.communityId,
    serialize: (row) => JSON.stringify(row.value),
    deserialize: (json) => {
      const value = JSON.parse(json) as P2PSyncStatus;
      return { communityId: value.communityId, value };
    },
  });

  const p2pEventCursor = sqliteSingleColumnTable<P2PEventCursorRow>({
    tableName: "p2p_event_cursor",
    primaryKeyColumn: "community_id",
    getPrimaryKey: (row) => row.communityId,
    serialize: (row) => JSON.stringify(row.value),
    deserialize: (json) => {
      const value = JSON.parse(json) as P2PEventCursor;
      return { communityId: value.communityId, value };
    },
  });

  const pendingPosts = pendingPostsTable();

  return {
    kv,
    joinedCommunities,
    drafts,
    postCache,
    announcementCache,
    p2pKeys,
    p2pSyncState,
    p2pEventCursor,
    pendingPosts,
    async transaction<T>(
      _mode: "rw",
      _tables: TableLike<unknown> | TableLike<unknown>[],
      fn: () => Promise<T>,
    ): Promise<T> {
      // MMKV has no multi-key atomic API. The PWA uses transaction()
      // exactly once — to clear + bulkPut joinedCommunities atomically.
      // On native, we just run the callback; a process kill between the
      // clear and the put-loop would leave joinedCommunities empty,
      // which the next hydrate rebuilds from /v1/communities/my. That is
      // acceptable for a Wave B scaffold.
      return fn();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reset the memoised DB instance. Paired with
 * `__resetStorageAdaptersForTesting` from `storage-adapters.ts`, this
 * lets each jest test restart with a clean facade without needing to
 * tear down the module graph.
 */
export function __resetDbForTesting(): void {
  instance = null;
}
