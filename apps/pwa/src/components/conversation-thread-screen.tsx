'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useEffectEvent, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { getChatWebSocketUrl } from '@/lib/api';
import {
  useAppSelector,
  useBlockUser,
  useConversation,
  useConversationMessages,
  useCreateReport,
  useSendConversationMessage,
} from '@/lib/hooks';

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

export function ConversationThreadScreen({ conversationId }: ConversationThreadScreenProps) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const [composer, setComposer] = useState('');
  const [reported, setReported] = useState(false);
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
  const handleSocketMessage = useEffectEvent((event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as {
        event_type?: string;
        conversation_id?: string;
        conversation?: { conversation_id?: string };
      };
      if (payload.event_type === 'message.created' && payload.conversation_id === conversationId) {
        void messagesQuery.refetch();
        void conversationQuery.refetch();
        return;
      }

      if (payload.event_type === 'conversation.updated' && payload.conversation?.conversation_id === conversationId) {
        void conversationQuery.refetch();
      }
    } catch {
      // Ignore malformed socket payloads during development.
    }
  });

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    const socket = new WebSocket(getChatWebSocketUrl(session.access_token));
    socket.onmessage = (event) => {
      handleSocketMessage(event);
    };

    return () => {
      socket.close();
    };
  }, [conversationId, handleSocketMessage, session?.access_token]);

  async function handleSend(body: string) {
    if (!body.trim() || isBlocked || isClosed) {
      return;
    }

    await sendMessageMutation.mutateAsync({
      conversationId,
      body,
    });
    setComposer('');
    void messagesQuery.refetch();
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
      <main className="shell">
        <div className="shell__inner">
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Link className="button button--primary" href="/">
                {t('backHome')}
              </Link>
            </div>
          </section>
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
      <main className="shell">
        <div className="shell__inner">
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('composeNeedsVerified')}</p>
              <Link className="button button--primary" href={`/verify?return_to=${returnTo}`}>
                {t('goVerify')}
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('chatThreadTitle')}</span>
            <div className="actions actions--tight">
              <ContactInboxLink />
              <Link className="hero__link" href="/inbox">
                {t('inboxTitle')}
              </Link>
            </div>
          </div>
          <h1>{otherParticipant?.alias ?? t('chatThreadFallbackAlias')}</h1>
          <p>{t('chatThreadCopy')}</p>
          <div className="hero__meta">
            <span className="meta-chip meta-chip--accent">
              {isBlocked ? t('chatThreadBlockedNotice') : isClosed ? t('postsGroup_closed') : t('chatThreadStatusLive')}
            </span>
            <span className="meta-chip">conversation_id: {conversationId}</span>
            {contactRequestId ? <span className="meta-chip">contact_request_id: {contactRequestId}</span> : null}
          </div>
        </section>

        <section className="chat-thread">
          <aside className="card detail-card chat-thread__sidebar">
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
                      <button
                        className="pill"
                        key={phrase}
                        onClick={() => setComposer(phrase)}
                        type="button"
                      >
                        {phrase}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="result-block">
                <strong>{t('chatThreadActionsTitle')}</strong>
                <div className="actions">
                  <button className="button button--secondary" onClick={() => void handleReport()} type="button">
                    {t('chatThreadReportAction')}
                  </button>
                  <button className="button button--secondary" onClick={() => void handleBlock()} type="button">
                    {t('chatThreadBlockAction')}
                  </button>
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
                    <Link className="button button--secondary" href={`/posts/${relatedPostId}`}>
                      {t('contactInboxRelatedPost')}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>

          <section className="card detail-card chat-thread__panel">
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

            <div className="message-list">
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
              <label className="field composer__field">
                <span>{t('chatThreadComposerLabel')}</span>
                <textarea
                  disabled={isBlocked || isClosed || sendMessageMutation.isPending}
                  onChange={(event) => setComposer(event.target.value)}
                  placeholder={t('chatThreadComposerPlaceholder')}
                  rows={4}
                  value={composer}
                />
              </label>
              {sendMessageMutation.isError ? (
                <p className="status-copy status-copy--error">
                  {sendMessageMutation.error instanceof Error ? sendMessageMutation.error.message : t('resourceLoadError')}
                </p>
              ) : null}
              <div className="composer__footer">
                <p className="resource-card__subtle">{t('chatThreadComposerHint')}</p>
                <button
                  className="button button--primary"
                  disabled={isBlocked || isClosed || sendMessageMutation.isPending || !composer.trim()}
                  type="submit"
                >
                  {t('chatThreadSendAction')}
                </button>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
