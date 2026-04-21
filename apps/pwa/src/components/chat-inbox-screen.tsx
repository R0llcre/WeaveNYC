'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Avatar,
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  Inline,
  Pill,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { resolveErrorKey } from '@/lib/error-i18n';
import {
  useAcceptContactRequest,
  useAppSelector,
  useContactRequestsInbox,
  useConversations,
  useRejectContactRequest,
} from '@/lib/hooks';
import { getCategoryLabel, getContactRequestStatusLabel } from '@/lib/i18n';
import {
  selectIsVerified,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { useChatWebSocket, type ChatWebSocketState } from '@/lib/use-chat-websocket';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';

type InboxView = 'all' | 'requests' | 'chats';

type ChatInboxScreenProps = {
  initialView?: InboxView;
};

/**
 * Format a conversation's last-activity timestamp as a short relative label
 * (e.g. "5 min ago", "Yesterday", "Mar 12") using the user's preferred locale
 * so the list row's right-side time chip stays scannable in every language.
 */
function formatConversationTime(value: string, locale: string) {
  const date = new Date(value);
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);

  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 7) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(diffDays, 'day');
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Decorative refresh icon used in the header's right slot. Rendered inside
 * an aria-hidden IconButton wrapper so the glyph never duplicates the
 * button's visible label.
 */
function RefreshIcon() {
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
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}

/**
 * ChatInboxScreen — Wave 4B redesign.
 *
 * One screen, one job: show the two kinds of incoming messages (new requests
 * from neighbours + ongoing chats) as a tight, scannable list. Each row is a
 * tapable Card that drills into the conversation or the request actions.
 *
 * Layout flow:
 *   1. TopBar (title: "Inbox") with a refresh IconButton in rightSlot so the
 *      page never hides its primary affordance behind a secondary button row.
 *   2. Offline banner (warning) when the chat WebSocket closes — WebSocket
 *      disconnect is the signal that matters; regular network offline is a
 *      separate Banner surfaced by PwaRegistration.
 *   3. URL-driven view tabs (All / Requests / Chats) using Pill atoms as
 *      anchors so back/forward and middle-click-to-new-tab still work.
 *   4. Requests section (when visible): Card rows with Avatar + requester +
 *      post title + Accept/Decline buttons. Per-row status Tag on the right.
 *   5. Chats section (when visible): Card rows with Avatar + name + last
 *      message preview + unread Tag + relative timestamp.
 *   6. Empty state per section uses the EmptyState atom with inbox-empty
 *      illustration.
 *   7. Loading state renders 3 `Skeleton variant="rect"` placeholders with
 *      `aria-busy` to match Home + Matches.
 *
 * WebSocket reconnect state is read from the existing `useChatWebSocket`
 * hook — no new business logic is introduced. Unauthenticated /
 * unverified gates are rendered as dedicated EmptyStates at the top of the
 * page content (instead of a full-screen Card) so the persistent TopBar
 * stays visible and the user can see where they are in the app.
 */
