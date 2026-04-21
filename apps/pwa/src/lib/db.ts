import Dexie, { type Table } from "dexie";

import type {
  CachedAnnouncementsValue,
  CachedPostsValue,
  CreatePostInput,
  JoinedCommunity,
  P2PEventCursor,
  P2PKeyMaterial,
  P2PSyncStatus,
  PostDraftState,
} from '@/lib/types';

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
  scope: CachedPostsValue['scope'];
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
 * Write outbox — posts that were queued on the device (often while offline)
 * and are waiting to be POSTed to the server. See `docs/offline-outbox.md`
 * for the full lifecycle. Each entry stays in IDB until either a successful
 * POST removes it or the user explicitly discards it; the hook
 * `useOutboxDrain` walks this table on `online` / visibility / mount.
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

type PendingPostRow = PendingPostEntry;

class WeavePwaDb extends Dexie {
  kv!: Table<KvRow, string>;
  joinedCommunities!: Table<JoinedCommunityRow, string>;
  drafts!: Table<DraftRow, string>;
  postCache!: Table<PostCacheRow, string>;
  announcementCache!: Table<AnnouncementCacheRow, string>;
  p2pKeys!: Table<P2PKeyRow, string>;
  p2pSyncState!: Table<P2PSyncStateRow, string>;
  p2pEventCursor!: Table<P2PEventCursorRow, string>;
  /**
   * Pending (queued) post publishes waiting to drain. Indexed on
   * `community_id` so the pending-posts UI can cheaply scope by scope, and on
   * `created_at` so the drain pass can walk entries oldest-first.
   */
  pendingPosts!: Table<PendingPostRow, string>;

  constructor() {
    super("weavenyc-pwa");
    this.version(1).stores({
      kv: "&key"
    });
    this.version(2).stores({
      kv: "&key",
      joinedCommunities: "&communityId",
      drafts: "&key",
    });
    this.version(3).stores({
      kv: "&key",
      joinedCommunities: "&communityId",
      drafts: "&key",
      postCache: "&cacheKey, communityId, scope",
      announcementCache: "&communityId",
      p2pKeys: "&communityId",
      p2pSyncState: "&communityId",
      p2pEventCursor: "&communityId",
    });
    // v4 — offline write outbox for post publishes. Backward-compatible:
    // existing tables are untouched, the new store is purely additive so
    // users upgrading from v3 keep every cached post / announcement /
    // community / draft without migration. See `docs/offline-outbox.md`.
    this.version(4).stores({
      kv: "&key",
      joinedCommunities: "&communityId",
      drafts: "&key",
      postCache: "&cacheKey, communityId, scope",
      announcementCache: "&communityId",
      p2pKeys: "&communityId",
      p2pSyncState: "&communityId",
      p2pEventCursor: "&communityId",
      pendingPosts: "&client_id, community_id, created_at",
    });
  }
}

let instance: WeavePwaDb | null = null;

export function getPwaDb() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!instance) {
    instance = new WeavePwaDb();
  }

  return instance;
}
