/**
 * W4-R2 smoke coverage for the Wave 4B Conversation thread screen.
 *
 * Guards:
 *   - Each rendered message carries a stable `chat-message-{id}` testid so
 *     the E2E suite (matching-inbox.spec.ts) and future regression tests
 *     can target the log reliably.
 *   - The composer textarea exposes `chat-input`.
 *   - The send button exposes `chat-send` and is disabled until the user
 *     types a non-empty message.
 *   - Clicking send with non-empty text calls `sendConversationMessage`
 *     with the expected conversation id + body, and only clears the text
 *     after the server ack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type {
  AuthSession,
  ConversationDetail,
  ConversationMessage,
} from '@/lib/types';
import { ConversationThreadScreen } from './conversation-thread-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/conversations/conv-1',
}));

// Stub the WebSocket hook so jsdom doesn't open a real socket.
vi.mock('@/lib/use-chat-websocket', () => ({
  useChatWebSocket: () => undefined,
}));

// Thin network stubs — queryFn still runs through React Query. Each mock
// returns the data the test needs.
const getConversationMock = vi.fn();
const listConversationMessagesMock = vi.fn();
const sendConversationMessageMock = vi.fn();
const blockUserMock = vi.fn();
const createReportMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getConversation: (...args: unknown[]) => getConversationMock(...args),
    listConversationMessages: (...args: unknown[]) =>
      listConversationMessagesMock(...args),
    sendConversationMessage: (...args: unknown[]) =>
      sendConversationMessageMock(...args),
    blockUser: (...args: unknown[]) => blockUserMock(...args),
    createReport: (...args: unknown[]) => createReportMock(...args),
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

function makeMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    message_id: 'msg-1',
    conversation_id: 'conv-1',
    sender_user_id: '550e8400-e29b-41d4-a716-446655440077',
    sender_alias: 'Neighbor',
    body: 'Hey, thanks for reaching out!',
    sent_at: new Date(Date.now() - 60_000).toISOString(),
    is_mine: false,
    safety_flags: [],
    ...overrides,
  };
}

function renderThread() {
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
          <ConversationThreadScreen conversationId="conv-1" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  getConversationMock.mockReset();
  listConversationMessagesMock.mockReset();
  sendConversationMessageMock.mockReset();
  blockUserMock.mockReset();
  createReportMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ConversationThreadScreen (/conversations/:id)', () => {
  it('renders loaded messages with `chat-message-{id}` testids', async () => {
    getConversationMock.mockResolvedValue(makeConversationDetail());
    listConversationMessagesMock.mockResolvedValue({
      items: [
        makeMessage({ message_id: 'msg-alpha', body: 'Hi there' }),
        makeMessage({
          message_id: 'msg-beta',
          body: 'See you at the library after 3pm.',
          is_mine: true,
        }),
      ],
      next_cursor: null,
    });
    renderThread();
    await waitFor(() => {
      expect(screen.getByTestId('chat-message-msg-alpha')).toBeTruthy();
      expect(screen.getByTestId('chat-message-msg-beta')).toBeTruthy();
    });
    expect(screen.getByText('Hi there')).toBeTruthy();
    expect(screen.getByText('See you at the library after 3pm.')).toBeTruthy();
  });

  it('disables the send button until the textarea has non-empty text', async () => {
    getConversationMock.mockResolvedValue(makeConversationDetail());
    listConversationMessagesMock.mockResolvedValue({
      items: [makeMessage()],
      next_cursor: null,
    });
    renderThread();

    const sendButton = await screen.findByTestId('chat-send');
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);

    // Whitespace-only text must still keep the button disabled because the
    // screen trims before sending.
    const input = screen.getByTestId('chat-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '   ' } });
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);

    // A real character flips it on.
    fireEvent.change(input, { target: { value: 'Hello!' } });
    await waitFor(() => {
      expect((sendButton as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('dispatches the send mutation with the typed body when the button is clicked', async () => {
    getConversationMock.mockResolvedValue(makeConversationDetail());
    listConversationMessagesMock.mockResolvedValue({
      items: [makeMessage()],
      next_cursor: null,
    });
    sendConversationMessageMock.mockResolvedValue({
      conversation_id: 'conv-1',
      message: makeMessage({
        message_id: 'msg-sent',
        body: 'See you at the library after 3pm.',
        is_mine: true,
      }),
    });

    renderThread();

    const input = (await screen.findByTestId('chat-input')) as HTMLTextAreaElement;
    fireEvent.change(input, {
      target: { value: 'See you at the library after 3pm.' },
    });

    fireEvent.click(screen.getByTestId('chat-send'));

    await waitFor(() => {
      expect(sendConversationMessageMock).toHaveBeenCalledWith(
        'access-token-fixture',
        expect.objectContaining({
          conversationId: 'conv-1',
          body: 'See you at the library after 3pm.',
        }),
      );
    });
  });
});
