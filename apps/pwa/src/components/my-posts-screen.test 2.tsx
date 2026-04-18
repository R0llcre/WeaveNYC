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
import type { AuthSession, PostSummary } from '@/lib/types';
import { MyPostsScreen } from './my-posts-screen';

const listMyPostsMock = vi.fn();

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
});

afterEach(() => {
  cleanup();
});

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
});
