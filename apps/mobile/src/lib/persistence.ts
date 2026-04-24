/**
 * RN persistence layer — port of `apps/pwa/src/lib/persistence.ts`.
 *
 * Identical exports + semantics to the PWA version so that Wave C / D
 * atoms and screens can import the same function names without any
 * conditional plumbing. The storage backend changes; the API does not.
 *
 * Mapping — every PWA Dexie table/KV key → mobile backend:
 *
 *   | Data                           | PWA (Dexie)              | Mobile backend          |
 *   |--------------------------------|--------------------------|-------------------------|
 *   | preferences                    | kv["preferences"]        | MMKV (kv:preferences)   |
 *   | auth session (no access_token) | kv["auth-session"]       | MMKV metadata +         |
 *   |                                |                          | SecureStore(refresh)    |
 *   | current community id           | kv["community-current"]  | MMKV (kv:community-*)   |
 *   | joined communities             | joinedCommunities table  | MMKV (joined-*)         |
 *   | post drafts                    | drafts table             | MMKV (draft:*)          |
 *   | P2P event log (per community)  | kv["p2p-event-log:*"]    | MMKV (kv:p2p-event-*)   |
 *   | pendingPosts (outbox)          | pendingPosts table       | SQLite pending_posts    |
 *   | postCache (posts feed)         | postCache table          | SQLite post_cache       |
 *   | announcementCache              | announcementCache table  | SQLite announcement_c.. |
 *   | p2pSyncState                   | p2pSyncState table       | SQLite p2p_sync_state   |
 *   | p2pEventCursor                 | p2pEventCursor table     | SQLite p2p_event_cursor |
 *   | p2pKeys (metadata only)        | p2pKeys table            | SQLite p2p_key_meta     |
 *   | p2pKeys.secret (private key)   | (IDB plain)              | SecureStore (Keychain)  |
 *
 * SECURITY (docs/18 §4.3, A1 P1-6):
 *   - `access_token` is MEMORY-ONLY — never written anywhere. On bootstrap
 *     the mobile app exchanges the persisted refresh_token for a fresh
 *     access_token via POST /v1/auth/refresh.
 *   - `refresh_token` lands in `expo-secure-store` (iOS Keychain /
 *     Android KeyStore). Hardware-encrypted, survives process kill,
 *     isolated from the app's doc-dir which MMKV backs.
 *   - P2P private keys (wired when the P2P path turns on for mobile)
 *     also land in SecureStore; MMKV/SQLite hold only the public
 *     metadata (peerId, createdAt).
 *
 * Bootstrap / schema: `storage-adapters.ts::initializeSchema` runs on
 * first `getSqliteDb()` call and records `__version` in the `metadata`
 * table. Since this is a fresh install (no existing user data), there's
 * no V1 data to migrate — the schema just comes up empty.
 */

import type {
  AuthSession,
  CachedAnnouncementsValue,
  CachedPostsValue,
  CommunityAnnouncement,
  CommunitySyncDeltaResponse,
  CommunitySyncEvent,
  CommunityState,
  P2PEventCursor,
  P2PKeyMaterial,
  P2PSyncStatus,
  PostSummary,
  PostDraftState,
  PreferencesState,
} from "@/lib/types";

import { getPwaDb, type PendingPostEntry } from "@/lib/db";
import { createSecureStoreAdapter } from "@/lib/storage-adapters";

export type { PendingPostEntry } from "@/lib/db";

/**
 * Tombstone retention window — tombstoned aggregates remain in the offline
 * cache so `p2p_version` comparisons keep them "remembered" and any
 * older-arriving update is rejected (see `mergeVersionedRecord`). After this
 * window we prune the markers so cache growth is bounded. 7 days is deliberate
 * — long enough to absorb stragglers from a poorly-clocked peer, short enough
 * to keep SQLite storage predictable on constrained devices.
 */
const TOMBSTONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const PREFERENCES_STORAGE_KEY = "preferences";
const AUTH_SESSION_STORAGE_KEY = "auth-session";
const CURRENT_COMMUNITY_STORAGE_KEY = "community-current";
const POST_DRAFT_STORAGE_KEY = "post-draft";
const P2P_EVENT_LOG_PREFIX = "p2p-event-log:";
const BIOMETRIC_LOCK_STORAGE_KEY = "biometric-lock-enabled";

/**
 * SecureStore adapters for the hardware-encrypted secrets. Kept at
 * module scope so the call sites don't re-create them — the underlying
 * SecureStore calls are stateless, but caching one adapter per category
 * keeps the prefix sanitisation cost at zero per write.
 */
const refreshTokenSecureStore = createSecureStoreAdapter("wvnc_refresh");
const p2pPrivateKeySecureStore = createSecureStoreAdapter("wvnc_p2p_key");

