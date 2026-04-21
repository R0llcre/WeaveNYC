/**
 * useOutboxDrain — coverage for the offline-publish retry loop.
 *
 * The hook mounts inside `ShellFrame` and drains queued post publishes on
 * (a) initial mount, (b) `window.online` events, (c) document visibility
 * returning to `visible`. Each successful entry is removed from IDB and
 * invalidates the post caches; 4xx failures are marked permanent so we
 * don't hammer the server; 5xx/network failures bump the attempt counter
 * and stop the pass (exponential backoff via next trigger).
 *
 * These tests stub `createPost`, the persistence layer, and Redux/react-
 * query providers so the hook runs in isolation. They specifically pin
 * the behaviour promised by `docs/offline-outbox.md`:
 *
 *   1. `online` event triggers a drain (queued entry is sent + removed)
 *   2. 4xx failure marks the entry permanent (no auto-retry loop)
 *   3. Network error bumps attempt_count and leaves the entry in place
 *   4. Permanent-marked entries are skipped on the next pass
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { PendingPostEntry } from '@/lib/persistence';
import type { AuthSession } from '@/lib/types';

// --- API layer: only `createPost` is exercised by the drain. -----------
// Typed signatures on every mock so TS sees the real call shape.
const createPostMock =
  vi.fn<(accessToken: string, input: unknown) => Promise<{ post_id: string }>>();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createPost: (accessToken: string, input: unknown) => createPostMock(accessToken, input),
  };
});

// --- Persistence layer: in-memory stand-in for the pendingPosts table. -
const pendingStore = new Map<string, PendingPostEntry>();
const listPendingPostsMock = vi.fn<
  (communityId?: string) => Promise<PendingPostEntry[]>
>(async () => Array.from(pendingStore.values()));
const markPendingPostAttemptMock = vi.fn<
  (
    clientId: string,
    error: string | null,
    options?: { permanent?: boolean },
  ) => Promise<void>
>(async (clientId, error, options = {}) => {
  const existing = pendingStore.get(clientId);
  if (!existing) return;
  pendingStore.set(clientId, {
    ...existing,
    attempt_count: existing.attempt_count + 1,
    last_attempt_at: new Date().toISOString(),
    last_error: error,
    last_failure_permanent: options.permanent === true,
  });
});
const removePendingPostMock = vi.fn<(clientId: string) => Promise<void>>(
  async (clientId) => {
    pendingStore.delete(clientId);
  },
);

vi.mock('@/lib/persistence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/persistence')>(
    '@/lib/persistence',
  );
  return {
    ...actual,
    listPendingPosts: (communityId?: string) => listPendingPostsMock(communityId),
    markPendingPostAttempt: (
      clientId: string,
      error: string | null,
      options: { permanent?: boolean } = {},
    ) => markPendingPostAttemptMock(clientId, error, options),
    removePendingPost: (clientId: string) => removePendingPostMock(clientId),
  };
});

// Late-imported AFTER the mocks register so the hook reads the mocked
// persistence helpers rather than the real ones.
async function loadHook() {
  const mod = await import('./hooks');
  return mod.useOutboxDrain;
}

function buildStore() {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
  });
  const session: AuthSession = {
    access_token: 'token-abc',
    refresh_token: 'refresh',
    user: { user_id: 'user-1', level: 'verified' },
    issued_via: 'otp',
  };
  store.dispatch(setSession(session));
  return store;
}

function buildPending(overrides: Partial<PendingPostEntry> = {}): PendingPostEntry {
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
      body: 'Body',
      language: 'en',
      locationZip: '11735',
      privacy: 'community_only',
      expiresAt: '2026-04-20T12:00:00.000Z',
    },
    ...overrides,
  };
}

function HookHarness({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

async function renderHarness() {
  const store = buildStore();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const useOutboxDrain = await loadHook();
  function Wrapper() {
    useOutboxDrain();
    return <p data-testid="hook-mounted">ok</p>;
  }
  return {
    view: render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <HookHarness>
            <Wrapper />
          </HookHarness>
        </QueryClientProvider>
      </Provider>,
    ),
  };
}

beforeEach(() => {
  pendingStore.clear();
  createPostMock.mockReset();
  listPendingPostsMock.mockClear();
  markPendingPostAttemptMock.mockClear();
  removePendingPostMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('useOutboxDrain', () => {
  it('runs on mount: successful publish removes the pending entry', async () => {
    pendingStore.set('pending-1', buildPending({ client_id: 'pending-1' }));
    createPostMock.mockResolvedValue({ post_id: 'post-new' });

    await renderHarness();

    // Wait for the async drain to drop the entry.
    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledTimes(1);
      expect(removePendingPostMock).toHaveBeenCalledWith('pending-1');
    });
    expect(pendingStore.has('pending-1')).toBe(false);
  });

  it('triggers a drain on `window.online`', async () => {
    pendingStore.clear();
    createPostMock.mockResolvedValue({ post_id: 'post-new' });

    await renderHarness();

    // Wait for the initial mount pass (zero entries → no createPost call).
    await waitFor(() => {
      expect(listPendingPostsMock).toHaveBeenCalled();
    });
    const initialListCalls = listPendingPostsMock.mock.calls.length;

    // Queue an entry AFTER mount. Initial mount drain already ran with
    // an empty queue, so this entry is picked up only when `online` fires.
    pendingStore.set('pending-2', buildPending({ client_id: 'pending-2' }));
    window.dispatchEvent(new Event('online'));

    await waitFor(() => {
      expect(createPostMock).toHaveBeenCalledTimes(1);
      expect(removePendingPostMock).toHaveBeenCalledWith('pending-2');
      expect(listPendingPostsMock.mock.calls.length).toBeGreaterThan(initialListCalls);
    });
  });

  it('marks a 4xx response as a permanent failure (no auto-retry)', async () => {
    pendingStore.set('pending-bad', buildPending({ client_id: 'pending-bad' }));
    createPostMock.mockRejectedValue(
      new Error('/v1/posts failed: HTTP 400 zip_code_invalid'),
    );

    await renderHarness();

    await waitFor(() => {
      expect(markPendingPostAttemptMock).toHaveBeenCalled();
    });
    // The entry stays in IDB (we don't remove failed-permanent entries;
    // the user surfaces them via the pending-posts UI and retries
    // explicitly). The mark call carries permanent=true.
    expect(removePendingPostMock).not.toHaveBeenCalled();
    const [clientId, error, options] = markPendingPostAttemptMock.mock.calls[0]!;
    expect(clientId).toBe('pending-bad');
    expect(typeof error).toBe('string');
    expect(options?.permanent).toBe(true);
  });

  it('leaves the entry in place on a transient network error (no permanent flag)', async () => {
    pendingStore.set('pending-net', buildPending({ client_id: 'pending-net' }));
    createPostMock.mockRejectedValue(new Error('TypeError: Failed to fetch'));

    await renderHarness();

    await waitFor(() => {
      expect(markPendingPostAttemptMock).toHaveBeenCalled();
    });
    expect(removePendingPostMock).not.toHaveBeenCalled();
    const [, , options] = markPendingPostAttemptMock.mock.calls[0]!;
    // No HTTP status parses from this error → we default to transient.
    expect(options?.permanent).toBe(false);
  });

  it('skips entries flagged last_failure_permanent on subsequent passes', async () => {
    pendingStore.set(
      'pending-done',
      buildPending({
        client_id: 'pending-done',
        last_failure_permanent: true,
        last_error: 'HTTP 400',
      }),
    );
    createPostMock.mockResolvedValue({ post_id: 'would-not-happen' });

    await renderHarness();

    // Let the mount pass settle. A permanent entry is listed but NOT
    // attempted, so createPost is never called.
    await waitFor(() => {
      expect(listPendingPostsMock).toHaveBeenCalled();
    });
    expect(createPostMock).not.toHaveBeenCalled();
    // And we don't touch markPendingPostAttempt on a skip — the entry is
    // preserved verbatim for the user to decide retry vs discard.
    expect(markPendingPostAttemptMock).not.toHaveBeenCalled();
  });
});
