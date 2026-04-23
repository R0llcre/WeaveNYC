/**
 * Persistence layer tests — port of the PWA's `persistence.test.ts`,
 * rewired for the mobile storage facade.
 *
 * The PWA test mocked `@/lib/db` (Dexie) wholesale. We reuse that exact
 * pattern because the mobile `db.ts` exposes the same Dexie-shaped API
 * surface — `.get()`, `.put()`, `.delete()`, `.toArray()`,
 * `.where().equals().toArray()`, `.bulkPut()`, `.clear()` — so the test
 * mock translates 1:1. The only delta is the SecureStore mock for the
 * refresh_token path, which the PWA didn't need (it wrote the whole
 * session to IDB).
 *
 * We intentionally do NOT exercise the native MMKV / SQLite / SecureStore
 * implementations here — those require the RN runtime and are covered
 * by the Wave B smoke suite (which boots Expo and hits the JSI bridge).
 * This test validates the persistence.ts business logic (replay,
 * tombstone retention, session strip) against the same in-memory
 * fixtures the PWA test uses.
 */

import type { PendingPostEntry } from '../db';

const postCacheStore = new Map<string, unknown>();
const announcementCacheStore = new Map<string, unknown>();
const p2pKeyStore = new Map<string, unknown>();
const p2pSyncStateStore = new Map<string, unknown>();
const p2pEventCursorStore = new Map<string, unknown>();
const kvStore = new Map<string, unknown>();
const joinedCommunityStore = new Map<string, unknown>();
const draftStore = new Map<string, unknown>();
const pendingPostsStore = new Map<string, PendingPostEntry>();
const secureStore = new Map<string, string>();

jest.mock('@/lib/db', () => ({
  getPwaDb: () => ({
    postCache: {
      get: jest.fn(async (key: string) => postCacheStore.get(key)),
      put: jest.fn(async (value: { cacheKey: string; value: unknown }) => {
        postCacheStore.set(value.cacheKey, value);
      }),
    },
    announcementCache: {
      get: jest.fn(async (key: string) => announcementCacheStore.get(key)),
      put: jest.fn(async (value: { communityId: string; value: unknown }) => {
        announcementCacheStore.set(value.communityId, value);
      }),
    },
    p2pKeys: {
      get: jest.fn(async (key: string) => p2pKeyStore.get(key)),
      put: jest.fn(async (value: { communityId: string; value: unknown }) => {
        p2pKeyStore.set(value.communityId, value);
      }),
    },
    p2pSyncState: {
      get: jest.fn(async (key: string) => p2pSyncStateStore.get(key)),
      put: jest.fn(async (value: { communityId: string; value: unknown }) => {
        p2pSyncStateStore.set(value.communityId, value);
      }),
    },
    p2pEventCursor: {
      get: jest.fn(async (key: string) => p2pEventCursorStore.get(key)),
      put: jest.fn(async (value: { communityId: string; value: unknown }) => {
        p2pEventCursorStore.set(value.communityId, value);
      }),
    },
    kv: {
      get: jest.fn(async (key: string) => kvStore.get(key)),
      put: jest.fn(async (value: { key: string; value: unknown }) => {
        kvStore.set(value.key, value);
      }),
      delete: jest.fn(async (key: string) => {
        kvStore.delete(key);
      }),
    },
    joinedCommunities: {
      get: jest.fn(async (key: string) => joinedCommunityStore.get(key)),
      put: jest.fn(async (value: { communityId: string; value: unknown }) => {
        joinedCommunityStore.set(value.communityId, value);
      }),
      delete: jest.fn(async (key: string) => {
        joinedCommunityStore.delete(key);
      }),
      toArray: jest.fn(async () =>
        Array.from(joinedCommunityStore.values()) as Array<{
          communityId: string;
          value: unknown;
        }>,
      ),
      clear: jest.fn(async () => {
        joinedCommunityStore.clear();
      }),
      bulkPut: jest.fn(
        async (rows: Array<{ communityId: string; value: unknown }>) => {
          for (const row of rows) {
            joinedCommunityStore.set(row.communityId, row);
          }
        },
      ),
    },
    drafts: {
      get: jest.fn(async (key: string) => draftStore.get(key)),
      put: jest.fn(async (value: { key: string; value: unknown }) => {
        draftStore.set(value.key, value);
      }),
      delete: jest.fn(async (key: string) => {
        draftStore.delete(key);
      }),
    },
    pendingPosts: {
      get: jest.fn(async (clientId: string) => pendingPostsStore.get(clientId)),
      put: jest.fn(async (value: PendingPostEntry) => {
        pendingPostsStore.set(value.client_id, value);
      }),
      delete: jest.fn(async (clientId: string) => {
        pendingPostsStore.delete(clientId);
      }),
      toArray: jest.fn(async () => Array.from(pendingPostsStore.values())),
      where: jest.fn((field: string) => ({
        equals: (needle: unknown) => ({
          toArray: async () =>
            Array.from(pendingPostsStore.values()).filter((entry) => {
              const record = entry as unknown as Record<string, unknown>;
              return record[field] === needle;
            }),
        }),
      })),
    },
    transaction: async (
      _mode: string,
      _tables: unknown,
      fn: () => Promise<unknown>,
    ) => fn(),
  }),
}));