function getPostCacheKey(
  communityId: string,
  scope: CachedPostsValue["scope"],
) {
  return `${communityId}:${scope}`;
}

function getP2PEventLogKey(communityId: string) {
  return `${P2P_EVENT_LOG_PREFIX}${communityId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === "string") {
      return value[key];
    }
  }

  return null;
}

function readBoolean(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === "boolean") {
      return value[key];
    }
  }

  return null;
}

function readNumber(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) {
      return value[key] as number;
    }
  }

  return null;
}

type VersionedRecord = {
  p2p_version?: number | null;
  updated_at?: string | null;
};

function mergeVersionedRecord<T extends VersionedRecord>(
  current: T | null,
  incoming: T,
): T {
  const currentVersion =
    typeof current?.p2p_version === "number" ? current.p2p_version : null;
  const incomingVersion =
    typeof incoming.p2p_version === "number" ? incoming.p2p_version : null;

  if (currentVersion !== null && incomingVersion !== null) {
    if (incomingVersion > currentVersion) {
      return incoming;
    }

    if (incomingVersion < currentVersion) {
      return current as T;
    }

    const currentUpdatedAt = current?.updated_at ?? "";
    const incomingUpdatedAt = incoming.updated_at ?? "";
    return incomingUpdatedAt.localeCompare(currentUpdatedAt) >= 0
      ? incoming
      : (current as T);
  }

  if (incomingVersion !== null && currentVersion === null) {
    return incoming;
  }

  if (currentVersion !== null && incomingVersion === null) {
    return current as T;
  }

  const currentUpdatedAt = current?.updated_at ?? "";
  const incomingUpdatedAt = incoming.updated_at ?? "";
  return incomingUpdatedAt.localeCompare(currentUpdatedAt) >= 0
    ? incoming
    : (current ?? incoming);
}

function sortPosts(items: PostSummary[]) {
  return [...items].sort((left, right) => {
    const leftKey = left.updated_at ?? left.created_at;
    const rightKey = right.updated_at ?? right.created_at;
    if (leftKey === rightKey) {
      return right.post_id.localeCompare(left.post_id);
    }
    return rightKey.localeCompare(leftKey);
  });
}

function sortAnnouncements(items: CommunityAnnouncement[]) {
  return [...items].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return left.is_pinned ? -1 : 1;
    }

    const leftKey =
      left.published_at ?? left.updated_at ?? left.created_at ?? "";
    const rightKey =
      right.published_at ?? right.updated_at ?? right.created_at ?? "";
    if (leftKey === rightKey) {
      return right.announcement_id.localeCompare(left.announcement_id);
    }
    return rightKey.localeCompare(leftKey);
  });
}

function toPostSummary(value: unknown): PostSummary | null {
  if (!isRecord(value)) {
    return null;
  }

  const postId = readString(value, "post_id", "postId");
  const communityId = readString(value, "community_id", "communityId");
  const postType = readString(value, "post_type", "postType");
  const category = readString(value, "category");
  const title = readString(value, "title");
  const body = readString(value, "body");
  const language = readString(value, "language");
  const locationZip = readString(value, "location_zip", "locationZip");
  const privacy = readString(value, "privacy");
  const status = readString(value, "status");
  const riskLevel = readString(value, "risk_level", "riskLevel");
  const createdAt = readString(value, "created_at", "createdAt");
  const updatedAt = readString(value, "updated_at", "updatedAt");
  const expiresAt = readString(value, "expires_at", "expiresAt");
  const p2pVersion = readNumber(value, "p2p_version", "p2pVersion");

  if (
    !postId ||
    !communityId ||
    !postType ||
    !category ||
    !title ||
    !body ||
    !language ||
    !locationZip ||
    !privacy ||
    !status ||
    !riskLevel ||
    !createdAt ||
    !updatedAt ||
    !expiresAt
  ) {
    return null;
  }

  return {
    post_id: postId,
    community_id: communityId,
    post_type: postType as PostSummary["post_type"],
    category: category as PostSummary["category"],
    title,
    body,
    language: language as PostSummary["language"],
    location_zip: locationZip,
    privacy: privacy as PostSummary["privacy"],
    status: status as PostSummary["status"],
    risk_level: riskLevel as PostSummary["risk_level"],
    created_at: createdAt,
    updated_at: updatedAt,
    expires_at: expiresAt,
    is_owner: readBoolean(value, "is_owner", "isOwner") ?? false,
    p2p_version: p2pVersion,
  };
}

function toAnnouncement(value: unknown): CommunityAnnouncement | null {
  if (!isRecord(value)) {
    return null;
  }

  const announcementId = readString(value, "announcement_id", "announcementId");
  const communityId = readString(value, "community_id", "communityId");
  const title = readString(value, "title");
  const body = readString(value, "body");

  if (!announcementId || !communityId || !title || !body) {
    return null;
  }

  return {
    announcement_id: announcementId,
    community_id: communityId,
    title,
    body,
    p2p_version: readNumber(value, "p2p_version", "p2pVersion"),
    is_pinned: readBoolean(value, "is_pinned", "pinned") ?? false,
    status: readString(value, "status"),
    published_at: readString(value, "published_at", "publishedAt"),
    updated_at: readString(value, "updated_at", "updatedAt"),
    created_at: readString(value, "created_at", "createdAt"),
  };
}

function replacePost(items: PostSummary[], next: PostSummary) {
  const filtered = items.filter((item) => item.post_id !== next.post_id);
  filtered.push(next);
  return filtered;
}

function replaceAnnouncement(
  items: CommunityAnnouncement[],
  next: CommunityAnnouncement,
) {
  const filtered = items.filter(
    (item) => item.announcement_id !== next.announcement_id,
  );
  filtered.push(next);
  return filtered;
}

function isPostTombstoned(post: PostSummary) {
  return post.status === "removed";
}

function isAnnouncementTombstoned(announcement: CommunityAnnouncement) {
  return (
    announcement.status === "deleted" ||
    announcement.status === "removed" ||
    announcement.status === "tombstoned"
  );
}

/**
 * Feed visibility — excludes tombstones (they stay in cache for version
 * comparison but never render) and respects the existing scope rules.
 */
function isVisibleInCommunityScope(post: PostSummary) {
  return (
    post.status === "active" &&
    post.privacy !== "anchor_mediated" &&
    !isPostTombstoned(post)
  );
}

function isVisibleInPublicScope(post: PostSummary) {
  return (
    post.status === "active" &&
    post.privacy === "public" &&
    !isPostTombstoned(post)
  );
}

function isActiveAnnouncement(announcement: CommunityAnnouncement) {
  return !isAnnouncementTombstoned(announcement);
}

/**
 * Filters a cached post list down to the feed-visible entries for a given
 * scope. Consumers should call this before rendering so tombstones —
 * which live in cache for version comparison — never leak into the UI.
 */
export function filterVisiblePostsForScope(
  items: PostSummary[] | undefined,
  scope: CachedPostsValue["scope"],
): PostSummary[] {
  if (!items) {
    return [];
  }

  return items.filter((item) =>
    scope === "community"
      ? isVisibleInCommunityScope(item)
      : isVisibleInPublicScope(item),
  );
}

/**
 * Filters a cached announcement list down to feed-visible entries (drops
 * tombstones).
 */
export function filterVisibleAnnouncements(
  items: CommunityAnnouncement[] | undefined,
): CommunityAnnouncement[] {
  if (!items) {
    return [];
  }

  return items.filter((item) => isActiveAnnouncement(item));
}

/**
 * Orders a batch of sync events for deterministic replay — (occurred_at,
 * sync_event_id) ascending. Mirrors `sortSyncEventsForReplay` in
 * `packages/p2p/src/merge.ts`; we re-declare it here so the mobile
 * bundle doesn't pull in `multiformats` / `@ipld/dag-json` from the
 * `@weavenyc/p2p` workspace package. If the two ever diverge, update
 * both sides together.
 */
function sortSyncEventsForReplay(events: CommunitySyncEvent[]) {
  return [...events].sort((left, right) => {
    const occurredAtCompare = left.occurred_at.localeCompare(right.occurred_at);
    if (occurredAtCompare !== 0) {
      return occurredAtCompare;
    }

    return left.sync_event_id.localeCompare(right.sync_event_id);
  });
}

function mergeCommunityEventLog(
  current: CommunitySyncEvent[],
  incoming: CommunitySyncEvent[],
  limit = 50,
) {
  const deduped = new Map<string, CommunitySyncEvent>();
  for (const event of sortSyncEventsForReplay([...current, ...incoming])) {
    deduped.set(event.sync_event_id, event);
  }

  const merged = [...deduped.values()];
  return merged.slice(Math.max(merged.length - limit, 0));
}

function buildPostTombstoneFromEvent(
  event: CommunitySyncEvent,
  existing: PostSummary | null,
): PostSummary {
  const payloadAsRecord = event.payload as unknown as
    | Record<string, unknown>
    | null
    | undefined;
  const payload = isRecord(payloadAsRecord) ? payloadAsRecord : null;
  const payloadPost = isRecord(payload?.post) ? payload.post : payload;
  const payloadVersion =
    readNumber(payloadPost, "p2p_version", "p2pVersion") ??
    readNumber(payloadAsRecord, "p2p_version", "p2pVersion");
  const existingVersion =
    typeof existing?.p2p_version === "number" ? existing.p2p_version : null;
  const nextVersion =
    payloadVersion !== null
      ? Math.max(payloadVersion, existingVersion ?? -Infinity)
      : existingVersion !== null
        ? existingVersion + 1
        : 1;

  return {
    post_id: event.aggregate_id,
    community_id: event.community_id,
    post_type: existing?.post_type ?? "request",
    category: existing?.category ?? "other",
    title: "",
    body: "",
    language: existing?.language ?? "en",
    location_zip: existing?.location_zip ?? "",
    privacy: existing?.privacy ?? "community_only",
    status: "removed",
    risk_level: existing?.risk_level ?? "low",
    created_at: existing?.created_at ?? event.occurred_at,
    updated_at: event.occurred_at,
    expires_at: existing?.expires_at ?? event.occurred_at,
    is_owner: existing?.is_owner ?? false,
    p2p_version: nextVersion,
  };
}

function buildAnnouncementTombstoneFromEvent(
  event: CommunitySyncEvent,
  existing: CommunityAnnouncement | null,
): CommunityAnnouncement {
  const payloadAsRecord = event.payload as unknown as
    | Record<string, unknown>
    | null
    | undefined;
  const payload = isRecord(payloadAsRecord) ? payloadAsRecord : null;
  const payloadAnnouncement = isRecord(payload?.announcement)
    ? payload.announcement
    : payload;
  const payloadVersion =
    readNumber(payloadAnnouncement, "p2p_version", "p2pVersion") ??
    readNumber(payloadAsRecord, "p2p_version", "p2pVersion");
  const existingVersion =
    typeof existing?.p2p_version === "number" ? existing.p2p_version : null;
  const nextVersion =
    payloadVersion !== null
      ? Math.max(payloadVersion, existingVersion ?? -Infinity)
      : existingVersion !== null
        ? existingVersion + 1
        : 1;

  return {
    announcement_id: event.aggregate_id,
    community_id: event.community_id,
    title: "",
    body: "",
    p2p_version: nextVersion,
    is_pinned: false,
    status: "removed",
    published_at: existing?.published_at ?? null,
    updated_at: event.occurred_at,
    created_at: existing?.created_at ?? null,
  };
}

/**
 * Drops tombstoned aggregates older than `TOMBSTONE_RETENTION_MS` by
 * `updated_at`. Non-tombstones pass through untouched.
 */
function prunePostTombstones(items: PostSummary[], now: number) {
  return items.filter((item) => {
    if (!isPostTombstoned(item)) {
      return true;
    }

    const updatedAtMs = Date.parse(item.updated_at);
    if (Number.isNaN(updatedAtMs)) {
      return true;
    }

    return now - updatedAtMs <= TOMBSTONE_RETENTION_MS;
  });
}

function pruneAnnouncementTombstones(
  items: CommunityAnnouncement[],
  now: number,
) {
  return items.filter((item) => {
    if (!isAnnouncementTombstoned(item)) {
      return true;
    }

    const updatedAtRaw =
      item.updated_at ?? item.published_at ?? item.created_at;
    if (!updatedAtRaw) {
      return true;
    }

    const updatedAtMs = Date.parse(updatedAtRaw);
    if (Number.isNaN(updatedAtMs)) {
      return true;
    }

    return now - updatedAtMs <= TOMBSTONE_RETENTION_MS;
  });
}

function applyPostEvent(
  cache: CachedPostsValue,
  event: CommunitySyncEvent,
  updatedAt: string,
) {
  const existingPost =
    cache.items.find((item) => item.post_id === event.aggregate_id) ?? null;

  if (event.event_type === "post.tombstoned") {
    const tombstone = buildPostTombstoneFromEvent(event, existingPost);
    const mergedTombstone = mergeVersionedRecord(existingPost, tombstone);
    const nextItems = replacePost(cache.items, mergedTombstone);

    return {
      ...cache,
      items: sortPosts(nextItems),
      updatedAt,
      source: "cache" as const,
    };
  }

  const payloadAsRecord = event.payload as unknown as
    | Record<string, unknown>
    | null
    | undefined;
  const payload = isRecord(payloadAsRecord) ? payloadAsRecord : null;
  const post = toPostSummary(payload?.post ?? payload);

  if (!post) {
    return {
      ...cache,
      items: cache.items,
      updatedAt,
      source: "cache" as const,
    };
  }

  const mergedPost = mergeVersionedRecord(existingPost, post);
  const nextItems = replacePost(cache.items, mergedPost);

  return {
    ...cache,
    items: sortPosts(nextItems),
    updatedAt,
    source: "cache" as const,
  };
}

function applyAnnouncementEvent(
  cache: CachedAnnouncementsValue,
  event: CommunitySyncEvent,
  updatedAt: string,
) {
  const existingAnnouncement =
    cache.items.find(
      (item) => item.announcement_id === event.aggregate_id,
    ) ?? null;

  if (event.event_type === "announcement.deleted") {
    const tombstone = buildAnnouncementTombstoneFromEvent(
      event,
      existingAnnouncement,
    );
    const mergedTombstone = mergeVersionedRecord(
      existingAnnouncement,
      tombstone,
    );
    const nextItems = replaceAnnouncement(cache.items, mergedTombstone);

    return {
      ...cache,
      items: sortAnnouncements(nextItems),
      updatedAt,
      source: "cache" as const,
    };
  }

  const payloadAsRecord = event.payload as unknown as
    | Record<string, unknown>
    | null
    | undefined;
  const payload = isRecord(payloadAsRecord) ? payloadAsRecord : null;
  const announcement = toAnnouncement(payload?.announcement ?? payload);

  if (!announcement) {
    return {
      ...cache,
      items: cache.items,
      updatedAt,
      source: "cache" as const,
    };
  }

  const mergedAnnouncement = mergeVersionedRecord(
    existingAnnouncement,
    announcement,
  );
  const nextItems = replaceAnnouncement(cache.items, mergedAnnouncement);

  return {
    ...cache,
    items: sortAnnouncements(nextItems),
    updatedAt,
    source: "cache" as const,
  };
}

export async function loadPreferences(): Promise<Partial<PreferencesState> | null> {
  try {
    const db = getPwaDb();
    const row = await db.kv.get(PREFERENCES_STORAGE_KEY);
    return (row?.value as Partial<PreferencesState> | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function savePreferences(preferences: PreferencesState) {
  try {
    const db = getPwaDb();
    // `hydrationComplete` is a transient UI-only flag — strip before persist.
    const { hydrationComplete, ...toPersist } = preferences;
    void hydrationComplete;

    await db.kv.put({
      key: PREFERENCES_STORAGE_KEY,
      value: toPersist,
    });
  } catch {
    return;
  }
}

/**
 * The persisted session intentionally omits the access_token (A1 P1-6).
 * On hydrate the bootstrap hook exchanges the refresh_token for a fresh
 * access_token via POST /v1/auth/refresh before the first protected
 * request. Older rows written before this split may still carry an
 * access_token; we drop it here on read so downstream code never
 * surfaces a stale 15-minute bearer.
 *
 * On mobile the refresh_token lives in `expo-secure-store` (Keychain).
 * The MMKV row stores only the non-secret session metadata (`user`,
 * `issued_via`, `fallback`). On load we stitch the two together; on
 * save we write the secret first, the metadata second — so a crash
 * between the two at worst leaves an orphan Keychain entry that the
 * next `saveSession` overwrites.
 */
export type PersistedAuthSession = Omit<AuthSession, "access_token">;

const REFRESH_TOKEN_KEY = "primary";

export async function loadSession(): Promise<PersistedAuthSession | null> {
  try {
    const db = getPwaDb();
    const row = await db.kv.get(AUTH_SESSION_STORAGE_KEY);
    const raw = (row?.value as Partial<AuthSession> | undefined) ?? null;
    if (!raw || !raw.user) {
      return null;
    }

    // Prefer the Keychain-stored refresh_token; fall back to the MMKV
    // copy only when the Keychain read fails (simulator / no passcode
    // set). Legacy rows written before the split may carry it in raw.
    let refreshToken: string | null = null;
    try {
      refreshToken = await refreshTokenSecureStore.get(REFRESH_TOKEN_KEY);
    } catch {
      refreshToken = null;
    }

    if (!refreshToken && typeof raw.refresh_token === "string") {
      refreshToken = raw.refresh_token;
    }

    if (!refreshToken) {
      return null;
    }

    // Strip any legacy access_token or refresh_token that may still be
    // in pre-split MMKV rows; the source of truth is the Keychain.
    const {
      access_token: _discardedAccess,
      refresh_token: _discardedRefresh,
      ...persisted
    } = raw;
    void _discardedAccess;
    void _discardedRefresh;
    return {
      ...persisted,
      refresh_token: refreshToken,
    } as PersistedAuthSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession | null) {
  try {
    const db = getPwaDb();

    if (!session) {
      await db.kv.delete(AUTH_SESSION_STORAGE_KEY);
      await refreshTokenSecureStore.delete(REFRESH_TOKEN_KEY);
      return;
    }

    // SECURITY (A1 P1-6, docs/18 §4.3): the access_token is a
    // memory-only credential. Persist ONLY the long-lived refresh token
    // (in the Keychain) and the user shape (in MMKV); on the next
    // bootstrap we exchange the stored refresh token for a fresh
    // access_token via /v1/auth/refresh. Writing the access_token to
    // storage would leak a 15-minute bearer that survives a process
    // kill, violates the design contract, and enlarges the exfil
    // blast radius.
    const {
      access_token: _discardedAccessToken,
      refresh_token: refreshToken,
      ...persistable
    } = session;
    void _discardedAccessToken;

    // Write the Keychain row first so a crash between writes leaves
    // the persisted metadata pointing at a valid (just-updated) token.
    await refreshTokenSecureStore.set(REFRESH_TOKEN_KEY, refreshToken);
    await db.kv.put({
      key: AUTH_SESSION_STORAGE_KEY,
      value: persistable,
    });
  } catch {
    return;
  }
}

/**
 * Test-only helper — wipes the refresh_token from SecureStore.
 * Matches `saveSession(null)` for the Keychain half when tests want to
 * simulate a missing-Keychain scenario without also dropping the
 * metadata row.
 */
export async function __clearRefreshTokenForTesting(): Promise<void> {
  await refreshTokenSecureStore.delete(REFRESH_TOKEN_KEY);
}

export async function loadCommunityState(): Promise<Partial<CommunityState> | null> {
  try {
    const db = getPwaDb();
    const [currentRow, joinedRows] = await Promise.all([
      db.kv.get(CURRENT_COMMUNITY_STORAGE_KEY),
      db.joinedCommunities.toArray(),
    ]);

    return {
      currentCommunityId: (currentRow?.value as string | undefined) ?? null,
      joinedCommunities: joinedRows.map((row) => row.value),
    };
  } catch {
    return null;
  }
}

export async function saveCommunityState(state: CommunityState) {
  try {
    const db = getPwaDb();

    await Promise.all([
      db.kv.put({
        key: CURRENT_COMMUNITY_STORAGE_KEY,
        value: state.currentCommunityId,
      }),
      db.transaction("rw", db.joinedCommunities, async () => {
        await db.joinedCommunities.clear?.();
        if (state.joinedCommunities.length > 0) {
          await db.joinedCommunities.bulkPut?.(
            state.joinedCommunities.map((community) => ({
              communityId: community.community.community_id,
              value: community,
            })),
          );
        }
      }),
    ]);
  } catch {
    return;
  }
}

export async function loadPostDraft(): Promise<PostDraftState | null> {
  try {
    const db = getPwaDb();
    const row = await db.drafts.get(POST_DRAFT_STORAGE_KEY);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function savePostDraft(postDraft: PostDraftState) {
  try {
    const db = getPwaDb();
    await db.drafts.put({
      key: POST_DRAFT_STORAGE_KEY,
      value: postDraft,
    });
  } catch {
    return;
  }
}

export async function clearPostDraft() {
  try {
    const db = getPwaDb();
    await db.drafts.delete(POST_DRAFT_STORAGE_KEY);
  } catch {
    return;
  }
}

export async function loadCachedPosts(
  communityId: string,
  scope: CachedPostsValue["scope"],
): Promise<CachedPostsValue | null> {
  try {
    const db = getPwaDb();
    const row = await db.postCache.get(getPostCacheKey(communityId, scope));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedPosts(value: CachedPostsValue) {
  try {
    const db = getPwaDb();
    await db.postCache.put({
      cacheKey: getPostCacheKey(value.communityId, value.scope),
      communityId: value.communityId,
      scope: value.scope,
      value,
    });
  } catch {
    return;
  }
}

export async function loadCachedAnnouncements(
  communityId: string,
): Promise<CachedAnnouncementsValue | null> {
  try {
    const db = getPwaDb();
    const row = await db.announcementCache.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedAnnouncements(
  value: CachedAnnouncementsValue,
) {
  try {
    const db = getPwaDb();
    await db.announcementCache.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

/**
 * P2P key material — on mobile the `peerId` + `createdAt` metadata
 * lives in SQLite (so lookups are cheap) and the raw private-key
 * bytes (when wired in a later milestone) land in SecureStore. The
 * current shape only carries metadata (see `types.ts::P2PKeyMaterial`);
 * if a private-key field is added later, wire it through
 * `p2pPrivateKeySecureStore` and strip it from the metadata row before
 * persisting.
 */
export async function loadP2PKeyMaterial(
  communityId: string,
): Promise<P2PKeyMaterial | null> {
  try {
    const db = getPwaDb();
    const row = await db.p2pKeys.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PKeyMaterial(value: P2PKeyMaterial) {
  try {
    const db = getPwaDb();
    await db.p2pKeys.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

/**
 * Write a P2P community-scoped private key to the hardware-encrypted
 * Keychain. Separate from `saveP2PKeyMaterial` so the secret path and
 * the metadata path evolve independently. No plaintext copy of the key
 * is retained anywhere else.
 */
export async function saveP2PPrivateKey(
  communityId: string,
  privateKeyBase64: string,
): Promise<void> {
  await p2pPrivateKeySecureStore.set(communityId, privateKeyBase64);
}

export async function loadP2PPrivateKey(
  communityId: string,
): Promise<string | null> {
  return p2pPrivateKeySecureStore.get(communityId);
}

export async function deleteP2PPrivateKey(communityId: string): Promise<void> {
  await p2pPrivateKeySecureStore.delete(communityId);
}

export async function loadP2PSyncState(
  communityId: string,
): Promise<P2PSyncStatus | null> {
  try {
    const db = getPwaDb();
    const row = await db.p2pSyncState.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PSyncState(value: P2PSyncStatus) {
  try {
    const db = getPwaDb();
    await db.p2pSyncState.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

export async function loadP2PEventCursor(
  communityId: string,
): Promise<P2PEventCursor | null> {
  try {
    const db = getPwaDb();
    const row = await db.p2pEventCursor.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PEventCursor(value: P2PEventCursor) {
  try {
    const db = getPwaDb();
    await db.p2pEventCursor.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

/**
 * Structural subtype mirroring the PWA's loose replay-event shape so
 * unit tests can construct events with `payload: { p2p_version: 5 }`
 * (tombstones) without juggling every payload variant.
 */
type CacheReplayEvent = {
  sync_event_id: string;
  community_id: string;
  event_type: CommunitySyncEvent["event_type"];
  aggregate_type: CommunitySyncEvent["aggregate_type"];
  aggregate_id: string;
  actor_p2p_id?: string | null;
  cid?: string | null;
  occurred_at: string;
  payload?: Record<string, unknown> | null | undefined;
};

type CacheReplayDelta = {
  events: ReadonlyArray<CacheReplayEvent>;
  server_time: string;
};

export async function applyCommunitySyncDeltaToCache(
  delta: CacheReplayDelta | CommunitySyncDeltaResponse,
) {
  try {
    const db = getPwaDb();
    if (delta.events.length === 0) {
      return;
    }

    const updatedAt = delta.server_time;
    const sortedEvents = sortSyncEventsForReplay(
      delta.events as CommunitySyncEvent[],
    );
    const communityIds = Array.from(
      new Set(sortedEvents.map((event) => event.community_id)),
    );

    for (const communityId of communityIds) {
      const communityEvents = sortedEvents.filter(
        (event) => event.community_id === communityId,
      );
      let communityPosts =
        (await db.postCache.get(getPostCacheKey(communityId, "community")))
          ?.value ?? {
          communityId,
          scope: "community" as const,
          items: [],
          next_cursor: null,
          updatedAt,
          source: "cache" as const,
        };
      let publicPosts =
        (await db.postCache.get(getPostCacheKey(communityId, "public")))
          ?.value ?? {
          communityId,
          scope: "public" as const,
          items: [],
          next_cursor: null,
          updatedAt,
          source: "cache" as const,
        };
      let announcements = (await db.announcementCache.get(communityId))
        ?.value ?? {
        communityId,
        items: [],
        next_cursor: null,
        updatedAt,
        source: "cache" as const,
      };

      const eventLogKey = getP2PEventLogKey(communityId);
      const existingEventLog = await db.kv.get(eventLogKey);
      const currentEventLog =
        existingEventLog &&
        typeof existingEventLog === "object" &&
        "value" in existingEventLog &&
        isRecord(existingEventLog.value) &&
        Array.isArray(existingEventLog.value.items)
          ? (existingEventLog.value.items as CommunitySyncEvent[])
          : [];

      for (const event of communityEvents) {
        if (event.aggregate_type === "post") {
          communityPosts = applyPostEvent(communityPosts, event, updatedAt);
          publicPosts = applyPostEvent(publicPosts, event, updatedAt);
          continue;
        }

        if (event.aggregate_type === "announcement") {
          announcements = applyAnnouncementEvent(
            announcements,
            event,
            updatedAt,
          );
        }
      }

      const nowMs = Date.now();
      communityPosts = {
        ...communityPosts,
        items: prunePostTombstones(communityPosts.items, nowMs),
      };
      publicPosts = {
        ...publicPosts,
        items: prunePostTombstones(publicPosts.items, nowMs),
      };
      announcements = {
        ...announcements,
        items: pruneAnnouncementTombstones(announcements.items, nowMs),
      };

      await db.postCache.put({
        cacheKey: getPostCacheKey(communityId, "community"),
        communityId,
        scope: "community",
        value: communityPosts,
      });
      await db.postCache.put({
        cacheKey: getPostCacheKey(communityId, "public"),
        communityId,
        scope: "public",
        value: publicPosts,
      });
      await db.announcementCache.put({
        communityId,
        value: announcements,
      });
      await db.kv.put({
        key: eventLogKey,
        value: {
          communityId,
          updatedAt,
          items: mergeCommunityEventLog(currentEventLog, communityEvents),
        },
      });
    }
  } catch {
    return;
  }
}

/* ------------------------------------------------------------------------- */
/* Offline write outbox — `pendingPosts` table.                             */
/*                                                                           */
/* The outbox backs the mobile app's "subway-safe publish" guarantee: when   */
/* the user taps Publish, we enqueue the full `CreatePostInput` into         */
/* SQLite BEFORE the HTTP call fires, so a network drop or process kill      */
/* preserves the draft. The outbox drain hook (ported as-is from the PWA     */
/* in M2) walks this table on app foreground / connectivity regain and       */
/* retries each entry. 4xx failures are flagged permanent so we don't        */
/* thrash the server — they surface to the user on the pending list.        */
/*                                                                           */
/* Retention: entries stay in SQLite until either successfully sent or       */
/* explicitly discarded by the user. No TTL.                                 */
/* ------------------------------------------------------------------------- */

/**
 * Store a new pending post entry in SQLite. Idempotent per `client_id` —
 * a replay with the same id overwrites rather than duplicating.
 */
export async function enqueuePendingPost(
  entry: PendingPostEntry,
): Promise<void> {
  try {
    const db = getPwaDb();
    await db.pendingPosts.put(entry);
  } catch {
    return;
  }
}

/**
 * List pending entries, optionally filtered by community. Ordered by
 * `created_at` ascending so the drain pass processes oldest-first.
 */
export async function listPendingPosts(
  communityId?: string,
): Promise<PendingPostEntry[]> {
  try {
    const db = getPwaDb();

    const all = communityId
      ? ((await db.pendingPosts
          .where?.("community_id")
          .equals(communityId)
          .toArray()) ?? [])
      : await db.pendingPosts.toArray();

    return [...all].sort((left, right) =>
      left.created_at.localeCompare(right.created_at),
    );
  } catch {
    return [];
  }
}

/**
 * Record an attempt on a pending entry — bumps `attempt_count`, stamps
 * `last_attempt_at`, writes `last_error`. `permanent` marks the failure
 * as a 4xx semantic rejection (so the drain skips it until the user
 * manually retries). Silent no-op when the entry is already gone.
 */
export async function markPendingPostAttempt(
  clientId: string,
  error: string | null,
  options: { permanent?: boolean } = {},
): Promise<void> {
  try {
    const db = getPwaDb();

    const existing = await db.pendingPosts.get(clientId);
    if (!existing) {
      return;
    }

    await db.pendingPosts.put({
      ...existing,
      attempt_count: existing.attempt_count + 1,
      last_attempt_at: new Date().toISOString(),
      last_error: error,
      last_failure_permanent: options.permanent === true,
    });
  } catch {
    return;
  }
}

/**
 * Remove a pending entry — called on successful publish and on explicit
 * user discard. No-op when the entry doesn't exist.
 */
export async function removePendingPost(clientId: string): Promise<void> {
  try {
    const db = getPwaDb();
    await db.pendingPosts.delete(clientId);
  } catch {
    return;
  }
}

/* ------------------------------------------------------------------------- */
/* Biometric lock flag — Phase 3-B.                                          */
/*                                                                           */
/* When the user flips the "Lock inbox with Face ID" toggle in the Me hub,  */
/* we persist a single boolean in MMKV so the inbox / danger-zone screens    */
/* can read it synchronously on focus. Stored in the same `kv` table as the  */
/* other one-off preferences (preferences, auth-session metadata,            */
/* community-current) — one namespaced key, no schema migration needed.     */
/*                                                                           */
/* Security: the flag is intentionally NOT in SecureStore. The gate is a UX  */
/* convenience layered over the already-encrypted refresh_token; a user who  */
/* disables the toggle in the file system still needs the passcode-protected */
/* Keychain token to impersonate the session. Keeping it in MMKV matches the */
/* pattern we use for other preference rows and avoids a Keychain dialog on  */
/* toggle.                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * Synchronous reader so screens can branch on the flag before the first
 * render without an async gate. The underlying MMKV read is synchronous
 * (JSI) but we go through the Dexie-shaped `kv.get()` to keep the facade
 * consistent. Callers on the hot path (inbox focus) use the async variant
 * below; the sync one is used only where we need a pre-render decision.
 */
export async function getBiometricLockEnabled(): Promise<boolean> {
  try {
    const db = getPwaDb();
    const row = await db.kv.get(BIOMETRIC_LOCK_STORAGE_KEY);
    const value = (row?.value as unknown) ?? null;
    return value === true;
  } catch {
    return false;
  }
}

export async function setBiometricLockEnabled(enabled: boolean): Promise<void> {
  try {
    const db = getPwaDb();
    await db.kv.put({
      key: BIOMETRIC_LOCK_STORAGE_KEY,
      value: enabled === true,
    });
  } catch {
    return;
  }
}
