'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent } from 'react';
import { useTranslations } from 'next-intl';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { Button, Card, PageHeader, Pill } from '@/components/ui';
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
import { useChatWebSocket } from '@/lib/use-chat-websocket';

type InboxView = 'all' | 'requests' | 'chats';

type ChatInboxScreenProps = {
  initialView?: InboxView;
};

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
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getConversationStatusLabel(status: 'active' | 'closed' | 'blocked', t: ReturnType<typeof useTranslations>) {
  switch (status) {
    case 'closed':
      return t('postsGroup_closed');
    case 'blocked':
      return t('chatThreadBlockedNotice');
    default:
      return t('chatThreadStatusLive');
  }
}

function getViewHref(view: InboxView) {
  return view === 'all' ? '/inbox' : `/inbox?view=${view}`;
}

export function ChatInboxScreen({ initialView = 'all' }: ChatInboxScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const isVerified = useAppSelector(selectIsVerified);
  const activeView =
    searchParams.get('view') === 'requests' || searchParams.get('view') === 'chats' ? (searchParams.get('view') as InboxView) : initialView;
  const showRequests = activeView !== 'chats';
  const showChats = activeView !== 'requests';
  const inboxRequestsQuery = useContactRequestsInbox(session?.access_token, { limit: 20 }, isVerified, 15_000);
  const conversationsQuery = useConversations(session?.access_token, { limit: 20 }, isVerified);
  const acceptMutation = useAcceptContactRequest(session?.access_token);
  const rejectMutation = useRejectContactRequest(session?.access_token);
  const locale = preferences.language === 'es' ? 'es-US' : preferences.language === 'zh' ? 'zh-CN' : 'en-US';
  const requests = inboxRequestsQuery.data?.items ?? [];
  const conversations = conversationsQuery.data?.items ?? [];
  const pendingCount = requests.filter((item) => item.status === 'pending').length;
  const unreadTotal = conversations.reduce((total, item) => total + item.unread_count, 0);
  const handleSocketMessage = useEffectEvent(() => {
    void conversationsQuery.refetch();
  });
  const returnToPath = getViewHref(activeView);

  useChatWebSocket(session?.access_token, handleSocketMessage, {
    enabled: isVerified && Boolean(session?.access_token),
  });

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleInbox')} \u2014 WeaveNYC`;
  }, [t]);

  if (!session) {
    return (
      <main className="shell" id="main-content" tabIndex={-1}>
        <div className="shell__inner">
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('inboxNeedsSession')}</p>
              <Button as="a" variant="primary" href="/">
                {t('backHome')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (!isVerified) {
    return (
      <main className="shell" id="main-content" tabIndex={-1}>
        <div className="shell__inner">
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('inboxNeedsVerified')}</p>
              <Button as="a" variant="primary" href={`/verify?return_to=${encodeURIComponent(returnToPath)}`}>
                {t('inboxVerifyAction')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('inboxTitle')}
          title={t('inboxTitle')}
          subtitle={t('inboxCopy')}
          actions={
            <>
              <ContactInboxLink />
              <Link className="hero__link" href="/community">
                {t('inboxBackHome')}
              </Link>
            </>
          }
        />
        <div className="hero__meta">
          <span className="meta-chip meta-chip--accent">{t('inboxPendingCount', { count: pendingCount })}</span>
          <span className="meta-chip">{t('inboxUnreadCount', { count: unreadTotal })}</span>
          <span className="meta-chip">
            {t('inboxViewLabel', {
              view:
                activeView === 'all'
                  ? t('inboxAllTab')
                  : activeView === 'requests'
                    ? t('inboxRequestsTab')
                    : t('inboxChatsTab'),
            })}
          </span>
        </div>

        <Card className="card--results">
          <div className="section-head">
            <div>
              <h2>{t('inboxViewHeading')}</h2>
              <p className="card__subtitle">{t('inboxViewCopy')}</p>
            </div>
            <div
              className="actions actions--tight"
              role="tablist"
              aria-label={t('inboxViewHeading')}
            >
              {/*
                URL-driven tabs. Pill renders as an anchor (`as="a"`) so the
                inbox view is a real linkable URL — deep links, back/forward,
                middle-click-to-new-tab all keep working. `role="tab"` +
                `aria-selected` give AT the tablist semantics; the Pill atom
                also emits `aria-pressed` from its `active` prop.
              */}
              <Pill
                as="a"
                active={activeView === 'all'}
                aria-selected={activeView === 'all'}
                href="/inbox"
                role="tab"
              >
                {t('inboxAllTab')}
              </Pill>
              <Pill
                as="a"
                active={activeView === 'requests'}
                aria-selected={activeView === 'requests'}
                href="/inbox?view=requests"
                role="tab"
              >
                {t('inboxRequestsTab')}
              </Pill>
              <Pill
                as="a"
                active={activeView === 'chats'}
                aria-selected={activeView === 'chats'}
                href="/inbox?view=chats"
                role="tab"
              >
                {t('inboxChatsTab')}
              </Pill>
            </div>
          </div>

          {showRequests ? (
            <section className="section-stack">
              <div className="section-head">
                <div>
                  <h3>{t('inboxRequestsTitle')}</h3>
                  <p className="card__subtitle">{t('inboxRequestsCopy')}</p>
                </div>
                <div className="actions actions--tight">
                  <Button
                    onClick={() => void inboxRequestsQuery.refetch()}
                    size="sm"
                    variant="secondary"
                  >
                    {t('inboxRefresh')}
                  </Button>
                </div>
              </div>

              {inboxRequestsQuery.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
              {inboxRequestsQuery.isError ? (
                <p className="status-copy status-copy--error">
                  {inboxRequestsQuery.error instanceof Error ? inboxRequestsQuery.error.message : t('resourceLoadError')}
                </p>
              ) : null}

              {!inboxRequestsQuery.isLoading && requests.length === 0 ? (
                <div className="result-empty">{t('inboxRequestsEmpty')}</div>
              ) : null}

              <div className="resource-grid">
                {requests.map((item) => (
                  <article className="post-card" key={item.contact_request_id}>
                    <div className="post-card__meta">
                      <span className="meta-chip">{getContactRequestStatusLabel(preferences.language, item.status)}</span>
                      <span className="meta-chip">{getCategoryLabel(preferences.language, item.from_post_category)}</span>
                    </div>
                    <h3>{item.requester_alias}</h3>
                    <p>{item.from_post_title}</p>
                    <p className="resource-card__subtle">
                      {t('inboxCreated')}: {new Date(item.created_at).toLocaleString()}
                    </p>
                    <p className="resource-card__subtle">
                      {t('inboxExpires')}: {new Date(item.expires_at).toLocaleString()}
                    </p>
                    <div className="actions">
                      <Button
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        onClick={() =>
                          void acceptMutation.mutateAsync(item.contact_request_id).then((result) => {
                            if (result.conversation_id) {
                              router.push(
                                `/conversations/${result.conversation_id}?contact_request_id=${encodeURIComponent(
                                  item.contact_request_id,
                                )}`,
                              );
                            }
                          })
                        }
                        variant="primary"
                      >
                        {t('inboxAccept')}
                      </Button>
                      <Button
                        disabled={acceptMutation.isPending || rejectMutation.isPending}
                        onClick={() => void rejectMutation.mutateAsync(item.contact_request_id)}
                        variant="secondary"
                      >
                        {t('inboxReject')}
                      </Button>
                      <Button as="a" variant="secondary" href={`/posts/${item.to_post_id}`}>
                        {t('inboxRelatedPost')}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {showChats ? (
            <section className="section-stack">
              <div className="section-head">
                <div>
                  <h3>{t('inboxChatsTitle')}</h3>
                  <p className="card__subtitle">{t('inboxChatsCopy')}</p>
                </div>
                <div className="actions actions--tight">
                  <Button
                    onClick={() => void conversationsQuery.refetch()}
                    size="sm"
                    variant="secondary"
                  >
                    {t('inboxRefresh')}
                  </Button>
                </div>
              </div>

              {conversationsQuery.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
              {conversationsQuery.isError ? (
                <p className="status-copy status-copy--error">
                  {conversationsQuery.error instanceof Error ? conversationsQuery.error.message : t('resourceLoadError')}
                </p>
              ) : null}

              {!conversationsQuery.isLoading && conversations.length === 0 ? (
                <div className="result-empty">{t('inboxChatsEmpty')}</div>
              ) : null}

              <div className="chat-list">
                {conversations.map((conversation) => {
                  const otherParticipant =
                    conversation.participant_preview.find((participant) => participant.user_id !== session.user.user_id) ??
                    conversation.participant_preview[0];
                  const relatedPostId = conversation.related_post_ids[0] ?? null;

                  return (
                    <article className="chat-card" key={conversation.conversation_id}>
                      <div className="chat-card__avatar" aria-hidden="true">
                        {otherParticipant?.alias.slice(0, 1).toUpperCase() ?? 'N'}
                      </div>
                      <div className="chat-card__body">
                        <div className="chat-card__header">
                          <div>
                            <h3>{otherParticipant?.alias ?? t('chatThreadFallbackAlias')}</h3>
                            <p className="chat-card__title">
                              {conversation.last_message_preview ?? t('inboxPendingPreview', { title: relatedPostId ?? conversation.contact_request_id })}
                            </p>
                          </div>
                          <div className="chat-card__side">
                            <span className="chat-card__time">{formatConversationTime(conversation.last_activity_at, locale)}</span>
                            {conversation.unread_count > 0 ? (
                              <span className="unread-pill">{t('inboxUnreadBadge', { count: conversation.unread_count })}</span>
                            ) : null}
                          </div>
                        </div>

                        <p className="chat-card__preview">
                          {conversation.last_message_preview ?? t('inboxChatsCopy')}
                        </p>

                        <div className="post-card__meta">
                          <span className="meta-chip">{getConversationStatusLabel(conversation.status, t)}</span>
                          <span className="meta-chip">
                            {t('inboxExpiresAt', { value: new Date(conversation.last_activity_at).toLocaleString() })}
                          </span>
                        </div>

                        <div className="chat-card__footer">
                          <p className="resource-card__subtle">
                            {relatedPostId ? t('inboxFromPost', { title: relatedPostId }) : t('chatThreadRelatedPostMissing')}
                          </p>
                          <div className="actions">
                            <Button as="a" variant="primary" href={`/conversations/${conversation.conversation_id}`}>
                              {t('inboxOpenThread')}
                            </Button>
                            {relatedPostId ? (
                              <Button as="a" variant="secondary" href={`/posts/${relatedPostId}`}>
                                {t('inboxRelatedPost')}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
