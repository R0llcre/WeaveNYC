'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { Banner, Button, Card, Field, PageHeader, Pill } from '@/components/ui';
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
import type { ChatRealtimeEvent } from '@/lib/types';

type ConversationThreadScreenProps = {
  conversationId: string;
};

function formatThreadTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isForbiddenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /HTTP\s+403/i.test(error.message);
}

export function ConversationThreadScreen({ conversationId }: ConversationThreadScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const [composer, setComposer] = useState('');
  const [reported, setReported] = useState(false);
  const [wsState, setWsState] = useState<ChatWebSocketState>('connecting');
  const [sendGuardError, setSendGuardError] = useState<string | null>(null);
  const locale = preferences.language === 'es' ? 'es-US' : preferences.language === 'zh' ? 'zh-CN' : 'en-US';
  const contactRequestId = searchParams.get('contact_request_id');
  const conversationQuery = useConversation(session?.access_token, conversationId, Boolean(session?.access_token));
  const messagesQuery = useConversationMessages(session?.access_token, conversationId, { limit: 50 }, Boolean(session?.access_token));
  const sendMessageMutation = useSendConversationMessage(session?.access_token);
  const blockUserMutation = useBlockUser(session?.access_token);
  const reportMutation = useCreateReport(session?.access_token);
  const conversation = conversationQuery.data;
  const messages = messagesQuery.data?.items ?? [];
  const otherParticipant =
    conversation?.participant_preview.find((participant) => participant.user_id !== session?.user.user_id) ??
    conversation?.participant_preview[0] ??
    null;
  const relatedPostId = conversation?.related_post_ids[0] ?? null;
  const isBlocked = conversation?.status === 'blocked';
  const isClosed = conversation?.status === 'closed';
  const accessDenied = isForbiddenError(conversationQuery.error);

  // F10: per-route document.title
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

  useChatWebSocket(session?.access_token, handleSocketMessage, {
    enabled: Boolean(session?.access_token) && !accessDenied,
    onStateChange: setWsState,
  });

  async function handleSend(body: string) {
    setSendGuardError(null);

    if (!body.trim() || isBlocked || isClosed) {
      return;
    }

    // Bug F5-2 fix: refresh the conversation before we send so we do not POST
    // into a thread that was just closed/blocked while the composer was focused.
    const refreshed = await conversationQuery.refetch();
    const currentStatus = refreshed.data?.status ?? conversation?.status;
    if (currentStatus && currentStatus !== 'active') {
      setSendGuardError(
        currentStatus === 'blocked' ? t('chatThreadBlockedNotice') : t('postsGroup_closed'),
      );
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        body,
      });
      // Only clear the composer after the server acknowledges the send so a
      // failure keeps the user's text intact (Bug F5-2 + F5-4).
      setComposer('');
      void messagesQuery.refetch();
    } catch {
      // The mutation's error state is surfaced via <Banner /> below, so we
      // intentionally keep the textarea value and avoid throwing into React.
    }
  }

  async function handleBlock() {
    if (!conversation?.other_user_id) {
      return;
    }

    await blockUserMutation.mutateAsync({
      blockedUserId: conversation.other_user_id,
      conversationId,
    });
    void conversationQuery.refetch();
    router.push('/inbox');
  }

  async function handleReport() {
    if (!conversation?.other_user_id) {
      return;
    }

    await reportMutation.mutateAsync({
      targetType: 'user',
      targetId: conversation.other_user_id,
      reason: 'unsafe_behavior',
      conversationId,
    });
    setReported(true);
  }

  if (!session) {
    return (
      <main className="shell" id="main-content" tabIndex={-1}>
        <div className="shell__inner">
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Button as="a" variant="primary" href="/">
                {t('backHome')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  if (session.user.level === 'anonymous') {
    const returnTo = encodeURIComponent(
      contactRequestId
        ? `/conversations/${conversationId}?contact_request_id=${contactRequestId}`
        : `/conversations/${conversationId}`,
    );

    return (
      <main className="shell" id="main-content" tabIndex={-1}>
        <div className="shell__inner">
          <Card variant="raised">
            <div className="result-empty">
              <p>{t('composeNeedsVerified')}</p>
              <Button as="a" variant="primary" href={`/verify?return_to=${returnTo}`}>
                {t('goVerify')}
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // Bug F5-3 fix: non-participant users hitting the thread URL get a 403 back
  // from GET /v1/conversations/:id. Render an access-denied banner before we
  // attempt to load messages so we never show partial data to the wrong user.
  if (accessDenied) {
    return (
      <main className="shell" id="main-content" tabIndex={-1}>
        <div className="shell__inner">
          <PageHeader
            eyebrow={t('chatThreadTitle')}
            title={t('conversationAccessDeniedTitle')}
            subtitle={t('chatThreadCopy')}
            actions={
              <>
                <ContactInboxLink />
                <Link className="hero__link" href="/inbox">
                  {t('inboxTitle')}
                </Link>
              </>
            }
          />
          <Card variant="raised">
            <Banner tone="warning" title={t('conversationAccessDeniedTitle')}>
              {t('conversationAccessDeniedBody')}
            </Banner>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('chatThreadTitle')}
          title={otherParticipant?.alias ?? t('chatThreadFallbackAlias')}
          subtitle={t('chatThreadCopy')}
          actions={
            <>
              <ContactInboxLink />
              <Link className="hero__link" href="/inbox">
                {t('inboxTitle')}
              </Link>
            </>
          }
        />
        <div className="hero__meta">
          <span className="meta-chip meta-chip--accent">
            {isBlocked ? t('chatThreadBlockedNotice') : isClosed ? t('postsGroup_closed') : t('chatThreadStatusLive')}
          </span>
          <span className="meta-chip">conversation_id: {conversationId}</span>
          {contactRequestId ? <span className="meta-chip">contact_request_id: {contactRequestId}</span> : null}
        </div>

        {wsState === 'reconnecting' ? (
          <Banner tone="info" title={t('wsReconnecting')} />
        ) : wsState === 'closed' ? (
          <Banner tone="warning" title={t('wsDisconnected')} />
        ) : null}

        {isBlocked ? (
          <Banner tone="warning" title={t('chatThreadBlockedNotice')} />
        ) : null}

        <section className="chat-thread">
          <Card as="article" className="detail-card chat-thread__sidebar">
            <div className="section-stack">
              <div>
                <h2>{t('chatThreadDetailsTitle')}</h2>
                <p className="card__subtitle">{t('chatThreadDetailsCopy')}</p>
              </div>

              <div className="meta-strip">
                {conversation?.participant_preview.map((participant) => (
                  <span className="meta-chip" key={participant.user_id}>
                    {participant.alias}
                  </span>
                ))}
              </div>

              <div className="result-block">
                <strong>{t('chatThreadSafetyTitle')}</strong>
                <p className="resource-card__subtle">{t('chatThreadSafetyCopy')}</p>
              </div>

              <div className="result-block">
                <strong>{t('chatThreadQuickPhrasesTitle')}</strong>
                <div className="quick-phrases">
                  {[t('chatQuickPhraseHello'), t('chatQuickPhraseTiming'), t('chatQuickPhrasePublicMeet'), t('chatQuickPhraseThanks')].map(
                    (phrase) => (
                      <Pill key={phrase} onClick={() => setComposer(phrase)}>
                        {phrase}
                      </Pill>
                    ),
                  )}
                </div>
              </div>

              <div className="result-block">
                <strong>{t('chatThreadActionsTitle')}</strong>
                <div className="actions">
                  <Button onClick={() => void handleReport()} variant="secondary">
                    {t('chatThreadReportAction')}
                  </Button>
                  <details className="danger-zone">
                    <summary>{t('chatThreadBlockAction')}</summary>
                    <Button onClick={() => void handleBlock()} variant="danger">
                      {t('chatThreadBlockAction')}
                    </Button>
                  </details>
                </div>
                {reported ? <p className="status-copy">{t('chatThreadReportedNotice')}</p> : null}
                {blockUserMutation.isError ? (
                  <p className="status-copy status-copy--error">
                    {blockUserMutation.error instanceof Error ? blockUserMutation.error.message : t('resourceLoadError')}
                  </p>
                ) : null}
              </div>

              <div className="result-block">
                <strong>{t('chatThreadRelatedTitle')}</strong>
                <div className="section-stack">
                  <p className="resource-card__subtle">
                    {relatedPostId ? `${t('chatThreadRelatedPostLabel')} ${relatedPostId}` : t('chatThreadRelatedPostMissing')}
                  </p>
                  {relatedPostId ? (
                    <Button as="a" variant="secondary" href={`/posts/${relatedPostId}`}>
                      {t('contactInboxRelatedPost')}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card className="detail-card chat-thread__panel">
            <div className="chat-thread__header">
              <div>
                <h2>{t('chatThreadMessagesTitle')}</h2>
                <p className="card__subtitle">{t('chatThreadMessagesCopy')}</p>
              </div>
              <span className="meta-chip">
                {conversation?.last_activity_at
                  ? t('chatThreadLastSeen', { value: formatThreadTime(conversation.last_activity_at, locale) })
                  : t('chatThreadLoading')}
              </span>
            </div>

            {conversationQuery.isLoading || messagesQuery.isLoading ? <p className="status-copy">{t('chatThreadLoading')}</p> : null}
            {conversationQuery.isError || messagesQuery.isError ? (
              <p className="status-copy status-copy--error">
                {(conversationQuery.error instanceof Error && conversationQuery.error.message) ||
                  (messagesQuery.error instanceof Error && messagesQuery.error.message) ||
                  t('resourceLoadError')}
              </p>
            ) : null}

            <div className="message-list" aria-live="polite">
              {!conversationQuery.isLoading && messages.length === 0 ? <div className="result-empty">{t('chatThreadEmpty')}</div> : null}
              {messages
                .slice()
                .reverse()
                .map((message) => (
                  <article
                    className={`message-bubble ${message.is_mine ? 'message-bubble--self' : 'message-bubble--peer'}`}
                    key={message.message_id}
                  >
                    <div className="message-bubble__meta">
                      <span>{message.is_mine ? t('chatThreadYou') : message.sender_alias}</span>
                      <span>{formatThreadTime(message.sent_at, locale)}</span>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
            </div>

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
                  disabled={isBlocked || isClosed || sendMessageMutation.isPending}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder={t('chatThreadComposerPlaceholder')}
                  rows={4}
                  value={composer}
                />
              </Field>
              {sendGuardError ? (
                <Banner tone="warning" title={sendGuardError} />
              ) : null}
              {sendMessageMutation.isError ? (
                <Banner
                  tone="danger"
                  title={t('sendFailedTitle')}
                  actionLabel={t('sendFailedRetry')}
                  onAction={() => sendMessageMutation.reset()}
                >
                  {sendMessageMutation.error instanceof Error
                    ? sendMessageMutation.error.message
                    : t('resourceLoadError')}
                </Banner>
              ) : null}
              <div className="composer__footer">
                <Button
                  disabled={isBlocked || isClosed || sendMessageMutation.isPending || !composer.trim()}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  {t('chatThreadSendAction')}
                </Button>
              </div>
            </form>
          </Card>
        </section>
      </div>
    </main>
  );
}
