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

import { getPwaDb } from "@/lib/db";

/**
 * Tombstone retention window — tombstoned aggregates remain in the offline
 * cache so `p2p_version` comparisons keep them "remembered" and any
 * older-arriving update is rejected (see `mergeVersionedRecord`). After this
 * window we prune the markers so cache growth is bounded. 7 days is deliberate
 * — long enough to absorb stragglers from a poorly-clocked peer, short enough
 * to keep IndexedDB storage predictable on constrained devices.
 */
const TOMBSTONE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const PREFERENCES_STORAGE_KEY = "preferences";
const AUTH_SESSION_STORAGE_KEY = "auth-session";
const CURRENT_COMMUNITY_STORAGE_KEY = "community-current";
const POST_DRAFT_STORAGE_KEY = "post-draft";
const P2P_EVENT_LOG_PREFIX = "p2p-event-log:";

function getPostCacheKey(communityId: string, scope: CachedPostsValue["scope"]) {
  return `${communityId}:${scope}`;
}

function getP2PEventLogKey(communityId: string) {
  return `${P2P_EVENT_LOG_PREFIX}${communityId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, ...keys: string[]) {
  if (!isRecord(value)) {
    return null;
  }

  for (const key of keys) {
    if (typeof value[key] === 'string') {
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
    if (typeof value[key] === 'boolean') {
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
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      return value[key] as number;
    }
  }

  return null;
}

type VersionedRecord = {
  p2p_version?: number | null;
  updated_at?: string | null;
};

function mergeVersionedRecord<T extends VersionedRecord>(current: T | null, incoming: T): T {
  const currentVersion = typeof current?.p2p_version === 'number' ? current.p2p_version : null;
  const incomingVersion = typeof incoming.p2p_version === 'number' ? incoming.p2p_version : null;

  if (currentVersion !== null && incomingVersion !== null) {
    if (incomingVersion > currentVersion) {
      return incoming;
    }

    if (incomingVersion < currentVersion) {
      return current as T;
    }

    const currentUpdatedAt = current?.updated_at ?? '';
    const incomingUpdatedAt = incoming.updated_at ?? '';
    return incomingUpdatedAt.localeCompare(currentUpdatedAt) >= 0 ? incoming : (current as T);
  }

  if (incomingVersion !== null && currentVersion === null) {
    return incoming;
  }

  if (currentVersion !== null && incomingVersion === null) {
    return current as T;
  }

  const currentUpdatedAt = current?.updated_at ?? '';
  const incomingUpdatedAt = incoming.updated_at ?? '';
  return incomingUpdatedAt.localeCompare(currentUpdatedAt) >= 0 ? incoming : (current ?? incoming);
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

    const leftKey = left.published_at ?? left.updated_at ?? left.created_at ?? '';
    const rightKey = right.published_at ?? right.updated_at ?? right.created_at ?? '';
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

  const postId = readString(value, 'post_id', 'postId');
  const communityId = readString(value, 'community_id', 'communityId');
  const postType = readString(value, 'post_type', 'postType');
  const category = readString(value, 'category');
  const title = readString(value, 'title');
  const body = readString(value, 'body');
  const language = readString(value, 'language');
  const locationZip = readString(value, 'location_zip', 'locationZip');
  const privacy = readString(value, 'privacy');
  const status = readString(value, 'status');
  const riskLevel = readString(value, 'risk_level', 'riskLevel');
  const createdAt = readString(value, 'created_at', 'createdAt');
  const updatedAt = readString(value, 'updated_at', 'updatedAt');
  const expiresAt = readString(value, 'expires_at', 'expiresAt');
  const p2pVersion = readNumber(value, 'p2p_version', 'p2pVersion');

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
    post_type: postType as PostSummary['post_type'],
    category: category as PostSummary['category'],
    title,
    body,
    language: language as PostSummary['language'],
    location_zip: locationZip,
    privacy: privacy as PostSummary['privacy'],
    status: status as PostSummary['status'],
    risk_level: riskLevel as PostSummary['risk_level'],
    created_at: createdAt,
    updated_at: updatedAt,
    expires_at: expiresAt,
    is_owner: readBoolean(value, 'is_owner', 'isOwner') ?? false,
    p2p_version: p2pVersion,
  };
}

function toAnnouncement(value: unknown): CommunityAnnouncement | null {
  if (!isRecord(value)) {
    return null;
  }

  const announcementId = readString(value, 'announcement_id', 'announcementId');
  const communityId = readString(value, 'community_id', 'communityId');
  const title = readString(value, 'title');
  const body = readString(value, 'body');

  if (!announcementId || !communityId || !title || !body) {
    return null;
  }

  return {
    announcement_id: announcementId,
    community_id: communityId,
    title,
    body,
    p2p_version: readNumber(value, 'p2p_version', 'p2pVersion'),
    is_pinned: readBoolean(value, 'is_pinned', 'pinned') ?? false,
    status: readString(value, 'status'),
    published_at: readString(value, 'published_at', 'publishedAt'),
    updated_at: readString(value, 'updated_at', 'updatedAt'),
    created_at: readString(value, 'created_at', 'createdAt'),
  };
}

function replacePost(items: PostSummary[], next: PostSummary) {
  const filtered = items.filter((item) => item.post_id !== next.post_id);
  filtered.push(next);
  return filtered;
}

function replaceAnnouncement(items: CommunityAnnouncement[], next: CommunityAnnouncement) {
  const filtered = items.filter((item) => item.announcement_id !== next.announcement_id);
  filtered.push(next);
  return filtered;
}

function isPostTombstoned(post: PostSummary) {
  return post.status === 'removed';
}

function isAnnouncementTombstoned(announcement: CommunityAnnouncement) {
  return (
    announcement.status === 'deleted' || announcement.status === 'removed' || announcement.status === 'tombstoned'
  );
}

/**
 * Feed visibility — excludes tombstones (they stay in cache for version
 * comparison but never render) and respects the existing scope rules.
 */
function isVisibleInCommunityScope(post: PostSummary) {
  return (
    post.status === 'active' && post.privacy !== 'anchor_mediated' && !isPostTombstoned(post)
  );
}

function isVisibleInPublicScope(post: PostSummary) {
  return post.status === 'active' && post.privacy === 'public' && !isPostTombstoned(post);
}

function isActiveAnnouncement(announcement: CommunityAnnouncement) {
  return !isAnnouncementTombstoned(announcement);
}

/**
 * Filters a cached post list down to the feed-visible entries for a given
 * scope. Consumers (community-screen, community-announcements) should call
 * this before rendering so tombstones — which live in cache for version
 * comparison — never leak into the UI.
 */
export function filterVisiblePostsForScope(
  items: PostSummary[] | undefined,
  scope: CachedPostsValue['scope'],
): PostSummary[] {
  if (!items) {
    return [];
  }

  return items.filter((item) =>
    scope === 'community' ? isVisibleInCommunityScope(item) : isVisibleInPublicScope(item),
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
 * `packages/p2p/src/merge.ts`; we re-declare it here so the PWA bundle
 * doesn't pull in `multiformats` / `@ipld/dag-json` from the `@weavenyc/p2p`
 * workspace package. If the two ever diverge, update both sides together.
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

/**
 * Synthesize a tombstone `PostSummary` from a tombstone event. Stripped of
 * all human-visible fields (title/body emptied) but keeps the authoritative
 * `p2p_version` so a subsequent older `post.updated` loses
 * `mergeVersionedRecord` and is dropped instead of resurrecting the
 * aggregate.
 */
function buildPostTombstoneFromEvent(
  event: CommunitySyncEvent,
  existing: PostSummary | null,
): PostSummary {
  const payload = isRecord(event.payload) ? event.payload : null;
  const payloadPost = isRecord(payload?.post) ? payload.post : payload;
  const payloadVersion =
    readNumber(payloadPost, 'p2p_version', 'p2pVersion') ??
    readNumber(event.payload, 'p2p_version', 'p2pVersion');
  const existingVersion = typeof existing?.p2p_version === 'number' ? existing.p2p_version : null;
  const nextVersion =
    payloadVersion !== null
      ? Math.max(payloadVersion, existingVersion ?? -Infinity)
      : existingVersion !== null
        ? existingVersion + 1
        : 1;

  return {
    post_id: event.aggregate_id,
    community_id: event.community_id,
    post_type: existing?.post_type ?? 'request',
    category: existing?.category ?? 'other',
    title: '',
    body: '',
    language: existing?.language ?? 'en',
    location_zip: existing?.location_zip ?? '',
    privacy: existing?.privacy ?? 'community_only',
    status: 'removed',
    risk_level: existing?.risk_level ?? 'low',
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
  const payload = isRecord(event.payload) ? event.payload : null;
  const payloadAnnouncement = isRecord(payload?.announcement) ? payload.announcement : payload;
  const payloadVersion =
    readNumber(payloadAnnouncement, 'p2p_version', 'p2pVersion') ??
    readNumber(event.payload, 'p2p_version', 'p2pVersion');
  const existingVersion = typeof existing?.p2p_version === 'number' ? existing.p2p_version : null;
  const nextVersion =
    payloadVersion !== null
      ? Math.max(payloadVersion, existingVersion ?? -Infinity)
      : existingVersion !== null
        ? existingVersion + 1
        : 1;

  return {
    announcement_id: event.aggregate_id,
    community_id: event.community_id,
    title: '',
    body: '',
    p2p_version: nextVersion,
    is_pinned: false,
    status: 'removed',
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

function pruneAnnouncementTombstones(items: CommunityAnnouncement[], now: number) {
  return items.filter((item) => {
    if (!isAnnouncementTombstoned(item)) {
      return true;
    }

    const updatedAtRaw = item.updated_at ?? item.published_at ?? item.created_at;
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

function applyPostEvent(cache: CachedPostsValue, event: CommunitySyncEvent, updatedAt: string) {
  const existingPost = cache.items.find((item) => item.post_id === event.aggregate_id) ?? null;

  // Tombstone events don't carry a full post payload; we synthesize a marker
  // record that keeps the aggregate in cache (with its latest `p2p_version`)
  // so a subsequent older `post.updated` arriving out of order cannot
  // resurrect it. `isVisibleInCommunityScope` / `isVisibleInPublicScope`
  // exclude tombstones from the user-visible feed (see
  // `filterVisiblePostsForScope`).
  if (event.event_type === 'post.tombstoned') {
    const tombstone = buildPostTombstoneFromEvent(event, existingPost);
    // `mergeVersionedRecord` prefers the higher p2p_version — a tombstone
    // with the latest version wins over any stale update.
    const mergedTombstone = mergeVersionedRecord(existingPost, tombstone);
    const nextItems = replacePost(cache.items, mergedTombstone);

    return {
      ...cache,
      items: sortPosts(nextItems),
      updatedAt,
      source: 'cache' as const,
    };
  }

  const payload = isRecord(event.payload) ? event.payload : null;
  const post = toPostSummary(payload?.post ?? payload);

  if (!post) {
    // No payload and not a tombstone — nothing useful to apply. Keep the
    // existing cache intact (previously this branch dropped the aggregate,
    // but that was a silent delete without a tombstone version).
    return {
      ...cache,
      items: cache.items,
      updatedAt,
      source: 'cache' as const,
    };
  }

  // If the cache already holds a tombstone with a newer p2p_version,
  // `mergeVersionedRecord` returns the existing tombstone — the update is
  // dropped and the tombstone stays in place. That is the data-resurrection
  // guard.
  const mergedPost = mergeVersionedRecord(existingPost, post);
  const nextItems = replacePost(cache.items, mergedPost);

  return {
    ...cache,
    items: sortPosts(nextItems),
    updatedAt,
    source: 'cache' as const,
  };
}

function applyAnnouncementEvent(
  cache: CachedAnnouncementsValue,
  event: CommunitySyncEvent,
  updatedAt: string,
) {
  const existingAnnouncement =
    cache.items.find((item) => item.announcement_id === event.aggregate_id) ?? null;

  if (event.event_type === 'announcement.deleted') {
    const tombstone = buildAnnouncementTombstoneFromEvent(event, existingAnnouncement);
    const mergedTombstone = mergeVersionedRecord(existingAnnouncement, tombstone);
    const nextItems = replaceAnnouncement(cache.items, mergedTombstone);

    return {
      ...cache,
      items: sortAnnouncements(nextItems),
      updatedAt,
      source: 'cache' as const,
    };
  }

  const payload = isRecord(event.payload) ? event.payload : null;
  const announcement = toAnnouncement(payload?.announcement ?? payload);

  if (!announcement) {
    return {
      ...cache,
      items: cache.items,
      updatedAt,
      source: 'cache' as const,
    };
  }

  const mergedAnnouncement = mergeVersionedRecord(existingAnnouncement, announcement);
  const nextItems = replaceAnnouncement(cache.items, mergedAnnouncement);

  return {
    ...cache,
    items: sortAnnouncements(nextItems),
    updatedAt,
    source: 'cache' as const,
  };
}

export async function loadPreferences(): Promise<Partial<PreferencesState> | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.kv.get(PREFERENCES_STORAGE_KEY);
    return (row?.value as Partial<PreferencesState> | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function savePreferences(preferences: PreferencesState) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    // `hydrationComplete` is a transient UI-only flag — it only makes sense
    // during the current session and would lock out the hydration guard on
    // the next page load. Strip it out before persisting so that reloading
    // the PWA never starts with a stale `hydrationComplete=true`. The
    // explicit `void` reference keeps lint happy without an ignore-comment.
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

export async function loadSession(): Promise<AuthSession | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.kv.get(AUTH_SESSION_STORAGE_KEY);
    return (row?.value as AuthSession | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function saveSession(session: AuthSession | null) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    if (!session) {
      await db.kv.delete(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    await db.kv.put({
      key: AUTH_SESSION_STORAGE_KEY,
      value: session,
    });
  } catch {
    return;
  }
}

export async function loadCommunityState(): Promise<Partial<CommunityState> | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

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
    if (!db) {
      return;
    }

    await Promise.all([
      db.kv.put({
        key: CURRENT_COMMUNITY_STORAGE_KEY,
        value: state.currentCommunityId,
      }),
      db.transaction('rw', db.joinedCommunities, async () => {
        await db.joinedCommunities.clear();
        if (state.joinedCommunities.length > 0) {
          await db.joinedCommunities.bulkPut(
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
    if (!db) {
      return null;
    }

    const row = await db.drafts.get(POST_DRAFT_STORAGE_KEY);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function savePostDraft(postDraft: PostDraftState) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

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
    if (!db) {
      return;
    }

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
    if (!db) {
      return null;
    }

    const row = await db.postCache.get(getPostCacheKey(communityId, scope));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedPosts(value: CachedPostsValue) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

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

export async function loadCachedAnnouncements(communityId: string): Promise<CachedAnnouncementsValue | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.announcementCache.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveCachedAnnouncements(value: CachedAnnouncementsValue) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.announcementCache.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

export async function loadP2PKeyMaterial(communityId: string): Promise<P2PKeyMaterial | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.p2pKeys.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PKeyMaterial(value: P2PKeyMaterial) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.p2pKeys.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

export async function loadP2PSyncState(communityId: string): Promise<P2PSyncStatus | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.p2pSyncState.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PSyncState(value: P2PSyncStatus) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.p2pSyncState.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

export async function loadP2PEventCursor(communityId: string): Promise<P2PEventCursor | null> {
  try {
    const db = getPwaDb();
    if (!db) {
      return null;
    }

    const row = await db.p2pEventCursor.get(communityId);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveP2PEventCursor(value: P2PEventCursor) {
  try {
    const db = getPwaDb();
    if (!db) {
      return;
    }

    await db.p2pEventCursor.put({
      communityId: value.communityId,
      value,
    });
  } catch {
    return;
  }
}

export async function applyCommunitySyncDeltaToCache(delta: CommunitySyncDeltaResponse) {
  try {
    const db = getPwaDb();
    if (!db || delta.events.length === 0) {
      return;
    }

    const updatedAt = delta.server_time;
    // Apply events in (occurred_at, sync_event_id) order rather than
    // socket-arrival order. Out-of-order WS frames that race with HTTP
    // catch-up previously caused stale updates to overwrite fresher ones
    // (audit P2.3). Ordering here + the p2p_version guard in
    // `mergeVersionedRecord` + tombstone markers together close the
    // resurrection window.
    const sortedEvents = sortSyncEventsForReplay(delta.events);
    const communityIds = Array.from(new Set(sortedEvents.map((event) => event.community_id)));

    for (const communityId of communityIds) {
      const communityEvents = sortedEvents.filter((event) => event.community_id === communityId);
      let communityPosts =
        (await db.postCache.get(getPostCacheKey(communityId, 'community')))?.value ?? {
          communityId,
          scope: 'community' as const,
          items: [],
          next_cursor: null,
          updatedAt,
          source: 'cache' as const,
        };
      let publicPosts =
        (await db.postCache.get(getPostCacheKey(communityId, 'public')))?.value ?? {
          communityId,
          scope: 'public' as const,
          items: [],
          next_cursor: null,
          updatedAt,
          source: 'cache' as const,
        };
      let announcements =
        (await db.announcementCache.get(communityId))?.value ?? {
          communityId,
          items: [],
          next_cursor: null,
          updatedAt,
          source: 'cache' as const,
        };
      const eventLogKey = getP2PEventLogKey(communityId);
      const supportsEventLog =
        typeof (db as { kv?: { get?: unknown; put?: unknown } }).kv?.get === 'function' &&
        typeof (db as { kv?: { get?: unknown; put?: unknown } }).kv?.put === 'function';
      const existingEventLog = supportsEventLog ? await db.kv.get(eventLogKey) : null;
      const currentEventLog =
        existingEventLog &&
        typeof existingEventLog === 'object' &&
        'value' in existingEventLog &&
        isRecord(existingEventLog.value) &&
        Array.isArray(existingEventLog.value.items)
          ? (existingEventLog.value.items as CommunitySyncEvent[])
          : [];

      for (const event of communityEvents) {
        if (event.aggregate_type === 'post') {
          communityPosts = applyPostEvent(communityPosts, event, updatedAt);
          publicPosts = applyPostEvent(publicPosts, event, updatedAt);
          continue;
        }

        if (event.aggregate_type === 'announcement') {
          announcements = applyAnnouncementEvent(announcements, event, updatedAt);
        }
      }

      // Drop tombstone markers older than the retention window so IndexedDB
      // doesn't grow unbounded on long-running sessions.
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
        cacheKey: getPostCacheKey(communityId, 'community'),
        communityId,
        scope: 'community',
        value: communityPosts,
      });
      await db.postCache.put({
        cacheKey: getPostCacheKey(communityId, 'public'),
        communityId,
        scope: 'public',
        value: publicPosts,
      });
      await db.announcementCache.put({
        communityId,
        value: announcements,
      });
      if (supportsEventLog) {
        await db.kv.put({
          key: eventLogKey,
          value: {
            communityId,
            updatedAt,
            items: mergeCommunityEventLog(currentEventLog, communityEvents),
          },
        });
      }
    }
  } catch {
    return;
  }
}
