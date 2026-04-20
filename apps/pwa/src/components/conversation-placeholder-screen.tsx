'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { TopBar } from '@/components/shell';
import { Banner, EmptyState, Inline, Skeleton, Stack, Tag } from '@/components/ui';
import { useAppSelector, useConversationPlaceholder } from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';

type ConversationPlaceholderScreenProps = {
  conversationId: string;
};

/**
 * ConversationPlaceholderScreen — Wave 4B empty-state for a conversation that
 * has no loaded thread yet (e.g. desktop/tablet split view before a row is
 * picked, or a deep link landing on a conversation the placeholder endpoint
 * hasn't resolved).
 *
 * Structure (top → bottom):
 *   1. TopBar (eyebrow + title) with a back link to `/inbox`.
 *   2. Status chip row (meta chips only when placeholder data loaded so
 *      participant/post hints never crowd the empty-state in loading).
 *   3. Body:
 *        - Skeleton tiles while `useConversationPlaceholder` resolves.
 *        - Banner on error (with a retry CTA to re-open the inbox).
 *        - EmptyState with illustration + CTA "Open inbox" once settled.
 *
 * Atoms-first; no bespoke CSS is needed beyond what `empty-state` ships.
 * The screen renders under `AppShell.<main>`, so it only emits a
 * `.page-content` outer wrapper — never its own `<main>`.
 */
export function ConversationPlaceholderScreen({
  conversationId,
}: ConversationPlaceholderScreenProps) {
  const t = useTranslations();
  const session = useAppSelector(selectSession);
  const placeholderQuery = useConversationPlaceholder(
    session?.access_token,
    conversationId,
    Boolean(session?.access_token),
  );
  const placeholder = placeholderQuery.data;

  // Per-route document.title so the browser tab and assistive tech announce
  // "Chat — WeaveNYC" instead of the inherited shell title.
  useEffect(() => {
    document.title = `${t('chatThreadTitle')} \u2014 WeaveNYC`;
  }, [t]);

  return (
    <div className="page-content" data-screen="conversation-placeholder" data-testid="inbox-placeholder">
      <TopBar
        variant="page"
        eyebrow={t('chatInboxTitle')}
        title={t('chatThreadTitle')}
        backHref="/inbox/"
      />

      <Stack gap={5} as="section" aria-labelledby="conversation-placeholder-heading">
        {placeholderQuery.isLoading ? (
          <Stack gap={3} aria-busy="true" aria-label={t('chatThreadLoading')}>
            <Skeleton variant="rect" height={180} label={t('chatThreadLoading')} />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="40%" />
          </Stack>
        ) : null}

        {placeholderQuery.isError ? (
          <Banner
            tone="danger"
            title={t('resourceLoadError')}
            actionLabel={t('sendFailedRetry')}
            onAction={() => void placeholderQuery.refetch()}
          >
            {placeholderQuery.error instanceof Error
              ? placeholderQuery.error.message
              : t('resourceLoadError')}
          </Banner>
        ) : null}

        {!placeholderQuery.isLoading && !placeholderQuery.isError ? (
          <>
            {placeholder && (placeholder.participant_preview.length > 0 || placeholder.related_post_ids.length > 0) ? (
              // Atoms-first: Inline+Tag replaces the raw `.hero__meta` div
              // + `.meta-chip` spans so chip spacing, wrap, and tone tokens
              // stay consistent with the rest of the Wave-4B screens.
              <Inline gap={2} wrap aria-label={t('chatThreadRelatedTitle')}>
                {placeholder.participant_preview.map((participant) => (
                  <Tag key={participant.user_id} tone="neutral">
                    {participant.alias}
                  </Tag>
                ))}
                {placeholder.related_post_ids.map((postId) => (
                  <Tag key={postId} tone="neutral">
                    {t('chatThreadRelatedPostLabel')} {postId}
                  </Tag>
                ))}
              </Inline>
            ) : null}

            <EmptyState
              illustrationName="inbox-empty"
              title={t('emptyStateInboxTitle')}
              subtitle={t('emptyStateInboxSubtitle')}
              cta={{
                label: t('inboxOpenThread'),
                href: '/inbox/',
                variant: 'primary',
              }}
            />
          </>
        ) : null}
      </Stack>
    </div>
  );
}
