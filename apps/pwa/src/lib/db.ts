import Dexie, { type Table } from "dexie";

import type { JoinedCommunity, PostDraftState } from '@/lib/types';

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

class WeavePwaDb extends Dexie {
  kv!: Table<KvRow, string>;
  joinedCommunities!: Table<JoinedCommunityRow, string>;
  drafts!: Table<DraftRow, string>;

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
