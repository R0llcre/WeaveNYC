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

function removePost(items: PostSummary[], postId: string) {
  return items.filter((item) => item.post_id !== postId);
}

function removeAnnouncement(items: CommunityAnnouncement[], announcementId: string) {
  return items.filter((item) => item.announcement_id !== announcementId);
}

function isVisibleInCommunityScope(post: PostSummary) {
  return post.status === 'active' && post.privacy !== 'anchor_mediated';
}

function isVisibleInPublicScope(post: PostSummary) {
  return post.status === 'active' && post.privacy === 'public';
}

function isActiveAnnouncement(announcement: CommunityAnnouncement) {
  return announcement.status !== 'deleted' && announcement.status !== 'removed';
}

function sortSyncEvents(events: CommunitySyncEvent[]) {
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
  for (const event of sortSyncEvents([...current, ...incoming])) {
    deduped.set(event.sync_event_id, event);
  }

  const merged = [...deduped.values()];
  return merged.slice(Math.max(merged.length - limit, 0));
}

function applyPostEvent(cache: CachedPostsValue, event: CommunitySyncEvent, updatedAt: string) {
  const payload = isRecord(event.payload) ? event.payload : null;
  const post = toPostSummary(payload?.post ?? payload);
  const nextItems = removePost(cache.items, event.aggregate_id);

  if (!post) {
    return {
      ...cache,
      items: nextItems,
      updatedAt,
      source: 'cache' as const,
    };
  }

  const shouldInclude =
    cache.scope === 'community' ? isVisibleInCommunityScope(post) : isVisibleInPublicScope(post);
  const existingPost = cache.items.find((item) => item.post_id === event.aggregate_id) ?? null;
  const mergedPost = mergeVersionedRecord(existingPost, post);

  return {
    ...cache,
    items: shouldInclude && mergedPost ? sortPosts([...nextItems, mergedPost]) : nextItems,
    updatedAt,
    source: 'cache' as const,
  };
}

function applyAnnouncementEvent(
  cache: CachedAnnouncementsValue,
  event: CommunitySyncEvent,
  updatedAt: string,
) {
  const payload = isRecord(event.payload) ? event.payload : null;
  const announcement = toAnnouncement(payload?.announcement ?? payload);
  const nextItems = removeAnnouncement(cache.items, event.aggregate_id);
  const existingAnnouncement = cache.items.find((item) => item.announcement_id === event.aggregate_id) ?? null;
  const mergedAnnouncement = announcement ? mergeVersionedRecord(existingAnnouncement, announcement) : null;

  return {
    ...cache,
    items:
      mergedAnnouncement && isActiveAnnouncement(mergedAnnouncement)
        ? sortAnnouncements([...nextItems, mergedAnnouncement])
        : nextItems,
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
    const communityIds = Array.from(new Set(delta.events.map((event) => event.community_id)));

    for (const communityId of communityIds) {
      const communityEvents = delta.events.filter((event) => event.community_id === communityId);
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
