'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { Card, PageHeader } from '@/components/ui';
import { useAppSelector, useConversationPlaceholder } from '@/lib/hooks';

type ConversationPlaceholderScreenProps = {
  conversationId: string;
};

export function ConversationPlaceholderScreen({ conversationId }: ConversationPlaceholderScreenProps) {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const session = useAppSelector((state) => state.auth.session);
  const placeholderQuery = useConversationPlaceholder(session?.access_token, conversationId, Boolean(session?.access_token));
  const contactRequestId = searchParams.get('contact_request_id');
  const placeholder = placeholderQuery.data;

  return (
    <main className="shell">
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('conversationPlaceholderTitle')}
          title={t('conversationPlaceholderTitle')}
          subtitle={t('conversationPlaceholderCopy')}
          actions={
            <Link className="hero__link" href="/inbox">
              {t('inboxTitle')}
            </Link>
          }
        />
        <div className="hero__meta">
          <span className="meta-chip">conversation_id: {conversationId}</span>
          {contactRequestId ? <span className="meta-chip">contact_request_id: {contactRequestId}</span> : null}
          <span className="meta-chip meta-chip--accent">{t('conversationPlaceholderStatus')}</span>
        </div>

        <Card variant="raised">
          {placeholderQuery.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
          {placeholderQuery.isError ? (
            <p className="status-copy status-copy--error">
              {placeholderQuery.error instanceof Error ? placeholderQuery.error.message : t('resourceLoadError')}
            </p>
          ) : null}
          {placeholder ? (
            <div className="result-empty">
              <p>{t('conversationPlaceholderCopy')}</p>
              <div className="match-reasons">
                {placeholder.participant_preview.map((participant) => (
                  <span className="meta-chip" key={participant.user_id}>
                    {participant.alias}
                  </span>
                ))}
                {placeholder.related_post_ids.map((postId) => (
                  <span className="meta-chip" key={postId}>
                    post: {postId}
                  </span>
                ))}
              </div>
              <div className="actions">
                <Link className="button button--primary" href="/inbox">
                  {t('inboxTitle')}
                </Link>
                <Link className="button button--secondary" href="/community">
                  {t('backHome')}
                </Link>
              </div>
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