export function ChatInboxScreen({ initialView = 'all' }: ChatInboxScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const [wsState, setWsState] = useState<ChatWebSocketState>('connecting');
  const paramView = searchParams.get('view');
  const activeView: InboxView =
    paramView === 'requests' || paramView === 'chats' ? paramView : initialView;
  const showRequests = activeView !== 'chats';
  const showChats = activeView !== 'requests';
  const inboxRequestsQuery = useContactRequestsInbox(
    session?.access_token,
    { limit: 20 },
    isVerified,
    15_000,
  );
  const conversationsQuery = useConversations(session?.access_token, { limit: 20 }, isVerified);
  const acceptMutation = useAcceptContactRequest(session?.access_token);
  const rejectMutation = useRejectContactRequest(session?.access_token);
  const locale =
    preferences.language === 'es' ? 'es-US' : preferences.language === 'zh' ? 'zh-CN' : 'en-US';
  const requests = inboxRequestsQuery.data?.items ?? [];
  const conversations = conversationsQuery.data?.items ?? [];
  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const unreadTotal = conversations.reduce((total, item) => total + item.unread_count, 0);
  const returnToPath = activeView === 'all' ? '/inbox' : `/inbox?view=${activeView}`;

  // useEffectEvent lets us refetch on new WebSocket events without adding the
  // query object (which changes every render) to the effect dep list.
  const handleSocketMessage = useEffectEvent(() => {
    void conversationsQuery.refetch();
    void inboxRequestsQuery.refetch();
  });

  // P0-2: after a disconnect/reconnect cycle the server does not replay
  // buffered events, so we backfill by refetching the same inbox queries
  // the socket normally invalidates on message arrival.
  const handleSocketReconnect = useEffectEvent(() => {
    void conversationsQuery.refetch();
    void inboxRequestsQuery.refetch();
  });

  useChatWebSocket(session?.access_token, handleSocketMessage, {
    enabled: isVerified && Boolean(session?.access_token),
    onStateChange: setWsState,
    onReconnect: handleSocketReconnect,
  });

  // Per-route document.title (F10 contract) — set on the client after
  // hydration so static-export pages still negotiate the user's language.
  useEffect(() => {
    document.title = `${t('pageTitleInbox')} \u2014 WeaveNYC`;
  }, [t]);

  const handleRefresh = () => {
    void conversationsQuery.refetch();
    void inboxRequestsQuery.refetch();
  };

  // Wave 6B pull-to-refresh — shared helper with Home. The PTR container is
  // the inner `.page-content` wrapper so the inbox refresh gesture and the
  // top-right IconButton stay in sync; the gesture is disabled pre-session
  // or pre-verification so we don't start an unauthenticated refetch loop.
  const ptrRefresh = async () => {
    await Promise.all([
      conversationsQuery.refetch(),
      inboxRequestsQuery.refetch(),
    ]);
  };
  const { pullDistance, status: ptrStatus, bindContainer } = usePullToRefresh({
    onRefresh: ptrRefresh,
    disabled: !session || !isVerified,
  });
  const ptrLabel =
    ptrStatus === 'refreshing'
      ? t('pullToRefreshLoading')
      : ptrStatus === 'ready'
        ? t('pullToRefreshRelease')
        : t('pullToRefreshLabel');

  // --- Gate: no session ---------------------------------------------------
  // Anonymous visitors can't see their inbox. Rather than a full-card modal
  // we render the same top-bar chrome + an EmptyState so returning users
  // never lose sight of where they are. The "error" illustration signals a
  // blocker (you must sign in first) more clearly than the inbox-empty
  // illustration that's meant for zero-data success states.
  if (!session) {
    return (
      <div className="page-content" data-screen="inbox">
        <TopBar variant="page" title={t('inboxTitle')} backHref="/" />
        <EmptyState
          illustrationName="error"
          title={t('inboxNeedsSession')}
          cta={{ label: t('backHome'), href: '/', variant: 'primary' }}
        />
      </div>
    );
  }

  // --- Gate: unverified ---------------------------------------------------
  if (!isVerified) {
    return (
      <div className="page-content" data-screen="inbox">
        <TopBar variant="page" title={t('inboxTitle')} backHref="/" />
        <EmptyState
          illustrationName="error"
          title={t('inboxNeedsVerified')}
          cta={{
            label: t('inboxVerifyAction'),
            href: `/verify?return_to=${encodeURIComponent(returnToPath)}`,
            variant: 'primary',
          }}
        />
      </div>
    );
  }

  // Shared skeleton block for loading states. 4 rects so the list feels
  // populated before the query resolves — matches the dense layout we're
  // about to swap in.
  const renderSkeletons = (labelKey: 'chatThreadLoading' | 'postsLoading') => (
    <Stack gap={3} aria-busy="true" aria-label={t(labelKey)}>
      <Skeleton variant="rect" height={72} label={t(labelKey)} />
      <Skeleton variant="rect" height={72} />
      <Skeleton variant="rect" height={72} />
      <Skeleton variant="rect" height={72} />
    </Stack>
  );

  return (
    <div
      ref={bindContainer}
      className={`page-content ptr-host ptr-host--${ptrStatus}`}
      data-screen="inbox"
      style={{ transform: `translateY(${pullDistance}px)` }}
    >
      <div
        className={`ptr-indicator ptr-indicator--${ptrStatus}`}
        aria-live="polite"
        data-testid="ptr-indicator-inbox"
      >
        <span
          className="ptr-indicator__glyph"
          aria-hidden="true"
          style={{ transform: `rotate(${Math.min(pullDistance * 4, 360)}deg)` }}
        />
        <span className="ptr-indicator__label">{ptrLabel}</span>
      </div>
      <TopBar
        variant="page"
        title={t('inboxTitle')}
        rightSlot={
          <IconButton
            variant="ghost"
            size="sm"
            aria-label={t('inboxRefresh')}
            onClick={handleRefresh}
          >
            <RefreshIcon />
          </IconButton>
        }
      />

      <Stack gap={5} as="section">
        {/* --- Status meta chips ------------------------------------------ */}
        {/* Chips read pending + unread counts at a glance so users don't
            have to tally per-row badges. Uses Tag tone=accent for pending
            so it hints at an action and tone=neutral for unread totals. */}
        <Inline gap={2} wrap>
          <Tag tone={pendingCount > 0 ? 'accent' : 'neutral'}>
            {t('inboxPendingCount', { count: pendingCount })}
          </Tag>
          <Tag tone="neutral">{t('inboxUnreadCount', { count: unreadTotal })}</Tag>
        </Inline>

        {/* --- Offline banner (WebSocket) ---------------------------------- */}
        {wsState === 'closed' || wsState === 'reconnecting' ? (
          <Banner
            tone="warning"
            title={wsState === 'reconnecting' ? t('wsReconnecting') : t('wsDisconnected')}
          >
            {t('bannerOfflineHint')}
          </Banner>
        ) : null}

        {/* --- View tabs (URL-driven) -------------------------------------- */}
        <Inline
          as="nav"
          gap={2}
          wrap
          role="tablist"
          aria-label={t('inboxViewHeading')}
          className="pill-scroll"
        >
          <Pill
            as="a"
            href="/inbox/"
            role="tab"
            active={activeView === 'all'}
            aria-selected={activeView === 'all'}
          >
            {t('inboxAllTab')}
          </Pill>
          <Pill
            as="a"
            href="/inbox/?view=requests"
            role="tab"
            active={activeView === 'requests'}
            aria-selected={activeView === 'requests'}
          >
            {t('inboxRequestsTab')}
          </Pill>
          <Pill
            as="a"
            href="/inbox/?view=chats"
            role="tab"
            active={activeView === 'chats'}
            aria-selected={activeView === 'chats'}
          >
            {t('inboxChatsTab')}
          </Pill>
        </Inline>

        {/* --- New requests section --------------------------------------- */}
        {showRequests ? (
          <Stack gap={3} as="section" aria-labelledby="inbox-requests-heading">
            <Stack gap={1}>
              <h2 id="inbox-requests-heading" className="overline">
                {t('inboxRequestsTitle')}
              </h2>
              <p className="muted">{t('inboxRequestsCopy')}</p>
            </Stack>

            {inboxRequestsQuery.isLoading ? renderSkeletons('postsLoading') : null}

            {inboxRequestsQuery.isError ? (
              <Banner
                tone="danger"
                title={t('resourceLoadError')}
                actionLabel={t('sendFailedRetry')}
                onAction={() => void inboxRequestsQuery.refetch()}
              >
                {t(resolveErrorKey(inboxRequestsQuery.error))}
              </Banner>
            ) : null}

            {!inboxRequestsQuery.isLoading && !inboxRequestsQuery.isError && requests.length === 0 ? (
              <EmptyState
                illustrationName="inbox-empty"
                title={t('inboxRequestsEmpty')}
                subtitle={t('emptyStateInboxSubtitle')}
              />
            ) : null}

            {requests.length > 0 ? (
              <ul
                className="chat-list"
                role="list"
                style={{ listStyle: 'none', padding: 0, margin: 0 }}
              >
                {requests.map((item) => {
                  const statusLabel = getContactRequestStatusLabel(
                    preferences.language,
                    item.status,
                  );
                  const categoryLabel = getCategoryLabel(
                    preferences.language,
                    item.from_post_category,
                  );
                  const busy = acceptMutation.isPending || rejectMutation.isPending;
                  return (
                    <li key={item.contact_request_id} className="chat-list__item">
                      <Card
                        as="article"
                        variant="flat"
                        className="chat-card"
                        data-testid={`inbox-request-${item.contact_request_id}`}
                      >
                        <Avatar name={item.requester_alias} size="md" />
                        <div className="chat-card__body">
                          <div className="chat-card__header">
                            <Stack gap={1}>
                              <h3>{item.requester_alias}</h3>
                              <p className="chat-card__title">{item.from_post_title}</p>
                            </Stack>
                            <div className="chat-card__side">
                              <Tag tone={item.status === 'pending' ? 'accent' : 'neutral'}>
                                {statusLabel}
                              </Tag>
                              <span className="chat-card__time">
                                {formatConversationTime(item.created_at, locale)}
                              </span>
                            </div>
                          </div>

                          <Inline gap={2} wrap>
                            <Tag tone="community">{categoryLabel}</Tag>
                            <Tag tone="neutral">
                              {t('inboxExpires')}:{' '}
                              {new Intl.DateTimeFormat(locale, {
                                month: 'short',
                                day: 'numeric',
                              }).format(new Date(item.expires_at))}
                            </Tag>
                          </Inline>

                          <Inline gap={2} wrap>
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void acceptMutation
                                  .mutateAsync(item.contact_request_id)
                                  .then((result) => {
                                    if (result.conversation_id) {
                                      router.push(
                                        `/conversations/${result.conversation_id}?contact_request_id=${encodeURIComponent(
                                          item.contact_request_id,
                                        )}`,
                                      );
                                    }
                                  })
                              }
                            >
                              {t('inboxAccept')}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                // Confirm before firing so accidental taps
                                // don't silently decline a neighbour's
                                // contact request. No ConfirmDialog atom
                                // exists yet (grep: no `confirm-dialog`
                                // testid in repo); native window.confirm is
                                // the simplest UX-safe gate that ships
                                // today and is easy to swap later.
                                if (
                                  typeof window !== 'undefined' &&
                                  !window.confirm(t('contactInboxReject'))
                                ) {
                                  return;
                                }
                                void rejectMutation.mutateAsync(
                                  item.contact_request_id,
                                );
                              }}
                            >
                              {t('contactInboxReject')}
                            </Button>
                            <Button
                              as="a"
                              href={`/posts/${item.to_post_id}`}
                              variant="ghost"
                              size="sm"
                            >
                              {t('inboxRelatedPost')}
                            </Button>
                          </Inline>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Stack>
        ) : null}

        {/* --- Chats section ---------------------------------------------- */}
        {showChats ? (
          <Stack gap={3} as="section" aria-labelledby="inbox-chats-heading">
            <Stack gap={1}>
              <h2 id="inbox-chats-heading" className="overline">
                {t('inboxChatsTitle')}
              </h2>
              <p className="muted">{t('inboxChatsCopy')}</p>
            </Stack>

            {conversationsQuery.isLoading ? renderSkeletons('chatThreadLoading') : null}

            {conversationsQuery.isError ? (
              <Banner
                tone="danger"
                title={t('resourceLoadError')}
                actionLabel={t('sendFailedRetry')}
                onAction={() => void conversationsQuery.refetch()}
              >
                {t(resolveErrorKey(conversationsQuery.error))}
              </Banner>
            ) : null}

            {!conversationsQuery.isLoading && !conversationsQuery.isError && conversations.length === 0 ? (
              <EmptyState
                illustrationName="inbox-empty"
                title={t('emptyStateInboxTitle')}
                subtitle={t('emptyStateInboxSubtitle')}
                cta={{ label: t('backHome'), href: '/', variant: 'primary' }}
              />
            ) : null}

            {conversations.length > 0 ? (
              // Wave 6D (a11y): announce newly-arriving conversations and
              // message previews to screen reader users without hijacking
              // focus. `aria-live="polite"` defers the announcement until
              // the user is idle, and `aria-relevant="additions text"`
              // scopes the chatter to just the new rows (not a full list
              // rebuild). Mirrors the treatment already applied inside the
              // conversation thread in W4B.
              <ul
                className="chat-list"
                role="log"
                aria-live="polite"
                aria-relevant="additions text"
                aria-label={t('inboxChatsTitle')}
                style={{ listStyle: 'none', padding: 0, margin: 0 }}
              >
                {conversations.map((conversation) => {
                  const otherParticipant =
                    conversation.participant_preview.find(
                      (participant) => participant.user_id !== session.user.user_id,
                    ) ?? conversation.participant_preview[0];
                  const displayName =
                    otherParticipant?.alias ?? t('chatThreadFallbackAlias');
                  const preview =
                    conversation.last_message_preview ??
                    t('inboxPendingPreview', {
                      title:
                        conversation.related_post_ids[0] ?? conversation.contact_request_id,
                    });
                  const statusLabel =
                    conversation.status === 'closed'
                      ? t('postsGroup_closed')
                      : conversation.status === 'blocked'
                        ? t('chatThreadBlockedNotice')
                        : t('chatThreadStatusLive');
                  const threadHref = `/conversations/${conversation.conversation_id}`;
                  return (
                    <li key={conversation.conversation_id} className="chat-list__item">
                      {/* Whole-row link so the entire Card is a tap target. The
                          Card atom doesn't support `as="a"`, so we wrap it with
                          an anchor and use `.inbox-row-link` for focus-visible
                          + reset styles (see globals.css). Secondary actions
                          below stop propagation so they still work without
                          drilling into the thread. */}
                      <a
                        href={threadHref}
                        className="inbox-row-link"
                        aria-label={t('inboxOpenThread')}
                        data-testid={`inbox-conversation-${conversation.conversation_id}`}
                        onClick={(event) => {
                          // Prefer client-side router nav so Redux/session is
                          // preserved, but only when the click isn't a
                          // middle-click / modified click (which the browser
                          // handles natively via the anchor).
                          if (
                            event.defaultPrevented ||
                            event.button !== 0 ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          ) {
                            return;
                          }
                          event.preventDefault();
                          router.push(threadHref);
                        }}
                      >
                        <Card
                          as="article"
                          variant="flat"
                          className="chat-card chat-card--tapable"
                        >
                          <Avatar name={displayName} size="md" />
                          <div className="chat-card__body">
                            <div className="chat-card__header">
                              <Stack gap={1}>
                                <h3>{displayName}</h3>
                                <p className="chat-card__title">{preview}</p>
                              </Stack>
                              <div className="chat-card__side">
                                <span className="chat-card__time">
                                  {formatConversationTime(
                                    conversation.last_activity_at,
                                    locale,
                                  )}
                                </span>
                                {conversation.unread_count > 0 ? (
                                  <Tag tone="accent">
                                    {t('inboxUnreadBadge', {
                                      count: conversation.unread_count,
                                    })}
                                  </Tag>
                                ) : null}
                              </div>
                            </div>

                            <Inline gap={2} wrap>
                              <Tag
                                tone={conversation.status === 'active' ? 'verified' : 'neutral'}
                              >
                                {statusLabel}
                              </Tag>
                            </Inline>

                            {conversation.related_post_ids[0] ? (
                              <Inline gap={2} wrap>
                                {/* Secondary action — renders as a button so
                                    we don't nest an `<a>` inside the wrapping
                                    row anchor (invalid HTML). `router.push`
                                    keeps client-side navigation; stopPropagation
                                    prevents the row anchor from also firing. */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    event.preventDefault();
                                    router.push(
                                      `/posts/${conversation.related_post_ids[0]}`,
                                    );
                                  }}
                                >
                                  {t('inboxRelatedPost')}
                                </Button>
                              </Inline>
                            ) : null}
                          </div>
                        </Card>
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}
