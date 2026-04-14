import Dexie, { type Table } from "dexie";

import type {
  CachedAnnouncementsValue,
  CachedPostsValue,
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

class WeavePwaDb extends Dexie {
  kv!: Table<KvRow, string>;
  joinedCommunities!: Table<JoinedCommunityRow, string>;
  drafts!: Table<DraftRow, string>;
  postCache!: Table<PostCacheRow, string>;
  announcementCache!: Table<AnnouncementCacheRow, string>;
  p2pKeys!: Table<P2PKeyRow, string>;
  p2pSyncState!: Table<P2PSyncStateRow, string>;
  p2pEventCursor!: Table<P2PEventCursorRow, string>;

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
