/**
 * M2 STUB — the PWA's full persistence layer (Dexie / IndexedDB +
 * tombstone-aware cache merging + outbox) lives in
 * `apps/pwa/src/lib/persistence.ts`. Mobile will rebuild this module in
 * M6 on top of `react-native-mmkv` (for KV-shaped state: preferences,
 * session, post-draft, community state) and `expo-sqlite` (for the
 * outbox + the P2P event log).
 *
 * Until M6, every async helper returns `null` / `void` so the ported
 * `@/lib/hooks`, `@/lib/use-sign-out`, and any screen that calls a
 * persistence function module-loads cleanly and, at runtime, behaves as
 * if persistence were always a cache miss — exactly the fallback the
 * PWA already handles on SSR. The pure helpers (`filterVisiblePostsForScope`,
 * `filterVisibleAnnouncements`) are truly pure and are kept here
 * verbatim so consumers that call them don't need an import-rewrite in
 * M6; those stay identical in the final M6 implementation.
 *
 * DO NOT add real persistence logic here — the goal is to keep the M6
 * rewrite boundary clean. Any new read/write path should land in M6
 * with a proper schema + migration story.
 */

import type {
  AuthSession,
  CachedAnnouncementsValue,
  CachedPostsValue,
  CommunityAnnouncement,
  CommunitySyncDeltaResponse,
  CommunityState,
  P2PEventCursor,
  P2PKeyMaterial,
  P2PSyncStatus,
  PostSummary,
  PostDraftState,
  PreferencesState,
} from '@/lib/types';

export type { PendingPostEntry } from '@/lib/db';
import type { PendingPostEntry } from '@/lib/db';

function isActiveAnnouncement(announcement: CommunityAnnouncement): boolean {
  if (typeof announcement.status !== 'string') {
    return true;
  }
  return announcement.status !== 'deleted' && announcement.status !== 'tombstoned';
}

function isVisibleInCommunityScope(post: PostSummary): boolean {
  return post.status !== 'removed';
}

function isVisibleInPublicScope(post: PostSummary): boolean {
  if (post.status === 'removed') {
    return false;
  }
  return post.privacy === 'public' || post.privacy === 'anchor_mediated';
}

/**
 * Pure — filters a cached post list down to the feed-visible entries for
 * a given scope. Consumers (community-screen, community-announcements)
 * should call this before rendering so tombstones — which live in cache
 * for version comparison — never leak into the UI.
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
 * Pure — filters a cached announcement list down to feed-visible entries
 * (drops tombstones).
 */
export function filterVisibleAnnouncements(
  items: CommunityAnnouncement[] | undefined,
): CommunityAnnouncement[] {
  if (!items) {
    return [];
  }

  return items.filter((item) => isActiveAnnouncement(item));
}

/* ------------------------------------------------------------------------- */
/* STUBS — every async helper below returns a null/void shape until M6.      */
/* ------------------------------------------------------------------------- */

export type PersistedAuthSession = Omit<AuthSession, 'access_token'>;

export async function loadPreferences(): Promise<Partial<PreferencesState> | null> {
  return null;
}

export async function savePreferences(_preferences: PreferencesState): Promise<void> {
  void _preferences;
}

export async function loadSession(): Promise<PersistedAuthSession | null> {
  return null;
}

export async function saveSession(_session: AuthSession | null): Promise<void> {
  void _session;
}

export async function loadCommunityState(): Promise<Partial<CommunityState> | null> {
  return null;
}

export async function saveCommunityState(_state: CommunityState): Promise<void> {
  void _state;
}

export async function loadPostDraft(): Promise<PostDraftState | null> {
  return null;
}

export async function savePostDraft(_postDraft: PostDraftState): Promise<void> {
  void _postDraft;
}

export async function clearPostDraft(): Promise<void> {
  return;
}

export async function loadCachedPosts(
  _communityId: string,
  _scope: CachedPostsValue['scope'],
): Promise<CachedPostsValue | null> {
  void _communityId;
  void _scope;
  return null;
}

export async function saveCachedPosts(_value: CachedPostsValue): Promise<void> {
  void _value;
}

export async function loadCachedAnnouncements(
  _communityId: string,
): Promise<CachedAnnouncementsValue | null> {
  void _communityId;
  return null;
}

export async function saveCachedAnnouncements(_value: CachedAnnouncementsValue): Promise<void> {
  void _value;
}

export async function loadP2PKeyMaterial(_communityId: string): Promise<P2PKeyMaterial | null> {
  void _communityId;
  return null;
}

export async function saveP2PKeyMaterial(_value: P2PKeyMaterial): Promise<void> {
  void _value;
}

export async function loadP2PSyncState(_communityId: string): Promise<P2PSyncStatus | null> {
  void _communityId;
  return null;
}

export async function saveP2PSyncState(_value: P2PSyncStatus): Promise<void> {
  void _value;
}

export async function loadP2PEventCursor(_communityId: string): Promise<P2PEventCursor | null> {
  void _communityId;
  return null;
}

export async function saveP2PEventCursor(_value: P2PEventCursor): Promise<void> {
  void _value;
}

/**
 * M6 will accept either an already-materialised cache-replay delta or
 * the raw sync-delta response. Until then this is a no-op.
 */
export async function applyCommunitySyncDeltaToCache(
  _delta: CommunitySyncDeltaResponse | { events: CommunitySyncDeltaResponse['events'] },
): Promise<void> {
  void _delta;
}

export async function enqueuePendingPost(_entry: PendingPostEntry): Promise<void> {
  void _entry;
}

export async function listPendingPosts(_communityId?: string): Promise<PendingPostEntry[]> {
  void _communityId;
  return [];
}

export async function markPendingPostAttempt(
  _clientId: string,
  _message: string,
  _options?: { permanent?: boolean },
): Promise<void> {
  void _clientId;
  void _message;
  void _options;
}

export async function removePendingPost(_clientId: string): Promise<void> {
  void _clientId;
}
