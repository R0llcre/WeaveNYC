'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

// Polyfill for React's experimental `useEffectEvent` — keeps the latest
// callback reachable from inside an effect without participating in the
// dependency array. Stable identity, always sees latest closure.
function useEffectEvent<T extends (...args: never[]) => unknown>(handler: T): T {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  return useCallback(((...args: never[]) => ref.current(...args)) as T, []);
}

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  EmptyState,
  Field,
  IconButton,
  Inline,
  Pill,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { resolveErrorKey } from '@/lib/error-i18n';
import {
  useAppSelector,
  useBlockUser,
  useConversation,
  useConversationMessages,
  useCreateReport,
  useSendConversationMessage,
} from '@/lib/hooks';
import { selectPreferences, selectSession } from '@/lib/selectors';
import { useChatWebSocket, type ChatWebSocketState } from '@/lib/use-chat-websocket';
import type {
  ChatRealtimeEvent,
  ConversationMessage,
  MessageSafetyFlag,
} from '@/lib/types';

type ConversationThreadScreenProps = {
  conversationId: string;
};

/**
 * Group header date label: localized "today"/"yesterday" via
 * `Intl.RelativeTimeFormat` (numeric: 'auto'), or a short date for older
 * days. Using Intl keeps the label fully localized without adding bespoke
 * i18n keys — every supported locale (en-US, es-US, zh-CN) already ships
 * the relative strings in the ICU CLDR bundle.
 *
 * Threshold: only `diffDays === 0` (today) and `diffDays === -1` (yesterday)
 * use the relative string. Future dates (e.g. a clock-drift-induced tomorrow
 * value) fall back to the absolute date so we never render "tomorrow" for
 * a message bubble that is always in the past.
 */
function formatDayLabel(date: Date, locale: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0 || diffDays === -1) {
    // diffDays of 0 yields "today", -1 yields "yesterday" under numeric:'auto'.
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffDays, 'day');
  }
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function formatMessageTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /HTTP\s+403/i.test(error.message);
}

/**
 * Inline SVG glyphs used by the composer send button and top-bar actions.
 * All use `currentColor` so tone is inherited from the IconButton wrapper.
 */
function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 22V4" />
      <path d="M4 15l10-3a4 4 0 0 1 4 1l2 1V6l-2-1a4 4 0 0 0-4-1L4 7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3l8 3v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" />
      <path d="M9 10l4 4 6-6" />
    </svg>
  );
}

/**
 * Build [{ dayKey, label, items }] groups from a messages array. Groups are
 * ordered oldest → newest so the scroll container fills bottom-up naturally.
 * Server returns newest-first, so we reverse once before grouping and never
 * mutate the original array.
 */
