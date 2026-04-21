import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyCommunitySyncDeltaToCache,
  filterVisibleAnnouncements,
  filterVisiblePostsForScope,
  loadCachedAnnouncements,
  loadCachedPosts,
  loadP2PEventCursor,
  loadP2PKeyMaterial,
  loadP2PSyncState,
  saveCachedAnnouncements,
  saveCachedPosts,
  saveP2PEventCursor,
  saveP2PKeyMaterial,
  saveP2PSyncState,
} from './persistence';

const postCacheStore = new Map<string, unknown>();
const announcementCacheStore = new Map<string, unknown>();
const p2pKeyStore = new Map<string, unknown>();
const p2pSyncStateStore = new Map<string, unknown>();
const p2pEventCursorStore = new Map<string, unknown>();
const kvStore = new Map<string, unknown>();

vi.mock('@/lib/db', () => ({
  getPwaDb: () => ({
    postCache: {
      get: vi.fn(async (key: string) => postCacheStore.get(key)),
      put: vi.fn(async (value: { cacheKey: string; value: unknown }) => {
        postCacheStore.set(value.cacheKey, value);
      }),
    },
    announcementCache: {
      get: vi.fn(async (key: string) => announcementCacheStore.get(key)),
      put: vi.fn(async (value: { communityId: string; value: unknown }) => {
        announcementCacheStore.set(value.communityId, value);
      }),
    },
    p2pKeys: {
      get: vi.fn(async (key: string) => p2pKeyStore.get(key)),
      put: vi.fn(async (value: { communityId: string; value: unknown }) => {
        p2pKeyStore.set(value.communityId, value);
      }),
    },
    p2pSyncState: {
      get: vi.fn(async (key: string) => p2pSyncStateStore.get(key)),
      put: vi.fn(async (value: { communityId: string; value: unknown }) => {
        p2pSyncStateStore.set(value.communityId, value);
      }),
    },
    p2pEventCursor: {
      get: vi.fn(async (key: string) => p2pEventCursorStore.get(key)),
      put: vi.fn(async (value: { communityId: string; value: unknown }) => {
        p2pEventCursorStore.set(value.communityId, value);
      }),
    },
    kv: {
      get: vi.fn(async (key: string) => kvStore.get(key)),
      put: vi.fn(async (value: { key: string; value: unknown }) => {
        kvStore.set(value.key, value);
      }),
    },
  }),
}));

