/**
 * W4-R2 smoke coverage for the Wave 4B Inbox screen.
 *
 * Guards the blockers flagged by review + the new testid contract the E2E
 * suite (tests/e2e/matching-inbox.spec.ts) and future AT locators depend on:
 *
 *   - When the user has no session, the "error" illustration auth gate
 *     renders (not the "inbox-empty" success illustration).
 *   - When conversations load, one `inbox-conversation-{id}` data-testid is
 *     emitted per row, with the whole row wrapped in an anchor whose
 *     `href` drills into `/conversations/{id}` (whole-card tap target fix).
 *   - When pending requests load, one `inbox-request-{id}` data-testid is
 *     emitted per row, so reject/accept targeting is stable in E2E.
 *   - When the chat WebSocket is disconnected, the offline Banner surfaces.
 *   - Clicking a conversation row calls `router.push` with the thread URL
 *     so the anchor behaves as a single-tap drill-in (Blocker B2).
 *
 * Business logic (WebSocket reconnect backoff, accept mutation → router
 * redirect) is covered at the hook + E2E layers; this file only pins the
 * rendering + locator contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type {
  AuthSession,
  ContactRequestInboxItem,
  ConversationSummary,
} from '@/lib/types';
import { ChatInboxScreen } from './chat-inbox-screen';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/inbox',
}));

// Stub the WebSocket hook so jsdom never tries to open a real socket. The
// tests drive the exposed `onStateChange` callback directly when we need to
// simulate offline.
let lastSocketOptions: { onStateChange?: (state: string) => void } | undefined;
vi.mock('@/lib/use-chat-websocket', () => ({
  useChatWebSocket: (
    _token: unknown,
    _onMessage: unknown,
    options: { onStateChange?: (state: string) => void },
  ) => {
    lastSocketOptions = options;
  },
}));

// Stub the network layer — the hook still runs through React Query, but the
// queryFn resolves with whatever we seed per test.
const listContactRequestsInboxMock = vi.fn();
const listConversationsMock = vi.fn();
const acceptContactRequestMock = vi.fn();
const rejectContactRequestMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    listContactRequestsInbox: (...args: unknown[]) =>
      listContactRequestsInboxMock(...args),
    listConversations: (...args: unknown[]) => listConversationsMock(...args),
    acceptContactRequest: (...args: unknown[]) => acceptContactRequestMock(...args),
    rejectContactRequest: (...args: unknown[]) => rejectContactRequestMock(...args),
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

function makeRequest(overrides: Partial<ContactRequestInboxItem> = {}): ContactRequestInboxItem {
  return {
    contact_request_id: 'req-1',
    from_post_id: 'post-a',
    to_post_id: 'post-b',
    requester_user_id: '550e8400-e29b-41d4-a716-446655440077',
    requester_alias: 'Neighbor',
    status: 'pending',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    from_post_title: 'Need help tonight',
    to_post_title: 'Can share food',
    from_post_category: 'food',
    to_post_category: 'food',
    ...overrides,
  };
}

function makeConversation(
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    conversation_id: 'conv-1',
    contact_request_id: 'req-1',
    related_post_ids: ['post-a'],
    participant_preview: [
      {
        user_id: '550e8400-e29b-41d4-a716-446655440077',
        alias: 'Neighbor',
      },
      {
        user_id: '550e8400-e29b-41d4-a716-446655440055',
        alias: 'You',
      },
    ],
    status: 'active',
    created_at: new Date(Date.now() - 3_600_000).toISOString(),
    last_activity_at: new Date(Date.now() - 60_000).toISOString(),
    last_message_preview: 'Thanks, see you at 6.',
    unread_count: 2,
    ...overrides,
  };
}

function renderInbox({
  withSession = true,
}: { withSession?: boolean } = {}) {
  const store = buildStore();
  if (withSession) store.dispatch(setSession(seedVerifiedSession()));
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
          <ChatInboxScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  pushMock.mockReset();
  listContactRequestsInboxMock.mockReset();
  listConversationsMock.mockReset();
  acceptContactRequestMock.mockReset();
  rejectContactRequestMock.mockReset();
  lastSocketOptions = undefined;
});

afterEach(() => {
  cleanup();
});

describe('ChatInboxScreen (/inbox)', () => {
  it('renders an "error" illustration auth gate when there is no session', () => {
    listContactRequestsInboxMock.mockResolvedValue({ items: [], next_cursor: null });
    listConversationsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderInbox({ withSession: false });
    // The TopBar still shows the inbox title so the user never loses their
    // bearings on the auth gate.
    expect(screen.getAllByText(messages.en.inboxTitle).length).toBeGreaterThanOrEqual(1);
    // The empty-state illustration swapped from "inbox-empty" to "error" so
    // screen readers and sighted users both see a blocker, not a zero-data
    // success.
    const illustration = document.querySelector('.empty-state__illustration');
    expect(illustration?.getAttribute('data-illustration')).toBe('error');
  });

  it('emits `inbox-request-{id}` testids for each pending request row', async () => {
    listContactRequestsInboxMock.mockResolvedValue({
      items: [makeRequest({ contact_request_id: 'req-alpha' }), makeRequest({ contact_request_id: 'req-beta' })],
      next_cursor: null,
    });
    listConversationsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByTestId('inbox-request-req-alpha')).toBeTruthy();
      expect(screen.getByTestId('inbox-request-req-beta')).toBeTruthy();
    });
  });

  it('emits `inbox-conversation-{id}` testids for each conversation row', async () => {
    listContactRequestsInboxMock.mockResolvedValue({ items: [], next_cursor: null });
    listConversationsMock.mockResolvedValue({
      items: [
        makeConversation({ conversation_id: 'conv-A' }),
        makeConversation({ conversation_id: 'conv-B', related_post_ids: [] }),
      ],
      next_cursor: null,
    });
    renderInbox();
    await waitFor(() => {
      expect(screen.getByTestId('inbox-conversation-conv-A')).toBeTruthy();
      expect(screen.getByTestId('inbox-conversation-conv-B')).toBeTruthy();
    });
    // Whole-row tap target: the testid lives on an anchor whose href drills
    // into the thread (Blocker B2).
    const row = screen.getByTestId('inbox-conversation-conv-A') as HTMLAnchorElement;
    expect(row.tagName).toBe('A');
    expect(row.getAttribute('href')).toBe('/conversations/conv-A');
  });

  it('routes to the thread via router.push on whole-row click (B2)', async () => {
    listContactRequestsInboxMock.mockResolvedValue({ items: [], next_cursor: null });
    listConversationsMock.mockResolvedValue({
      items: [makeConversation({ conversation_id: 'conv-zulu' })],
      next_cursor: null,
    });
    renderInbox();
    const row = await screen.findByTestId('inbox-conversation-conv-zulu');
    // fireEvent.click dispatches a regular button-0 click with no modifiers,
    // which is the path the component prefers `router.push` for.
    fireEvent.click(row);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/conversations/conv-zulu');
    });
  });

  it('shows the EmptyState when there are no requests and no conversations', async () => {
    listContactRequestsInboxMock.mockResolvedValue({ items: [], next_cursor: null });
    listConversationsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderInbox();
    await waitFor(() => {
      // `inboxRequestsEmpty` for the requests section + `emptyStateInboxTitle`
      // for the chats section. Both should be visible in the "all" view.
      expect(screen.getByText(messages.en.inboxRequestsEmpty)).toBeTruthy();
      expect(screen.getByText(messages.en.emptyStateInboxTitle)).toBeTruthy();
    });
  });

  it('renders the offline Banner when the WebSocket reports closed', async () => {
    listContactRequestsInboxMock.mockResolvedValue({ items: [], next_cursor: null });
    listConversationsMock.mockResolvedValue({ items: [], next_cursor: null });
    renderInbox();
    await waitFor(() => {
      expect(lastSocketOptions?.onStateChange).toBeTruthy();
    });
    // Flip the socket to "closed" — the screen should mount a warning Banner.
    lastSocketOptions?.onStateChange?.('closed');
    await waitFor(() => {
      expect(screen.getByText(messages.en.wsDisconnected)).toBeTruthy();
    });
  });
});
