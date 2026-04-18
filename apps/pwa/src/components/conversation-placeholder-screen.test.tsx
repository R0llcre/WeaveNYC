/**
 * W4-R2 smoke coverage for the Wave 4B Conversation placeholder screen.
 *
 * The placeholder renders on routes like `/conversations/:id` when the
 * thread hasn't resolved yet (desktop split view, deep link, etc.). We guard
 * the Wave 4B contract:
 *
 *   - The root wrapper exposes `inbox-placeholder` so E2E can locate the
 *     split-view placeholder without relying on visible copy.
 *   - While the placeholder query is loading, a Skeleton with `aria-busy`
 *     renders.
 *   - Once the placeholder resolves with no data, the EmptyState renders
 *     with its CTA back to `/inbox`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import type { AuthSession, ConversationDetail } from '@/lib/types';
import { ConversationPlaceholderScreen } from './conversation-placeholder-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/conversations/placeholder-1',
}));

const getConversationMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getConversation: (...args: unknown[]) => getConversationMock(...args),
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

function seedVerifiedSession(): AuthSession {
  return {
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '550e8400-e29b-41d4-a716-446655440055',
      level: 'verified',
    },
    issued_via: 'otp',
  };
}

function makeConversationDetail(
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
  return {
    conversation_id: 'placeholder-1',
    contact_request_id: 'req-1',
    related_post_ids: [],
    participant_preview: [],
    status: 'active',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    last_activity_at: new Date(Date.now() - 60_000).toISOString(),
    last_message_preview: null,
    unread_count: 0,
    other_user_id: '550e8400-e29b-41d4-a716-446655440077',
    actions: {
      can_send: true,
      can_close: true,
      can_block: true,
      can_report: true,
    },
    ...overrides,
  };
}

function renderPlaceholder() {
  const store = buildStore();
  store.dispatch(setSession(seedVerifiedSession()));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <ConversationPlaceholderScreen conversationId="placeholder-1" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  getConversationMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ConversationPlaceholderScreen (/conversations/:id placeholder)', () => {
  it('exposes the `inbox-placeholder` testid on the root wrapper', async () => {
    getConversationMock.mockResolvedValue(makeConversationDetail());
    renderPlaceholder();
    // Root wrapper testid should always be present — it doesn't depend on
    // the placeholder query resolving.
    expect(screen.getByTestId('inbox-placeholder')).toBeTruthy();
  });

  it('renders the Skeleton (aria-busy) while the query is in flight', () => {
    // Never-resolving promise so the query stays in the loading state.
    getConversationMock.mockReturnValue(new Promise(() => {}));
    renderPlaceholder();
    const busy = document.querySelector('[aria-busy="true"]');
    expect(busy).not.toBeNull();
  });

  it('renders the EmptyState with an /inbox CTA when the query resolves', async () => {
    getConversationMock.mockResolvedValue(makeConversationDetail());
    renderPlaceholder();
    await waitFor(() => {
      expect(screen.getByText(messages.en.emptyStateInboxTitle)).toBeTruthy();
    });
    const cta = screen.getByRole('link', { name: messages.en.inboxOpenThread });
    expect(cta.getAttribute('href')).toBe('/inbox');
  });
});