/**
 * SecureStore mock — the persistence layer calls into `expo-secure-store`
 * via `createSecureStoreAdapter` in `storage-adapters.ts`. We mock the
 * low-level module directly so the adapter's prefix / sanitisation
 * logic still runs (gives confidence the round-trip key shape is
 * correct) but no native module is touched.
 */
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => secureStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    secureStore.delete(key);
  }),
}));

/**
 * MMKV / SQLite are not referenced directly by this test (the `@/lib/db`
 * mock short-circuits them), but `storage-adapters.ts` imports them at
 * the top level so the modules must at least load. We stub out the
 * constructors so the import doesn't crash the jest runner.
 */
jest.mock('react-native-mmkv', () => ({
  MMKV: class MockMMKV {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts?: unknown) {}
    getString() {
      return undefined;
    }
    set() {}
    delete() {}
    getAllKeys() {
      return [] as string[];
    }
  },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => ({
    runAsync: jest.fn(async () => undefined),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    execAsync: jest.fn(async () => undefined),
    withTransactionAsync: jest.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  })),
}));

import {
  applyCommunitySyncDeltaToCache,
  enqueuePendingPost,
  filterVisibleAnnouncements,
  filterVisiblePostsForScope,
  listPendingPosts,
  loadCachedAnnouncements,
  loadCachedPosts,
  loadP2PEventCursor,
  loadP2PKeyMaterial,
  loadP2PPrivateKey,
  loadP2PSyncState,
  loadSession,
  markPendingPostAttempt,
  removePendingPost,
  saveCachedAnnouncements,
  saveCachedPosts,
  saveP2PEventCursor,
  saveP2PKeyMaterial,
  saveP2PPrivateKey,
  saveP2PSyncState,
  saveSession,
} from '../persistence';