describe('pwa persistence helpers', () => {
  // Pin "now" to a date 3 days after the test fixture timestamps so the 7-day
  // tombstone retention window is well within range. Without this pin, a
  // system clock running ahead of the fixtures would cause the pruning pass
  // to drop tombstones mid-test.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-16T00:00:00.000Z'));
  });

  afterEach(() => {
    postCacheStore.clear();
    announcementCacheStore.clear();
    p2pKeyStore.clear();
    p2pSyncStateStore.clear();
    p2pEventCursorStore.clear();
    kvStore.clear();
    vi.useRealTimers();
  });

  it('stores and loads cached community posts', async () => {
    await saveCachedPosts({
      communityId: 'comm_1',
      scope: 'community',
      items: [],
      next_cursor: null,
      updatedAt: '2026-04-13T12:00:00.000Z',
      source: 'network',
    });

    await expect(loadCachedPosts('comm_1', 'community')).resolves.toMatchObject({
      communityId: 'comm_1',
      scope: 'community',
      source: 'network',
    });
  });

  it('stores and loads cached announcements', async () => {
    await saveCachedAnnouncements({
      communityId: 'comm_1',
      items: [
        {
          announcement_id: 'ann_1',
          community_id: 'comm_1',
          title: 'Pantry update',
          body: 'Open Saturday morning.',
          is_pinned: true,
        },
      ],
      next_cursor: null,
      updatedAt: '2026-04-13T12:05:00.000Z',
      source: 'network',
    });

    await expect(loadCachedAnnouncements('comm_1')).resolves.toMatchObject({
      communityId: 'comm_1',
      items: [expect.objectContaining({ announcement_id: 'ann_1' })],
    });
  });

  it('stores and loads P2P sync metadata', async () => {
    await saveP2PKeyMaterial({
      communityId: 'comm_1',
      peerId: 'edge-123',
      createdAt: '2026-04-13T12:00:00.000Z',
    });
    await saveP2PSyncState({
      communityId: 'comm_1',
      enabled: true,
      mdnsDemoEnabled: false,
      phase: 'ready',
      peerId: 'edge-123',
      peerCount: 2,
      transportLabel: 'bootstrap',
      lastSyncAt: '2026-04-13T12:06:00.000Z',
      latestSnapshot: null,
      lastError: null,
    });
    await saveP2PEventCursor({
      communityId: 'comm_1',
      since: '2026-04-13T12:06:00.000Z',
      updatedAt: '2026-04-13T12:06:00.000Z',
    });

    await expect(loadP2PKeyMaterial('comm_1')).resolves.toMatchObject({
      peerId: 'edge-123',
    });
    await expect(loadP2PSyncState('comm_1')).resolves.toMatchObject({
      phase: 'ready',
      peerCount: 2,
    });
    await expect(loadP2PEventCursor('comm_1')).resolves.toMatchObject({
      since: '2026-04-13T12:06:00.000Z',
    });
  });

  it('applies post and announcement sync events into offline caches', async () => {
    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_post_1',
          community_id: 'comm_1',
          event_type: 'post.published',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_post_1',
          occurred_at: '2026-04-13T12:10:00.000Z',
          payload: {
            post: {
              post_id: 'post_1',
              community_id: 'comm_1',
              p2p_version: 2,
              post_type: 'request',
              category: 'food',
              title: 'Need pantry pickup',
              body: 'Can someone help on Tuesday?',
              language: 'en',
              location_zip: '11735',
              privacy: 'public',
              status: 'active',
              risk_level: 'low',
              created_at: '2026-04-13T12:09:00.000Z',
              updated_at: '2026-04-13T12:10:00.000Z',
              expires_at: '2026-04-20T12:10:00.000Z',
              is_owner: false,
            },
          },
        },
        {
          sync_event_id: 'evt_ann_1',
          community_id: 'comm_1',
          event_type: 'announcement.published',
          aggregate_type: 'announcement',
          aggregate_id: 'ann_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_ann_1',
          occurred_at: '2026-04-13T12:11:00.000Z',
          payload: {
            announcement: {
              announcement_id: 'ann_1',
              community_id: 'comm_1',
              p2p_version: 1,
              title: 'Pantry hours',
              body: 'Open late today.',
              is_pinned: true,
              status: 'active',
              published_at: '2026-04-13T12:11:00.000Z',
              updated_at: '2026-04-13T12:11:00.000Z',
            },
          },
        },
      ],
      next_since: '2026-04-13T12:11:00.000Z',
      server_time: '2026-04-13T12:11:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:11:00.000Z',
        event_count: 2,
      },
    });

    await expect(loadCachedPosts('comm_1', 'community')).resolves.toMatchObject({
      source: 'cache',
      items: [expect.objectContaining({ post_id: 'post_1' })],
    });
    await expect(loadCachedPosts('comm_1', 'public')).resolves.toMatchObject({
      source: 'cache',
      items: [expect.objectContaining({ post_id: 'post_1', privacy: 'public' })],
    });
    await expect(loadCachedAnnouncements('comm_1')).resolves.toMatchObject({
      source: 'cache',
      items: [expect.objectContaining({ announcement_id: 'ann_1', is_pinned: true })],
    });
  });

  it('keeps the newest p2p_version when stale replay arrives', async () => {
    await saveCachedPosts({
      communityId: 'comm_1',
      scope: 'community',
      items: [
        {
          post_id: 'post_1',
          community_id: 'comm_1',
          post_type: 'request',
          category: 'food',
          title: 'Fresh title',
          body: 'Fresh body',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          status: 'active',
          risk_level: 'low',
          created_at: '2026-04-13T12:09:00.000Z',
          updated_at: '2026-04-13T12:10:00.000Z',
          expires_at: '2026-04-20T12:10:00.000Z',
          is_owner: false,
          p2p_version: 5,
        },
      ],
      next_cursor: null,
      updatedAt: '2026-04-13T12:10:00.000Z',
      source: 'network',
    });

    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_post_stale',
          community_id: 'comm_1',
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_post_stale',
          occurred_at: '2026-04-13T12:11:00.000Z',
          payload: {
            post: {
              post_id: 'post_1',
              community_id: 'comm_1',
              p2p_version: 3,
              post_type: 'request',
              category: 'food',
              title: 'Stale title',
              body: 'Stale body',
              language: 'en',
              location_zip: '11735',
              privacy: 'community_only',
              status: 'active',
              risk_level: 'low',
              created_at: '2026-04-13T12:09:00.000Z',
              updated_at: '2026-04-13T12:11:00.000Z',
              expires_at: '2026-04-20T12:10:00.000Z',
              is_owner: false,
            },
          },
        },
      ],
      next_since: 'opaque_cursor_v2',
      server_time: '2026-04-13T12:11:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:11:00.000Z',
        event_count: 4,
      },
    });

    await expect(loadCachedPosts('comm_1', 'community')).resolves.toMatchObject({
      items: [expect.objectContaining({ body: 'Fresh body', p2p_version: 5 })],
      source: 'cache',
    });
  });

  it('keeps tombstone markers in cache (status=removed + p2p_version) after post.tombstoned', async () => {
    await saveCachedPosts({
      communityId: 'comm_1',
      scope: 'community',
      items: [
        {
          post_id: 'post_1',
          community_id: 'comm_1',
          post_type: 'request',
          category: 'food',
          title: 'Need pantry pickup',
          body: 'Can someone help on Tuesday?',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          status: 'active',
          risk_level: 'low',
          created_at: '2026-04-13T12:09:00.000Z',
          updated_at: '2026-04-13T12:10:00.000Z',
          expires_at: '2026-04-20T12:10:00.000Z',
          is_owner: false,
          p2p_version: 2,
        },
      ],
      next_cursor: null,
      updatedAt: '2026-04-13T12:10:00.000Z',
      source: 'network',
    });

    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_post_2',
          community_id: 'comm_1',
          event_type: 'post.tombstoned',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_post_2',
          occurred_at: '2026-04-13T12:12:00.000Z',
          payload: { p2p_version: 5 },
        },
      ],
      next_since: '2026-04-13T12:12:00.000Z',
      server_time: '2026-04-13T12:12:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:12:00.000Z',
        event_count: 3,
      },
    });

    // Tombstone stays in cache as a marker carrying the latest p2p_version
    // so stale updates cannot resurrect it (see mergeVersionedRecord). But
    // it's excluded from the feed-visible list by filterVisiblePostsForScope.
    const cached = await loadCachedPosts('comm_1', 'community');
    expect(cached?.items).toEqual([
      expect.objectContaining({
        post_id: 'post_1',
        status: 'removed',
        p2p_version: 5,
      }),
    ]);
    expect(filterVisiblePostsForScope(cached?.items, 'community')).toEqual([]);
  });

  it('post.updated with older p2p_version does not resurrect tombstoned post', async () => {
    // First write: a live post at p2p_version=3.
    await saveCachedPosts({
      communityId: 'comm_1',
      scope: 'community',
      items: [
        {
          post_id: 'post_1',
          community_id: 'comm_1',
          post_type: 'request',
          category: 'food',
          title: 'Need pantry pickup',
          body: 'Can someone help on Tuesday?',
          language: 'en',
          location_zip: '11735',
          privacy: 'community_only',
          status: 'active',
          risk_level: 'low',
          created_at: '2026-04-13T12:09:00.000Z',
          updated_at: '2026-04-13T12:10:00.000Z',
          expires_at: '2026-04-20T12:10:00.000Z',
          is_owner: false,
          p2p_version: 3,
        },
      ],
      next_cursor: null,
      updatedAt: '2026-04-13T12:10:00.000Z',
      source: 'network',
    });

    // Tombstone lands at p2p_version=10.
    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_tomb',
          community_id: 'comm_1',
          event_type: 'post.tombstoned',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_tomb',
          occurred_at: '2026-04-13T12:12:00.000Z',
          payload: { p2p_version: 10 },
        },
      ],
      next_since: '2026-04-13T12:12:00.000Z',
      server_time: '2026-04-13T12:12:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:12:00.000Z',
        event_count: 3,
      },
    });

    // A straggler `post.updated` arrives with p2p_version=4 — older than the
    // tombstone's 10. The tombstone must win; the post must NOT resurrect.
    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_stale_update',
          community_id: 'comm_1',
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_stale',
          occurred_at: '2026-04-13T12:13:00.000Z',
          payload: {
            post: {
              post_id: 'post_1',
              community_id: 'comm_1',
              p2p_version: 4,
              post_type: 'request',
              category: 'food',
              title: 'Resurrected title',
              body: 'Resurrected body',
              language: 'en',
              location_zip: '11735',
              privacy: 'community_only',
              status: 'active',
              risk_level: 'low',
              created_at: '2026-04-13T12:09:00.000Z',
              updated_at: '2026-04-13T12:13:00.000Z',
              expires_at: '2026-04-20T12:10:00.000Z',
              is_owner: false,
            },
          },
        },
      ],
      next_since: '2026-04-13T12:13:00.000Z',
      server_time: '2026-04-13T12:13:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:13:00.000Z',
        event_count: 4,
      },
    });

    const cached = await loadCachedPosts('comm_1', 'community');
    // The cache still carries the tombstone marker at version=10 (not the
    // stale update at version=4).
    expect(cached?.items).toEqual([
      expect.objectContaining({ post_id: 'post_1', status: 'removed', p2p_version: 10 }),
    ]);
    // The feed-visible list stays empty.
    expect(filterVisiblePostsForScope(cached?.items, 'community')).toEqual([]);
  });

  it('applies events in occurred_at order even when the server delivers them out of order', async () => {
    // Server delivers updated(v=3) BEFORE the chronologically earlier
    // updated(v=2). If we applied in arrival order the final cache would be
    // at v=2. Correct replay order (by occurred_at, sync_event_id) means
    // v=3 wins.
    await applyCommunitySyncDeltaToCache({
      events: [
        {
          sync_event_id: 'evt_b',
          community_id: 'comm_1',
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_b',
          occurred_at: '2026-04-13T12:11:00.000Z',
          payload: {
            post: {
              post_id: 'post_1',
              community_id: 'comm_1',
              p2p_version: 3,
              post_type: 'request',
              category: 'food',
              title: 'Latest title',
              body: 'Latest body',
              language: 'en',
              location_zip: '11735',
              privacy: 'community_only',
              status: 'active',
              risk_level: 'low',
              created_at: '2026-04-13T12:09:00.000Z',
              updated_at: '2026-04-13T12:11:00.000Z',
              expires_at: '2026-04-20T12:10:00.000Z',
              is_owner: false,
            },
          },
        },
        {
          sync_event_id: 'evt_a',
          community_id: 'comm_1',
          event_type: 'post.updated',
          aggregate_type: 'post',
          aggregate_id: 'post_1',
          actor_p2p_id: 'edge_1',
          cid: 'cid_a',
          occurred_at: '2026-04-13T12:10:00.000Z',
          payload: {
            post: {
              post_id: 'post_1',
              community_id: 'comm_1',
              p2p_version: 2,
              post_type: 'request',
              category: 'food',
              title: 'Earlier title',
              body: 'Earlier body',
              language: 'en',
              location_zip: '11735',
              privacy: 'community_only',
              status: 'active',
              risk_level: 'low',
              created_at: '2026-04-13T12:09:00.000Z',
              updated_at: '2026-04-13T12:10:00.000Z',
              expires_at: '2026-04-20T12:10:00.000Z',
              is_owner: false,
            },
          },
        },
      ],
      next_since: '2026-04-13T12:11:00.000Z',
      server_time: '2026-04-13T12:11:01.000Z',
      latest_snapshot: {
        last_event_at: '2026-04-13T12:11:00.000Z',
        event_count: 2,
      },
    });

    await expect(loadCachedPosts('comm_1', 'community')).resolves.toMatchObject({
      items: [expect.objectContaining({ title: 'Latest title', p2p_version: 3 })],
    });
  });

  it('filterVisibleAnnouncements drops tombstoned announcements', () => {
    const items = [
      {
        announcement_id: 'ann_live',
        community_id: 'comm_1',
        title: 'Live',
        body: 'live',
        is_pinned: false,
        status: 'active',
      },
      {
        announcement_id: 'ann_tomb',
        community_id: 'comm_1',
        title: '',
        body: '',
        is_pinned: false,
        status: 'deleted' as const,
      },
    ];

    expect(filterVisibleAnnouncements(items)).toEqual([
      expect.objectContaining({ announcement_id: 'ann_live' }),
    ]);
  });
});
