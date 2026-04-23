/**
 * M2 STUB — the PWA's `db.ts` wraps Dexie (IndexedDB). Dexie is a
 * web-only dependency; mobile will rewrite this module on top of
 * `react-native-mmkv` (key-value) and / or `expo-sqlite` (relational
 * tables for the outbox + P2P event log) in M6.
 *
 * Until M6 lands, this file exists solely so `@/lib/persistence` and
 * `@/lib/hooks` can resolve their `@/lib/db` / `PendingPostEntry`
 * imports at TypeScript / Metro load time. Every runtime helper is a
 * no-op that returns `null` / `undefined` so the module evaluates
 * cleanly under the jest smoke suite without pulling Dexie (which
 * would crash under the `node` jest preset). See `STORAGE.md` for the
 * planned replacement.
 *
 * DO NOT add real persistence logic here — the goal is to keep the
 * M6 rewrite boundary clean. Any new read/write path should land in
 * M6 with a proper schema + migration story.
 */

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

// Retained so downstream module-level types still compile; these row
// shapes are documentation of the Dexie table layout the mobile port
// will eventually replicate on top of expo-sqlite.
export type _KvRow = { key: string; value: unknown };
export type _JoinedCommunityRow = { communityId: string; value: JoinedCommunity };
export type _DraftRow = { key: string; value: PostDraftState };
export type _PostCacheRow = {
  cacheKey: string;
  communityId: string;
  scope: CachedPostsValue['scope'];
  value: CachedPostsValue;
};
export type _AnnouncementCacheRow = {
  communityId: string;
  value: CachedAnnouncementsValue;
};
export type _P2PKeyRow = { communityId: string; value: P2PKeyMaterial };
export type _P2PSyncStateRow = { communityId: string; value: P2PSyncStatus };
export type _P2PEventCursorRow = { communityId: string; value: P2PEventCursor };

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

/**
 * Matches the PWA signature so `@/lib/persistence` compiles unchanged.
 * Always returns null on mobile until M6 provides the native-backed
 * database. Downstream callers must treat null as "no persistence" and
 * gracefully skip the read/write, exactly like the PWA's SSR path.
 */
export function getPwaDb(): null {
  return null;
}