function groupMessagesByDay(
  messages: ConversationMessage[],
  locale: string,
): Array<{ dayKey: string; label: string; items: ConversationMessage[] }> {
  const ordered = [...messages].reverse();
  const groups = new Map<string, ConversationMessage[]>();
  for (const msg of ordered) {
    const d = new Date(msg.sent_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const bucket = groups.get(key) ?? [];
    bucket.push(msg);
    groups.set(key, bucket);
  }
  return Array.from(groups.entries()).map(([dayKey, items]) => ({
    dayKey,
    label: formatDayLabel(new Date(items[0].sent_at), locale),
    items,
  }));
}

/**
 * F4-C P0 — map a `MessageSafetyFlag` (server-side enum, canonical source
 * in `@weavenyc/shared` `messageSafetyFlags`) to a {tone, i18nKey} pair for
 * the inline banner we render above a flagged message body.
 *
 * - `danger`  → hate_speech / harassment. These also trigger the "hide by
 *               default, click to Show anyway" disclosure (see `isBlockingFlag`).
 * - `warning` → SSN / bank account / passport / bank — possibly sensitive
 *               financial or identity data that the user probably didn't
 *               mean to broadcast.
 * - `info`    → phone / address / wire / crypto / gift_card — softer heads-up
 *               that could still be a false positive (e.g. "bank of the river").
 */
type SafetyBannerTone = 'info' | 'warning' | 'danger';
type SafetyFlagDescriptor = {
  tone: SafetyBannerTone;
  messageKey:
    | 'chatSafetyHateSpeech'
    | 'chatSafetyHarassment'
    | 'chatSafetyPhone'
    | 'chatSafetyAddress'
    | 'chatSafetySsn'
    | 'chatSafetyBankAccount'
    | 'chatSafetyPassport'
    | 'chatSafetyBank'
    | 'chatSafetyWire'
    | 'chatSafetyCrypto'
    | 'chatSafetyGiftCard';
};

const SAFETY_FLAG_DESCRIPTORS: Record<MessageSafetyFlag, SafetyFlagDescriptor> = {
  hate_speech: { tone: 'danger', messageKey: 'chatSafetyHateSpeech' },
  harassment: { tone: 'danger', messageKey: 'chatSafetyHarassment' },
  sensitive_ssn: { tone: 'warning', messageKey: 'chatSafetySsn' },
  sensitive_bank_account: { tone: 'warning', messageKey: 'chatSafetyBankAccount' },
  keyword_passport: { tone: 'warning', messageKey: 'chatSafetyPassport' },
  keyword_bank: { tone: 'warning', messageKey: 'chatSafetyBank' },
  sensitive_phone: { tone: 'info', messageKey: 'chatSafetyPhone' },
  sensitive_address: { tone: 'info', messageKey: 'chatSafetyAddress' },
  keyword_wire: { tone: 'info', messageKey: 'chatSafetyWire' },
  keyword_crypto: { tone: 'info', messageKey: 'chatSafetyCrypto' },
  keyword_gift_card: { tone: 'info', messageKey: 'chatSafetyGiftCard' },
};

const BLOCKING_SAFETY_FLAGS = new Set<MessageSafetyFlag>(['hate_speech', 'harassment']);

function hasBlockingFlag(flags: readonly MessageSafetyFlag[] | undefined): boolean {
  if (!flags) return false;
  for (const flag of flags) {
    if (BLOCKING_SAFETY_FLAGS.has(flag)) return true;
  }
  return false;
}

/**
 * MessageBubble — single-message render that surfaces `safety_flags`.
 *
 * Prior to F4-C we rendered `message.body` raw. Anything the server
 * flagged on SEND (see PR #57 — the chat-safety hate/harassment/Luhn/E.164
 * pipeline) reached the wire-through with no UI indication whatsoever:
 * the flags landed in the message row but the PWA silently ignored them.
 *
 * Now:
 *   1. If `safety_flags` is non-empty, stack a Banner per flag ABOVE the
 *      bubble body. Tone maps via `SAFETY_FLAG_DESCRIPTORS`.
 *   2. For hate_speech / harassment, the bubble body is hidden by default
 *      and replaced with a "Show anyway" disclosure — sensitive-surface
 *      pattern used across the app (e.g. block-user confirmation).
 *   3. Non-blocking flags keep the body visible because hiding every
 *      phone-number false positive would make the product unusable.
 *
 * Accessibility:
 *   - Each Banner already carries `role="alert"` (danger/warning) or
 *     `role="status"` (info) from the Banner atom — screen readers get
 *     the right announcement priority without extra wiring here.
 *   - The Show-anyway toggle uses `aria-expanded` and `aria-controls` so
 *     AT users understand it reveals the hidden body rather than doing
 *     something destructive.
 */
function MessageBubble({
  message,
  locale,
}: {
  message: ConversationMessage;
  locale: string;
}) {
  const t = useTranslations();
  const flags = message.safety_flags ?? [];
  const blocking = hasBlockingFlag(flags);
  const [revealed, setRevealed] = useState(false);
  const bodyId = `chat-body-${message.message_id}`;
  const showBody = !blocking || revealed;

  return (
    <article
      className={`message-bubble ${
        message.is_mine ? 'message-bubble--self' : 'message-bubble--peer'
      }`}
      data-testid={`chat-message-${message.message_id}`}
    >
      <div className="message-bubble__meta">
        <span>{message.is_mine ? t('chatThreadYou') : message.sender_alias}</span>
        <span>{formatMessageTime(message.sent_at, locale)}</span>
      </div>

      {flags.length > 0 ? (
        <Stack gap={1} data-testid={`chat-message-${message.message_id}-safety`}>
          {flags.map((flag) => {
            const descriptor = SAFETY_FLAG_DESCRIPTORS[flag];
            if (!descriptor) return null;
            return (
              <Banner
                key={flag}
                tone={descriptor.tone}
                title={t(descriptor.messageKey)}
                data-testid={`chat-safety-banner-${flag}`}
              />
            );
          })}
        </Stack>
      ) : null}

      {blocking && !revealed ? (
        <>
          <p className="muted" id={bodyId}>
            {t('chatSafetyHidden')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRevealed(true)}
            aria-expanded={false}
            aria-controls={bodyId}
            data-testid={`chat-message-${message.message_id}-show-anyway`}
          >
            {t('chatSafetyShowAnyway')}
          </Button>
        </>
      ) : null}

      {showBody ? (
        <p id={bodyId} aria-live={blocking && revealed ? 'polite' : undefined}>
          {message.body}
        </p>
      ) : null}
    </article>
  );
}

/**
 * ConversationThreadScreen — Wave 4B redesign.
 *
 * Layout:
 *   1. TopBar (backHref="/inbox") with the other party's name as the title
 *      and a right slot containing Report + Block IconButtons. Back chevron,
 *      title, and safe-area padding are all owned by the TopBar atom.
 *   2. Status chips (live / closed / blocked) and optional WebSocket
 *      reconnect Banner.
 *   3. Scrollable message list (aria-live polite) with 4-level elevation:
 *        - Own message    → `message-bubble--self` (accent-soft, right)
 *        - Peer message   → `message-bubble--peer` (surface-raised, left)
 *        - System message → `message-bubble--system` (centred Tag-like)
 *        - Error message  → inline Banner tone="danger"
 *      Messages are grouped by calendar day with a sticky-ish header label.
 *   4. Composer (Field + textarea + send IconButton + quick phrases).
 *
 * All WebSocket + Redux + React Query business logic is preserved verbatim
 * from the previous version — we only changed how the data renders.
 */
export function ConversationThreadScreen({
  conversationId,
}: ConversationThreadScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const [composer, setComposer] = useState('');
  const [reported, setReported] = useState(false);
  const [wsState, setWsState] = useState<ChatWebSocketState>('connecting');
  const [sendGuardError, setSendGuardError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const locale =
    preferences.language === 'es' ? 'es-US' : preferences.language === 'zh' ? 'zh-CN' : 'en-US';
  const contactRequestId = searchParams.get('contact_request_id');

  const conversationQuery = useConversation(
    session?.access_token,
    conversationId,
    Boolean(session?.access_token),
  );
  const messagesQuery = useConversationMessages(
    session?.access_token,
    conversationId,
    { limit: 50 },
    Boolean(session?.access_token),
  );
  const sendMessageMutation = useSendConversationMessage(session?.access_token);
  const blockUserMutation = useBlockUser(session?.access_token);
  const reportMutation = useCreateReport(session?.access_token);

  const conversation = conversationQuery.data;
  const messages = messagesQuery.data?.items ?? [];
  const otherParticipant =
    conversation?.participant_preview.find(
      (participant) => participant.user_id !== session?.user.user_id,
    ) ?? conversation?.participant_preview[0] ?? null;
  const relatedPostId = conversation?.related_post_ids[0] ?? null;
  const isBlocked = conversation?.status === 'blocked';
  const isClosed = conversation?.status === 'closed';
  const accessDenied = isForbiddenError(conversationQuery.error);

  // Per-route document.title (F10 contract).
  useEffect(() => {
    document.title = `${t('pageTitleConversation')} \u2014 WeaveNYC`;
  }, [t]);

  const handleSocketMessage = useEffectEvent((payload: ChatRealtimeEvent) => {
    if (payload.event_type === 'message.created' && payload.conversation_id === conversationId) {
      void messagesQuery.refetch();
      void conversationQuery.refetch();
      return;
    }
    if (
      payload.event_type === 'conversation.updated' &&
      payload.conversation.conversation_id === conversationId
    ) {
      void conversationQuery.refetch();
    }
  });

  // P0-2: after a reconnect we don't know which message.created or
  // conversation.updated events were published while the socket was down;
  // the server does not backfill automatically. Refetch the messages +
  // conversation detail so the user sees anything that landed while they
  // were on the train.
  const handleSocketReconnect = useEffectEvent(() => {
    void messagesQuery.refetch();
    void conversationQuery.refetch();
  });

  useChatWebSocket(session?.access_token, handleSocketMessage, {
    enabled: Boolean(session?.access_token) && !accessDenied,
    onStateChange: setWsState,
    onReconnect: handleSocketReconnect,
  });

  // Autoscroll the message list to the bottom whenever it grows. Using a
  // ref keeps the behaviour out of React's render cycle and avoids extra
  // re-renders for other components that read conversation state.
  useEffect(() => {
    const node = listRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [messages.length]);

  async function handleSend(body: string) {
    setSendGuardError(null);

    if (!body.trim() || isBlocked || isClosed) {
      return;
    }

    // Bug F5-2 fix (preserved): refresh conversation state before POST so we
    // never send into a thread that was just closed/blocked out-of-band.
    const refreshed = await conversationQuery.refetch();
    const currentStatus = refreshed.data?.status ?? conversation?.status;
    if (currentStatus && currentStatus !== 'active') {
      setSendGuardError(
        currentStatus === 'blocked' ? t('chatThreadBlockedNotice') : t('postsGroup_closed'),
      );
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({ conversationId, body });
      // Clear only after server ack so a failure keeps the user's text
      // (Bug F5-2 + F5-4 contract preserved).
      setComposer('');
      void messagesQuery.refetch();
    } catch {
      // Surfaced via the send-error Banner below.
    }
  }

  async function handleBlock() {
    if (!conversation?.other_user_id) return;
    await blockUserMutation.mutateAsync({
      blockedUserId: conversation.other_user_id,
      conversationId,
    });
    void conversationQuery.refetch();
    router.push('/inbox/');
  }

  async function handleReport() {
    if (!conversation?.other_user_id) return;
    await reportMutation.mutateAsync({
      targetType: 'user',
      targetId: conversation.other_user_id,
      reason: 'unsafe_behavior',
      conversationId,
    });
    setReported(true);
  }

  // --- Gate: no session ---------------------------------------------------
  // Use the "error" illustration (not inbox-empty) because this is an auth
  // blocker rather than a zero-data empty state — the user must act.
  if (!session) {
    return (
      <div className="page-content" data-screen="conversation">
        <TopBar variant="page" title={t('chatThreadTitle')} backHref="/" />
        <EmptyState
          illustrationName="error"
          title={t('joinNeedsSession')}
          cta={{ label: t('backHome'), href: '/', variant: 'primary' }}
        />
      </div>
    );
  }

  // --- Gate: anonymous (unverified) --------------------------------------
  if (session.user.level === 'anonymous') {
    const returnTo = encodeURIComponent(
      contactRequestId
        ? `/conversations/${conversationId}?contact_request_id=${contactRequestId}`
        : `/conversations/${conversationId}`,
    );
    return (
      <div className="page-content" data-screen="conversation">
        <TopBar variant="page" title={t('chatThreadTitle')} backHref="/inbox/" />
        <EmptyState
          illustrationName="error"
          title={t('composeNeedsVerified')}
          cta={{
            label: t('goVerify'),
            href: `/verify?return_to=${returnTo}`,
            variant: 'primary',
          }}
        />
      </div>
    );
  }

  // --- Gate: not a participant (403) -------------------------------------
  // Preserve the Bug F5-3 access-denied path: render an explicit banner
  // before attempting to show messages so the wrong user never sees partial
  // data.
  if (accessDenied) {
    return (
      <div className="page-content" data-screen="conversation">
        <TopBar
          variant="page"
          eyebrow={t('chatThreadTitle')}
          title={t('conversationAccessDeniedTitle')}
          backHref="/inbox/"
        />
        <Banner tone="warning" title={t('conversationAccessDeniedTitle')}>
          {t('conversationAccessDeniedBody')}
        </Banner>
      </div>
    );
  }

  const title = otherParticipant?.alias ?? t('chatThreadFallbackAlias');
  const headerStatus = isBlocked
    ? t('chatThreadBlockedNotice')
    : isClosed
      ? t('postsGroup_closed')
      : t('chatThreadStatusLive');
  const statusTone: 'verified' | 'urgent' | 'neutral' = isBlocked
    ? 'urgent'
    : isClosed
      ? 'neutral'
      : 'verified';
  const groups = groupMessagesByDay(messages, locale);
  const composerDisabled = isBlocked || isClosed || sendMessageMutation.isPending;
  const quickPhrases = [
    t('chatQuickPhraseHello'),
    t('chatQuickPhraseTiming'),
    t('chatQuickPhrasePublicMeet'),
    t('chatQuickPhraseThanks'),
  ];

  return (
    <div className="page-content" data-screen="conversation">
      <TopBar
        variant="page"
        title={title}
        backHref="/inbox/"
        rightSlot={
          <Inline gap={1} align="center">
            <IconButton
              variant="ghost"
              size="sm"
              aria-label={t('chatThreadReportAction')}
              onClick={() => void handleReport()}
              disabled={reportMutation.isPending || reported}
            >
              <FlagIcon />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              tone="danger"
              aria-label={t('chatThreadBlockAction')}
              onClick={() => void handleBlock()}
              disabled={blockUserMutation.isPending || isBlocked}
            >
              <ShieldIcon />
            </IconButton>
          </Inline>
        }
      />

      <Stack gap={4} as="section">
        {/* --- Status + metadata chips ------------------------------------ */}
        <Inline gap={2} wrap>
          <Tag tone={statusTone}>{headerStatus}</Tag>
          {relatedPostId ? (
            <Tag tone="community">
              {t('chatThreadRelatedPostLabel')} {relatedPostId}
            </Tag>
          ) : null}
          {conversation?.last_activity_at ? (
            <Tag tone="neutral">
              {t('chatThreadLastSeen', {
                value: new Intl.DateTimeFormat(locale, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(conversation.last_activity_at)),
              })}
            </Tag>
          ) : null}
        </Inline>

        {/* --- Connection banners ----------------------------------------- */}
        {wsState === 'reconnecting' ? (
          <Banner tone="info" title={t('wsReconnecting')} />
        ) : wsState === 'closed' ? (
          <Banner tone="warning" title={t('wsDisconnected')}>
            {t('bannerOfflineHint')}
          </Banner>
        ) : null}

        {/* Blocked banner surfaces the thread-level warning even when the
            chip already says blocked — it stops being a tag and starts
            being a live region so the user hears it on focus. */}
        {isBlocked ? <Banner tone="warning" title={t('chatThreadBlockedNotice')} /> : null}
        {reported ? (
          <Banner tone="success" title={t('chatThreadReportedNotice')} />
        ) : null}

        {/* --- Message list (scrollable) ---------------------------------- */}
        <div
          ref={listRef}
          className="message-list"
          aria-live="polite"
          aria-busy={conversationQuery.isLoading || messagesQuery.isLoading}
          aria-label={t('chatThreadMessagesTitle')}
          role="log"
          style={{
            maxHeight: 'min(60vh, 540px)',
            overflowY: 'auto',
            paddingRight: 'var(--space-1)',
          }}
        >
          {conversationQuery.isLoading || messagesQuery.isLoading ? (
            <Stack gap={3}>
              <Skeleton variant="rect" height={64} label={t('chatThreadLoading')} />
              <Skeleton variant="rect" height={80} />
              <Skeleton variant="rect" height={64} />
            </Stack>
          ) : null}

          {/* Error-message bubble: render an inline danger banner so the
              failure stays scoped to the thread (user can retry from the
              composer without losing context). */}
          {conversationQuery.isError || messagesQuery.isError ? (
            <Banner
              tone="danger"
              title={t('resourceLoadError')}
              actionLabel={t('sendFailedRetry')}
              onAction={() => {
                void conversationQuery.refetch();
                void messagesQuery.refetch();
              }}
            >
              {t(resolveErrorKey(conversationQuery.error ?? messagesQuery.error))}
            </Banner>
          ) : null}

          {!conversationQuery.isLoading && messages.length === 0 && !conversationQuery.isError ? (
            <EmptyState
              illustrationName="inbox-empty"
              title={t('chatThreadEmpty')}
            />
          ) : null}

          {groups.map((group) => (
            <section key={group.dayKey} aria-label={group.label}>
              <div
                className="message-bubble message-bubble--system"
                role="separator"
                aria-label={group.label}
              >
                <span className="overline">{group.label}</span>
              </div>
              {group.items.map((message) => (
                <MessageBubble
                  key={message.message_id}
                  message={message}
                  locale={locale}
                />
              ))}
            </section>
          ))}
        </div>

        {/* --- Quick phrases --------------------------------------------- */}
        {/* Pill row injects short copy into the composer. Wrap + aria-label
            keep the group discoverable via rotor on mobile AT. */}
        <Inline
          as="nav"
          gap={2}
          wrap
          className="pill-scroll"
          aria-label={t('chatThreadQuickPhrasesTitle')}
        >
          {quickPhrases.map((phrase) => (
            <Pill
              key={phrase}
              onClick={() => setComposer(phrase)}
              disabled={composerDisabled}
            >
              {phrase}
            </Pill>
          ))}
        </Inline>

        {/* --- Composer -------------------------------------------------- */}
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend(composer);
          }}
        >
          <Field
            className="composer__field"
            hint={t('chatThreadComposerHint')}
            label={t('chatThreadComposerLabel')}
          >
            <textarea
              data-testid="chat-input"
              disabled={composerDisabled}
              onChange={(event) => setComposer(event.target.value)}
              placeholder={t('chatThreadComposerPlaceholder')}
              rows={3}
              value={composer}
            />
          </Field>

          {sendGuardError ? <Banner tone="warning" title={sendGuardError} /> : null}

          {sendMessageMutation.isError ? (
            <Banner
              tone="danger"
              title={t('sendFailedTitle')}
              actionLabel={t('sendFailedRetry')}
              onAction={() => sendMessageMutation.reset()}
            >
              {t(resolveErrorKey(sendMessageMutation.error))}
            </Banner>
          ) : null}

          <div className="composer__footer">
            <span className="muted text-body-sm">{t('chatThreadSafetyCopy')}</span>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={composerDisabled || !composer.trim()}
              trailingIcon={<SendIcon />}
              data-testid="chat-send"
            >
              {t('chatThreadSendAction')}
            </Button>
          </div>
        </form>
      </Stack>
    </div>
  );
}
