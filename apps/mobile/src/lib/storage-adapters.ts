/**
 * Low-level RN storage adapters — MMKV, expo-sqlite, expo-secure-store.
 *
 * Wave B M6 port of the PWA's Dexie-on-IndexedDB layer. Each adapter
 * exposes a Promise-based surface that mirrors the Dexie API shape the
 * PWA callers used, so the ported `persistence.ts` needs no sync/async
 * gymnastics and the PWA's existing business logic ports verbatim.
 *
 * Why three backends, not one:
 *   - MMKV (synchronous, fast, hardware-accelerated JSI) for small KV
 *     rows read on hot paths (preferences, session metadata, bookmarks,
 *     joined communities, post drafts). The PWA treated these as
 *     single-key Dexie reads; MMKV reads are measured in microseconds.
 *   - expo-sqlite for relational / indexed data (outbox, post cache,
 *     announcement cache, P2P sync state). The PWA's Dexie tables used
 *     secondary indexes (e.g. `community_id`, `created_at`) which map
 *     cleanly to SQLite rows + indexed columns; MMKV alone can't service
 *     a `WHERE community_id = ? ORDER BY created_at` scan efficiently.
 *   - expo-secure-store for secrets (refresh_token, P2P private keys).
 *     These land in the hardware-encrypted iOS Keychain / Android
 *     KeyStore, which MMKV and SQLite do NOT provide. The PWA wrote
 *     these to IndexedDB; on native that would be a regression.
 *
 * The storage-adapters module is intentionally thin — it does not know
 * anything about WeaveNYC domain types. The `db.ts` layer maps each
 * Dexie table onto one of these adapters and exposes a Table-shaped
 * object whose `.get()` / `.put()` / `.delete()` / `.toArray()` /
 * `.where().equals().toArray()` / `.bulkPut()` / `.clear()` methods
 * match the subset of Dexie that `persistence.ts` actually uses.
 *
 * All three backends are lazy-initialised so the module is safe to
 * import from test contexts where the native modules may not be
 * registered. When a backend is unavailable (e.g. jest Node env), the
 * returned Promise resolves to null-ish defaults rather than throwing —
 * this matches the PWA's `getPwaDb() === null` bail pattern and means
 * every caller's existing try/catch stays intact.
 */

import { MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

/* ------------------------------------------------------------------ */
/* MMKV adapter                                                        */
/* ------------------------------------------------------------------ */

let mmkvInstance: MMKV | null = null;
let mmkvInitFailed = false;

function getMmkv(): MMKV | null {
  if (mmkvInitFailed) {
    return null;
  }
  if (mmkvInstance) {
    return mmkvInstance;
  }
  try {
    // Single shared instance — we namespace via key prefixes rather than
    // separate MMKV instances, so hydration is one JSI call per row.
    mmkvInstance = new MMKV({ id: "weavenyc-mobile" });
    return mmkvInstance;
  } catch (error) {
    // Happens in jest Node env where the JSI bridge isn't available. We
    // never want a storage-layer import to crash an unrelated test.
    void error;
    mmkvInitFailed = true;
    return null;
  }
}

/**
 * Promise-wrapped JSON-serialising MMKV adapter. Mirrors the Dexie
 * single-key-table shape: each adapter instance owns a key prefix and
 * exposes `get` / `set` / `delete` / `keys`.
 *
 * Returning Promises keeps call sites awaitable — the PWA code already
 * uses `await db.kv.get(...)` everywhere. Under the hood MMKV reads are
 * synchronous so there's zero extra latency; we just wrap the result in
 * Promise.resolve so the ported callers don't need sync/async branching.
 */
export type MmkvAdapter<T> = {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clearPrefix(): Promise<void>;
};

export function createMmkvAdapter<T>(prefix: string): MmkvAdapter<T> {
  const withPrefix = (key: string) => `${prefix}:${key}`;

  return {
    async get(key: string): Promise<T | null> {
      const mmkv = getMmkv();
      if (!mmkv) {
        return null;
      }
      const raw = mmkv.getString(withPrefix(key));
      if (raw === undefined) {
        return null;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        // Corrupted row — treat as missing so callers fall back to
        // fetching from the network. Delete it so we don't re-hit the
        // parse failure on every load.
        mmkv.delete(withPrefix(key));
        return null;
      }
    },
    async set(key: string, value: T): Promise<void> {
      const mmkv = getMmkv();
      if (!mmkv) {
        return;
      }
      try {
        mmkv.set(withPrefix(key), JSON.stringify(value));
      } catch {
        // Serialisation failure (e.g. BigInt in payload). Swallow —
        // storage is best-effort, callers already handle missing rows.
      }
    },
    async delete(key: string): Promise<void> {
      const mmkv = getMmkv();
      if (!mmkv) {
        return;
      }
      mmkv.delete(withPrefix(key));
    },
    async keys(): Promise<string[]> {
      const mmkv = getMmkv();
      if (!mmkv) {
        return [];
      }
      const all = mmkv.getAllKeys();
      const needle = `${prefix}:`;
      return all
        .filter((k) => k.startsWith(needle))
        .map((k) => k.slice(needle.length));
    },
    async clearPrefix(): Promise<void> {
      const mmkv = getMmkv();
      if (!mmkv) {
        return;
      }
      const all = mmkv.getAllKeys();
      const needle = `${prefix}:`;
      for (const k of all) {
        if (k.startsWith(needle)) {
          mmkv.delete(k);
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* SecureStore adapter (refresh_token, P2P private keys)               */
/* ------------------------------------------------------------------ */

/**
 * Thin Promise wrapper around `expo-secure-store`. SecureStore keys have
 * a tighter character set than MMKV (alphanum + dot/dash/underscore), so
 * we sanitise the community-id suffix before hitting the native layer.
 *
 * SECURITY (docs/18 §4.3, A1 P1-6): the refresh_token and P2P private
 * keys must land in the Keychain/KeyStore so they are
 * hardware-encrypted and survive a process kill without leaking to an
 * attacker with filesystem access. MMKV backs the app's doc-dir, which
 * is accessible to a jailbroken device.
 */
export type SecureStoreAdapter = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

function sanitizeSecureStoreKey(key: string): string {
  // SecureStore enforces /^[A-Za-z0-9._\-]+$/. Everything else we
  // replace with `_` so the underlying native call never rejects on a
  // colon-separated prefix like `p2p-key:comm_abc`.
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function createSecureStoreAdapter(prefix: string): SecureStoreAdapter {
  const withPrefix = (key: string) => sanitizeSecureStoreKey(`${prefix}_${key}`);

  return {
    async get(key: string): Promise<string | null> {
      try {
        return await SecureStore.getItemAsync(withPrefix(key));
      } catch {
        return null;
      }
    },
    async set(key: string, value: string): Promise<void> {
      try {
        await SecureStore.setItemAsync(withPrefix(key), value);
      } catch {
        // Hardware-backed keystore can fail on simulators / devices
        // with no passcode set; fall back silently rather than surfacing
        // a crash to the caller — the in-memory path continues working.
      }
    },
    async delete(key: string): Promise<void> {
      try {
        await SecureStore.deleteItemAsync(withPrefix(key));
      } catch {
        // Absent key throws on some platforms — callers expect no-op.
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* SQLite adapter                                                      */
/* ------------------------------------------------------------------ */

/**
 * expo-sqlite (>=13) exposes a Promise-based API
 * (`openDatabaseAsync` + `execAsync` / `runAsync` / `getFirstAsync` /
 * `getAllAsync`). We cache the db handle for the lifetime of the
 * process — opening is cheap but not free and the JSI bridge round-trip
 * on every call would show up on feed hydration profiles.
 */
export type SqliteHandle = {
  run(sql: string, params?: unknown[]): Promise<void>;
  getFirst<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAll<T>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  withTransaction<R>(fn: (tx: SqliteHandle) => Promise<R>): Promise<R>;
};

type ExpoSQLiteDb = {
  runAsync(sql: string, params?: unknown[]): Promise<unknown>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
};

let sqliteDbPromise: Promise<SqliteHandle | null> | null = null;

export const SQLITE_DB_NAME = "weavenyc.db";
export const SQLITE_SCHEMA_VERSION = 1;

/**
 * Opens (and initialises) the single app-wide sqlite database. Idempotent —
 * every caller awaits the same promise so schema init runs exactly once per
 * process.
 */
export function getSqliteDb(): Promise<SqliteHandle | null> {
  if (!sqliteDbPromise) {
    sqliteDbPromise = openAndInit();
  }
  return sqliteDbPromise;
}

async function openAndInit(): Promise<SqliteHandle | null> {
  try {
    const openAsync = (SQLite as unknown as {
      openDatabaseAsync?: (name: string) => Promise<ExpoSQLiteDb>;
    }).openDatabaseAsync;
    if (typeof openAsync !== "function") {
      return null;
    }
    const db = await openAsync(SQLITE_DB_NAME);
    const handle = wrapSqlite(db);
    await initializeSchema(handle);
    return handle;
  } catch (error) {
    // Native module not available in this env (most commonly: jest
    // without the expo mock). Return null so callers bail cleanly.
    void error;
    return null;
  }
}

function wrapSqlite(db: ExpoSQLiteDb): SqliteHandle {
  const handle: SqliteHandle = {
    async run(sql, params) {
      await db.runAsync(sql, params ?? []);
    },
    async getFirst<T>(sql: string, params?: unknown[]): Promise<T | null> {
      return (await db.getFirstAsync<T>(sql, params ?? [])) ?? null;
    },
    async getAll<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return (await db.getAllAsync<T>(sql, params ?? [])) ?? [];
    },
    async exec(sql) {
      await db.execAsync(sql);
    },
    async withTransaction(fn) {
      // expo-sqlite's `withTransactionAsync` takes a zero-arg callback
      // that uses the same db handle; any error inside rolls back.
      let result: unknown = undefined;
      await db.withTransactionAsync(async () => {
        result = await fn(handle);
      });
      return result as never;
    },
  };
  return handle;
}

/**
 * Idempotent schema initializer. See `SCHEMA.md` for the full table
 * listing + row shapes. We use `CREATE TABLE IF NOT EXISTS` + a
 * `metadata(__version)` row so future migrations can walk a version
 * number and apply forward-only ALTERs.
 */
async function initializeSchema(db: SqliteHandle): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_posts (
      client_id TEXT PRIMARY KEY NOT NULL,
      community_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      last_error TEXT,
      last_failure_permanent INTEGER NOT NULL DEFAULT 0,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pending_posts_community
      ON pending_posts(community_id);
    CREATE INDEX IF NOT EXISTS idx_pending_posts_created_at
      ON pending_posts(created_at);

    CREATE TABLE IF NOT EXISTS post_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      community_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_post_cache_community
      ON post_cache(community_id);

    CREATE TABLE IF NOT EXISTS announcement_cache (
      community_id TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS p2p_sync_state (
      community_id TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS p2p_event_cursor (
      community_id TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS p2p_key_meta (
      community_id TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);

  const existing = await db.getFirst<{ value: string | null }>(
    "SELECT value FROM metadata WHERE key = ?",
    ["__version"],
  );
  if (!existing) {
    await db.run("INSERT INTO metadata(key, value) VALUES(?, ?)", [
      "__version",
      String(SQLITE_SCHEMA_VERSION),
    ]);
  }
}

/* ------------------------------------------------------------------ */
/* Test helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reset the memoised handles. Used by the unit tests in
 * `__tests__/persistence.test.ts` so a fresh `jest.resetModules()` call
 * can re-wire the adapters without carrying state from the previous
 * test's `beforeEach` setup.
 */
export function __resetStorageAdaptersForTesting(): void {
  mmkvInstance = null;
  mmkvInitFailed = false;
  sqliteDbPromise = null;
}
