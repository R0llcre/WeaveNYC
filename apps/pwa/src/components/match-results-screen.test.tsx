/**
 * W4A smoke coverage for the redesigned Match Results page.
 *
 * Guards:
 *   - Owner view exposes the `match-refresh` IconButton testid — the E2E
 *     for anonymous-contact → verify → auto-contact and the refresh budget
 *     rely on that hook.
 *   - Non-owner / non-active requests render the explanatory gating copy
 *     (owner-only or needs-active-request) instead of the match list.
 *   - Empty responses render the `matches-empty` illustration EmptyState.
 *   - Refresh budget math: the refresh IconButton becomes disabled once
 *     `refreshes_used >= max_refreshes` and the `match-no-more-refreshes`
 *     hint appears. Previously this behaviour was only covered at E2E.
 *   - Loading state announces `role=status aria-busy=true` with the
 *     localized loading label.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession, MatchResultsResponse, PostDetail } from '@/lib/types';
import { MatchResultsScreen } from './match-results-screen';

const getPostMock = vi.fn();
const getMatchSuggestionsMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/posts/post-1/matches',
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getPost: (...args: unknown[]) => getPostMock(...args),
    getMatchSuggestions: (...args: unknown[]) => getMatchSuggestionsMock(...args),
  };
});

vi.mock('@/lib/match-intent', () => ({
  loadMatchContactIntent: () => null,
  saveMatchContactIntent: vi.fn(),
  clearMatchContactIntent: vi.fn(),
}));

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

function makeOwnerActiveRequest(): PostDetail {
  return {
    post_id: 'post-1',
    community_id: 'community-1',
    post_type: 'request',
    category: 'food',
    title: 'Need groceries',
    body: 'Help me tonight.',
    language: 'en',
    location_zip: '11735',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    is_owner: true,
    contact_pref: null,
    actions: { can_edit: true, can_close: true, can_delete: true, can_review: false },
  };
}

function makeEmptyMatches(
  overrides: Partial<MatchResultsResponse> = {},
): MatchResultsResponse {
  return {
    post_id: 'post-1',
    batch_number: 1,
    advanced: false,
    refreshes_used: 0,
    max_refreshes: 1,
    items: [],
    ...overrides,
  };
}

function renderMatches() {
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
          <MatchResultsScreen postId="post-1" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  getPostMock.mockReset();
  getMatchSuggestionsMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('MatchResultsScreen (/posts/:id/matches)', () => {
  it('exposes the `match-refresh` IconButton for the owner of an active request', async () => {
    getPostMock.mockResolvedValue(makeOwnerActiveRequest());
    getMatchSuggestionsMock.mockResolvedValue(makeEmptyMatches());
    renderMatches();
    await waitFor(() => {
      expect(screen.getByTestId('match-refresh')).toBeTruthy();
    });
  });

  it('renders the `matches-empty` EmptyState when the owner has zero matches', async () => {
    getPostMock.mockResolvedValue(makeOwnerActiveRequest());
    getMatchSuggestionsMock.mockResolvedValue(makeEmptyMatches());
    renderMatches();
    await waitFor(() => {
      expect(screen.getByText(messages.en.emptyStateMatchesTitle)).toBeTruthy();
    });
    // The EmptyState renders the `matches-empty` SVG illustration from the
    // registry — guard its `data-illustration` hook so the atom contract
    // stays wired up.
    const illustration = document.querySelector('[data-illustration="matches-empty"]');
    expect(illustration).not.toBeNull();
  });

  it('renders the owner-only gating copy when the viewer is not the owner', async () => {
    getPostMock.mockResolvedValue({
      ...makeOwnerActiveRequest(),
      is_owner: false,
    });
    getMatchSuggestionsMock.mockResolvedValue(makeEmptyMatches());
    renderMatches();
    await waitFor(() => {
      expect(screen.getByText(messages.en.matchOwnerOnly)).toBeTruthy();
    });
    // And the refresh affordance must NOT render for non-owners.
    expect(screen.queryByTestId('match-refresh')).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* Refresh budget                                                      */
  /* ------------------------------------------------------------------ */

  it('disables the refresh button and shows the no-more-refreshes hint when budget is spent', async () => {
    getPostMock.mockResolvedValue(makeOwnerActiveRequest());
    getMatchSuggestionsMock.mockResolvedValue(
      makeEmptyMatches({ refreshes_used: 1, max_refreshes: 1 }),
    );
    renderMatches();
    await waitFor(() => {
      expect(screen.getByTestId('match-no-more-refreshes')).toBeTruthy();
    });
    const refresh = screen.getByTestId('match-refresh') as HTMLButtonElement;
    // IconButton renders as a <button disabled> when `disabled` prop is true.
    expect(refresh.disabled).toBe(true);
  });

  it('leaves the refresh button enabled while the budget has headroom', async () => {
    getPostMock.mockResolvedValue(makeOwnerActiveRequest());
    getMatchSuggestionsMock.mockResolvedValue(
      makeEmptyMatches({ refreshes_used: 0, max_refreshes: 2 }),
    );
    renderMatches();
    await waitFor(() => {
      expect(screen.getByTestId('match-refresh')).toBeTruthy();
    });
    const refresh = screen.getByTestId('match-refresh') as HTMLButtonElement;
    expect(refresh.disabled).toBe(false);
    expect(screen.queryByTestId('match-no-more-refreshes')).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* Loading aria-busy wrapper                                           */
  /* ------------------------------------------------------------------ */

  it('loading state is announced as role=status aria-busy with the localized label', async () => {
    getPostMock.mockResolvedValue(makeOwnerActiveRequest());
    // Match suggestions query never resolves — stays in isLoading.
    getMatchSuggestionsMock.mockImplementation(() => new Promise(() => {}));
    renderMatches();
    const status = await screen.findByTestId('match-results-loading');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe(messages.en.loadingLabel);
  });
});
