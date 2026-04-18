/**
 * W3B smoke coverage for the redesigned Community hub.
 *
 * The screen used to live as a single flat React tree with inline divs; the
 * new version relies on atoms (Stack, Inline, Card, EmptyState, TopBar) and
 * funnels the user through explicit "no membership" vs "in a community"
 * branches. These tests assert:
 *
 *   - Both branches expose the E2E-protected `join-community` testid so
 *     Playwright can reach the join flow regardless of membership state.
 *   - `create-session` stays reachable for anonymous visitors (preserves
 *     the community-posts.spec.ts bootstrap path).
 *   - The feed card tab pills (`community-tab`, `public-tab`) remain wired
 *     so the feed scope selector keeps working.
 *   - When the user IS in a community, the literal `Current community: {name}`
 *     string is rendered — that string is asserted verbatim in
 *     multi-community.spec.ts and community-posts.spec.ts.
 *
 * Business logic (P2P sync, usePosts, announcements) is covered at the
 * hook + E2E layers; this file only guards the rendering contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import {
  communityReducer,
  upsertJoinedCommunity,
  setCurrentCommunity,
} from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession } from '@/lib/types';
import { CommunityScreen } from './community-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The community-screen's imports reach into several listing / sync hooks.
// Stub the ones that hit the network so jsdom stays quiet.
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createAnonymousSession: vi.fn(),
    listPosts: vi.fn(async () => ({ items: [], next_cursor: null })),
    listCommunityAnnouncements: vi.fn(async () => ({ items: [], next_cursor: null })),
    listContactRequestsInbox: vi.fn(async () => ({ items: [], next_cursor: null })),
  };
});

// The P2P worker client pokes Worker / IndexedDB at import time; stub the
// whole module so the test never needs a real browser P2P stack.
vi.mock('@/lib/p2p-worker-client', () => ({
  createBrowserP2PWorkerClient: () => null,
}));

// Persistence uses IndexedDB via Dexie; stub the module so jsdom stays quiet.
vi.mock('@/lib/persistence', () => ({
  loadCachedPosts: vi.fn(async () => null),
  saveCachedPosts: vi.fn(async () => undefined),
  loadCachedAnnouncements: vi.fn(async () => null),
  saveCachedAnnouncements: vi.fn(async () => undefined),
  loadP2PSyncState: vi.fn(async () => null),
  loadP2PKeyMaterial: vi.fn(async () => null),
  loadP2PEventCursor: vi.fn(async () => null),
  saveP2PSyncState: vi.fn(async () => undefined),
  saveP2PKeyMaterial: vi.fn(async () => undefined),
  saveP2PEventCursor: vi.fn(async () => undefined),
  applyCommunitySyncDeltaToCache: vi.fn(async () => undefined),
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
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '550e8400-e29b-41d4-a716-446655440011',
      level: 'anonymous',
    },
    issued_via: 'anonymous',
  };
}

function renderCommunity(
  options: { withSession?: boolean; withMembership?: boolean } = {},
) {
  const { withSession = false, withMembership = false } = options;
  const store = buildStore();
  if (withSession) {
    store.dispatch(setSession(seedSession()));
  }
  if (withMembership) {
    store.dispatch(
      upsertJoinedCommunity({
        community: {
          community_id: 'community-11373',
          name: 'Elmhurst Mutual Aid',
          center_zip: '11373',
          join_policy: 'invite_only',
        },
        joinedAt: new Date().toISOString(),
      }),
    );
    store.dispatch(setCurrentCommunity('community-11373'));
  }
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <CommunityScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('CommunityScreen (/community)', () => {
  it('exposes `create-session` for anonymous visitors', () => {
    renderCommunity();
    const cta = screen.getByTestId('create-session');
    expect(cta).toBeTruthy();
  });

  it('exposes `join-community` when the user has no membership', () => {
    renderCommunity({ withSession: true });
    const join = screen.getByTestId('join-community');
    expect(join).toBeTruthy();
    // The CTA lives on the empty-state card when there is no membership.
    expect((join as HTMLAnchorElement).getAttribute('href')).toBe('/community/join');
  });

  it('keeps the feed tab pills (`community-tab`, `public-tab`) wired', () => {
    renderCommunity({ withSession: true });
    expect(screen.getByTestId('community-tab')).toBeTruthy();
    expect(screen.getByTestId('public-tab')).toBeTruthy();
  });

  it('clicking the public tab switches the scope to public posts (M3)', async () => {
    // `usePosts` fires `listPosts` with the scope the user picked. We assert
    // the mock was called with `scope: 'public'` after the click so the
    // hook wiring is pinned — the previous test only checked the pills
    // existed, which would not regress if the click handler stopped
    // flipping state.
    const { listPosts } = await import('@/lib/api');
    (listPosts as unknown as { mockClear?: () => void }).mockClear?.();

    renderCommunity({ withSession: true, withMembership: true });

    const publicTab = screen.getByTestId('public-tab');
    publicTab.click();

    await waitFor(() => {
      const calls = (listPosts as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      // `listPosts(accessToken, { scope, communityId, limit })`.
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeTruthy();
      const options = lastCall?.[1] as { scope?: string } | undefined;
      expect(options?.scope).toBe('public');
    });
  });

  it('renders `Current community: {name}` once the user has joined', () => {
    renderCommunity({ withSession: true, withMembership: true });
    // Multiple matches are acceptable — the E2E regex just matches any
    // occurrence of the literal string. The hero h2 + the feed subtitle
    // both intentionally carry this copy for screen-reader redundancy.
    const hits = screen.getAllByText('Current community: Elmhurst Mutual Aid');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    // `join-community` is still reachable while in a community (top-level
    // switch-community affordance).
    expect(screen.getByTestId('join-community')).toBeTruthy();
  });
});