describe('mobile persistence helpers', () => {
  // Pin "now" to a date 3 days after the test fixtures so the 7-day
  // tombstone retention window is well within range.
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-16T00:00:00.000Z'));
  });

  afterEach(() => {
    postCacheStore.clear();
    announcementCacheStore.clear();
    p2pKeyStore.clear();
    p2pSyncStateStore.clear();
    p2pEventCursorStore.clear();
    kvStore.clear();
    joinedCommunityStore.clear();
    draftStore.clear();
    pendingPostsStore.clear();
    secureStore.clear();
    jest.useRealTimers();
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
      items: [
        expect.objectContaining({ announcement_id: 'ann_1', is_pinned: true }),
      ],
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

  it('keeps tombstone markers in cache after post.tombstoned', async () => {
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

  it('post.updated with older p2p_version does not resurrect a tombstoned post', async () => {
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
    expect(cached?.items).toEqual([
      expect.objectContaining({
        post_id: 'post_1',
        status: 'removed',
        p2p_version: 10,
      }),
    ]);
    expect(filterVisiblePostsForScope(cached?.items, 'community')).toEqual([]);
  });

  it('applies events in occurred_at order', async () => {
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

  /* ----------------------------------------------------------------- */
  /* Offline write outbox — pendingPosts table.                        */
  /* ----------------------------------------------------------------- */

  function buildPending(
    overrides: Partial<PendingPostEntry> = {},
  ): PendingPostEntry {
    return {
      client_id: 'pending-1',
      created_at: '2026-04-13T12:00:00.000Z',
      attempt_count: 0,
      last_attempt_at: null,
      last_error: null,
      last_failure_permanent: false,
      community_id: 'comm_1',
      payload: {
        communityId: 'comm_1',
        postType: 'request',
        category: 'food',
        title: 'Need groceries',
        body: 'Can someone bring a bag by tonight?',
        language: 'en',
        locationZip: '11735',
        privacy: 'community_only',
        expiresAt: '2026-04-20T12:00:00.000Z',
      },
      ...overrides,
    };
  }

  it('enqueuePendingPost + listPendingPosts round-trip a queued publish', async () => {
    await enqueuePendingPost(buildPending({ client_id: 'pending-a' }));
    await enqueuePendingPost(
      buildPending({
        client_id: 'pending-b',
        created_at: '2026-04-13T12:05:00.000Z',
        payload: {
          ...buildPending().payload,
          title: 'Ride to clinic',
        },
      }),
    );

    const entries = await listPendingPosts();
    expect(entries.map((entry) => entry.client_id)).toEqual([
      'pending-a',
      'pending-b',
    ]);
  });

  it('listPendingPosts scoped by community returns only that scope', async () => {
    await enqueuePendingPost(
      buildPending({ client_id: 'pending-a', community_id: 'comm_1' }),
    );
    await enqueuePendingPost(
      buildPending({ client_id: 'pending-b', community_id: 'comm_2' }),
    );

    const scoped = await listPendingPosts('comm_1');
    expect(scoped).toHaveLength(1);
    expect(scoped[0]?.client_id).toBe('pending-a');
  });

  it('markPendingPostAttempt increments count and stamps error + permanent flag', async () => {
    await enqueuePendingPost(buildPending({ client_id: 'pending-x' }));

    await markPendingPostAttempt('pending-x', 'network down');
    let entries = await listPendingPosts();
    expect(entries[0]).toMatchObject({
      attempt_count: 1,
      last_error: 'network down',
      last_failure_permanent: false,
    });
    expect(entries[0]?.last_attempt_at).not.toBeNull();

    await markPendingPostAttempt('pending-x', 'HTTP 400 bad request', {
      permanent: true,
    });
    entries = await listPendingPosts();
    expect(entries[0]).toMatchObject({
      attempt_count: 2,
      last_error: 'HTTP 400 bad request',
      last_failure_permanent: true,
    });
  });

  it('markPendingPostAttempt on a missing client_id is a silent no-op', async () => {
    await expect(
      markPendingPostAttempt('does-not-exist', 'ignored'),
    ).resolves.toBeUndefined();
    expect(await listPendingPosts()).toEqual([]);
  });

  it('removePendingPost drops the row', async () => {
    await enqueuePendingPost(buildPending({ client_id: 'pending-z' }));
    expect(await listPendingPosts()).toHaveLength(1);

    await removePendingPost('pending-z');
    expect(await listPendingPosts()).toEqual([]);
  });

  /* ----------------------------------------------------------------- */
  /* Session access_token hygiene + SecureStore refresh_token.         */
  /* ----------------------------------------------------------------- */

  it('saveSession writes refresh_token to SecureStore and strips access_token from MMKV', async () => {
    await saveSession({
      access_token: 'at_this_must_never_be_written',
      refresh_token: 'rt_abcdef',
      user: { user_id: 'user_1', level: 'verified' },
      issued_via: 'otp',
      fallback: false,
    });

    // Metadata row in the MMKV-backed kv table — must NOT carry access_token.
    const storedEntry = kvStore.get('auth-session') as
      | { value: Record<string, unknown> }
      | undefined;
    expect(storedEntry).toBeDefined();
    expect(storedEntry?.value).not.toHaveProperty('access_token');
    // The refresh_token must NOT be stored in the MMKV metadata row —
    // it lives in the Keychain.
    expect(storedEntry?.value).not.toHaveProperty('refresh_token');
    expect(storedEntry?.value).toMatchObject({
      user: { user_id: 'user_1', level: 'verified' },
      issued_via: 'otp',
    });

    // SecureStore must carry the refresh_token under the prefixed key.
    // The adapter sanitizes `wvnc_refresh_primary` → alphanum / dot /
    // dash / underscore only.
    const keychainKeys = Array.from(secureStore.keys());
    expect(keychainKeys).toContain('wvnc_refresh_primary');
    expect(secureStore.get('wvnc_refresh_primary')).toBe('rt_abcdef');

    // loadSession pulls the refresh_token from the Keychain and the
    // user shape from MMKV, returning neither access_token.
    const loaded = await loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded).not.toHaveProperty('access_token');
    expect(loaded?.refresh_token).toBe('rt_abcdef');
    expect(loaded?.user.user_id).toBe('user_1');
  });

  it('loadSession strips access_token from legacy rows that still carry it', async () => {
    // Simulate a pre-split MMKV row (shouldn't normally exist in
    // M6 since this is a fresh install, but a future revert / regression
    // could put us here). The loader must drop the legacy access_token.
    kvStore.set('auth-session', {
      key: 'auth-session',
      value: {
        access_token: 'at_legacy_row',
        refresh_token: 'rt_legacy',
        user: { user_id: 'user_legacy', level: 'anonymous' },
      },
    });

    const loaded = await loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded).not.toHaveProperty('access_token');
    // With no Keychain entry set, the loader falls back to the legacy
    // refresh_token in the MMKV row.
    expect(loaded?.refresh_token).toBe('rt_legacy');
  });

  it('saveSession(null) deletes both MMKV metadata and the Keychain token', async () => {
    await saveSession({
      access_token: 'at',
      refresh_token: 'rt_will_be_deleted',
      user: { user_id: 'u', level: 'anonymous' },
    });
    expect(kvStore.has('auth-session')).toBe(true);
    expect(secureStore.has('wvnc_refresh_primary')).toBe(true);

    await saveSession(null);
    expect(kvStore.has('auth-session')).toBe(false);
    expect(secureStore.has('wvnc_refresh_primary')).toBe(false);
  });

  it('loadSession returns null when neither Keychain nor MMKV has a refresh_token', async () => {
    kvStore.set('auth-session', {
      key: 'auth-session',
      value: {
        user: { user_id: 'u', level: 'anonymous' },
      },
    });
    // SecureStore intentionally empty.
    const loaded = await loadSession();
    expect(loaded).toBeNull();
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

  /* ----------------------------------------------------------------- */
  /* P2P private-key SecureStore wrappers.                             */
  /* ----------------------------------------------------------------- */

  it('saveP2PPrivateKey / loadP2PPrivateKey round-trip via SecureStore', async () => {
    await saveP2PPrivateKey('comm_1', 'base64-private-key-bytes');
    await expect(loadP2PPrivateKey('comm_1')).resolves.toBe(
      'base64-private-key-bytes',
    );

    // Namespaced so two communities don't clobber each other's secrets.
    await saveP2PPrivateKey('comm_2', 'another-secret');
    await expect(loadP2PPrivateKey('comm_1')).resolves.toBe(
      'base64-private-key-bytes',
    );
    await expect(loadP2PPrivateKey('comm_2')).resolves.toBe('another-secret');
  });
});
