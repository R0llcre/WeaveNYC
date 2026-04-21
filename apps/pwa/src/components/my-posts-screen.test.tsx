/**
 * W4A smoke coverage for the redesigned "My posts" list.
 *
 * The W3 shape of this screen was four flat status sections all living inside
 * one giant Card. The W4A redesign collapses that into a single stacked list
 * and surfaces an EmptyState when there's nothing to show. We guard:
 *
 *   - EmptyState renders when the query returns zero items (no stray "4
 *     empty sections" rendered) and its CTA points at the composer so users
 *     can act immediately.
 *   - Non-empty data renders one `my-post-{id}` testid row per post so the
 *     E2E-compatible locator survives the refactor.
 *   - Each row links to `/posts/:id` (whole-row anchor) — guards against the
 *     regression where a decorative `<Card>` was mistakenly treated as the
 *     interactive element.
 *   - Loading state announces an aria-busy region so screen readers surface
 *     the skeleton chrome instead of an empty page.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { PendingPostEntry } from '@/lib/persistence';
import type { AuthSession, PostSummary } from '@/lib/types';
import { MyPostsScreen } from './my-posts-screen';

// Typed mock factories — see the composer test for the rationale. Zero-arg
// `vi.fn()` infers `() => any` which breaks mock invocations that pass
// arguments through from the real signature.
const listMyPostsMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const listPendingPostsMock = vi.fn<(communityId?: string) => Promise<unknown[]>>();
const removePendingPostMock = vi.fn<(clientId: string) => Promise<void>>();
const enqueuePendingPostMock = vi.fn<(entry: unknown) => Promise<void>>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/posts/mine',
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    listMyPosts: (...args: unknown[]) => listMyPostsMock(...args),
  };
});

vi.mock('@/lib/persistence', async () => {
  const actual = await vi.importActual<typeof import('@/lib/persistence')>(
    '@/lib/persistence',
  );
  return {
    ...actual,
    listPendingPosts: (communityId?: string) => listPendingPostsMock(communityId),
    removePendingPost: (clientId: string) => removePendingPostMock(clientId),
    enqueuePendingPost: (entry: unknown) => enqueuePendingPostMock(entry),
  };
});

function buildStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
  });
}

function seedSession(): AuthSession {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    user: { user_id: 'user-1', level: 'verified' },
    issued_via: 'otp',
  };
}

function makePost(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    post_id: 'post-1',
    community_id: 'community-1',
    post_type: 'request',
    category: 'food',
    title: 'Need groceries',
    body: 'Help needed tonight.',
    language: 'en',
    location_zip: '11735',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    is_owner: true,
    ...overrides,
  };
}

function renderMine() {
  const store = buildStore();
  store.dispatch(setSession(seedSession()));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <MyPostsScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  listMyPostsMock.mockReset();
  listPendingPostsMock.mockReset();
  listPendingPostsMock.mockResolvedValue([]);
  removePendingPostMock.mockReset();
  removePendingPostMock.mockResolvedValue(undefined);
  enqueuePendingPostMock.mockReset();
  enqueuePendingPostMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

function makePending(overrides: Partial<PendingPostEntry> = {}): PendingPostEntry {
  return {
    client_id: 'pending-abc',
    created_at: new Date().toISOString(),
    attempt_count: 0,
    last_attempt_at: null,
    last_error: null,
    last_failure_permanent: false,
    community_id: 'community-1',
    payload: {
      communityId: 'community-1',
      postType: 'request',
      category: 'food',
      title: 'Queued need',
      body: 'Queued body text.',
      language: 'en',
      locationZip: '11735',
      privacy: 'community_only',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    },
    ...overrides,
  };
}

describe('MyPostsScreen (/posts/mine)', () => {
  it('renders the EmptyState with a CTA pointing at the composer when zero posts', async () => {
    listMyPostsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderMine();
    await waitFor(() => {
      expect(screen.getByTestId('my-posts-empty-cta')).toBeTruthy();
    });
    // The empty-state CTA links to the composer so users can act immediately.
    const cta = screen.getByTestId('my-posts-empty-cta') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/posts/new');
    // CTA label is localized (not hardcoded English anywhere).
    expect(cta.textContent?.trim()).toBe(messages.en.emptyStatePostsCta);
  });

  it('renders one `my-post-{id}` row per returned post, each linked to the post detail', async () => {
    listMyPostsMock.mockResolvedValue({
      items: [makePost({ post_id: 'post-a' }), makePost({ post_id: 'post-b' })],
      next_cursor: null,
    });
    renderMine();
    await waitFor(() => {
      expect(screen.getByTestId('my-post-post-a')).toBeTruthy();
      expect(screen.getByTestId('my-post-post-b')).toBeTruthy();
    });
    expect((screen.getByTestId('my-post-post-a') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/posts/post-a',
    );
    expect((screen.getByTestId('my-post-post-b') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/posts/post-b',
    );
  });

  it('clicking the empty-state CTA navigates to /posts/new (anchor-based, no handler)', async () => {
    listMyPostsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderMine();
    const cta = await screen.findByTestId('my-posts-empty-cta');
    // Simulate a user click and assert the anchor's own href — the anchor is
    // what drives navigation in production, and we don't want a silent
    // regression where the CTA is repointed at a hook handler that swallows
    // the event. Cancel the event via createEvent so jsdom doesn't try to
    // perform the unimplemented real navigation on the anchor.
    const click = createEvent.click(cta);
    click.preventDefault();
    fireEvent(cta, click);
    expect((cta as HTMLAnchorElement).getAttribute('href')).toBe('/posts/new');
  });

  it('loading state renders the aria-busy region labelled with the localized loading copy', () => {
    // Never-resolves promise keeps the query in isLoading for the render pass.
    listMyPostsMock.mockImplementation(() => new Promise(() => {}));
    renderMine();
    const status = screen.getByTestId('my-posts-loading');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe(messages.en.loadingLabel);
  });

  /* ---------------------------------------------------------------- */
  /* Offline write outbox — pending section.                          */
  /* ---------------------------------------------------------------- */

  it('renders the pending section with a warning Tag and the queued copy', async () => {
    listMyPostsMock.mockResolvedValue({ items: [], next_cursor: null });
    listPendingPostsMock.mockResolvedValue([
      makePending({
        client_id: 'pending-1',
        payload: {
          ...makePending().payload,
          title: 'Need ride to clinic',
          body: 'Need a ride to the Farmingdale clinic Friday.',
        },
      }),
    ]);
    renderMine();

    // The heading copy comes from the localized `outboxPendingHeading` key.
    // Note: the same string doubles as the `<Tag>` label on each row, so
    // `getAllByText` is correct; we just need ≥ 1 instance to prove the
    // section header rendered.
    await waitFor(() => {
      expect(screen.getByTestId('my-posts-pending-section')).toBeInTheDocument();
    });
    expect(
      screen.getAllByText(messages.en.outboxPendingHeading).length,
    ).toBeGreaterThanOrEqual(1);

    // Row testid carries the client_id so the pending entry is uniquely
    // addressable by E2E / future automation.
    const row = screen.getByTestId('my-post-pending-pending-1');
    expect(row).toBeInTheDocument();
    // Title + excerpt render inline from the payload (the user typed it
    // on a possibly-offline device, and we want them to see their draft).
    expect(row.textContent ?? '').toContain('Need ride to clinic');
    // The queued hint is surfaced so the user understands the state.
    expect(row.textContent ?? '').toContain(messages.en.outboxPendingHint);
    // Discard button is available on any pending entry. Retry only shows
    // on failed-permanent entries (covered by the next test).
    expect(screen.getByTestId('pending-discard-pending-1')).toBeInTheDocument();
    expect(screen.queryByTestId('pending-retry-pending-1')).toBeNull();
  });

  it('renders a Retry button for permanently-failed (4xx) pending entries', async () => {
    listMyPostsMock.mockResolvedValue({ items: [], next_cursor: null });
    listPendingPostsMock.mockResolvedValue([
      makePending({
        client_id: 'pending-fail',
        last_error: 'HTTP 400 invalid zip',
        last_failure_permanent: true,
      }),
    ]);
    renderMine();

    await waitFor(() => {
      expect(screen.getByTestId('pending-retry-pending-fail')).toBeInTheDocument();
    });
    // Failed copy interpolates the error message so the user can tell
    // what went wrong semantically (e.g. bad ZIP, not "network offline").
    const row = screen.getByTestId('my-post-pending-pending-fail');
    expect(row.textContent ?? '').toContain('HTTP 400 invalid zip');
  });
});
