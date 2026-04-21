'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Inline,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { resolveErrorKey } from '@/lib/error-i18n';
import { useAppSelector, useMyPosts } from '@/lib/hooks';
import {
  getCategoryLabel,
  getPostStatusLabel,
  getPostTypeLabel,
} from '@/lib/i18n';
import {
  enqueuePendingPost,
  listPendingPosts,
  removePendingPost,
  type PendingPostEntry,
} from '@/lib/persistence';
import { selectCommunity, selectPreferences, selectSession } from '@/lib/selectors';
import type { PostStatus, PostSummary, SupportedLanguage } from '@/lib/types';

const STATUS_TONE: Record<PostStatus, 'verified' | 'urgent' | 'neutral' | 'accent'> = {
  active: 'verified',
  pending_review: 'urgent',
  closed: 'neutral',
  removed: 'neutral',
  draft: 'accent',
  fulfilled: 'verified',
};

/**
 * W4A — "My posts" list.
 *
 * Removes the four flat status sections and instead renders a single stacked
 * list of `<Card>` rows, each row carrying:
 *   - a status `<Tag>` (verified for active, urgent for pending_review, etc.)
 *   - a type + category tag pair
 *   - title (h3) + excerpted body
 *   - ZIP + expiry chips
 *
 * Zero data triggers `<EmptyState>` with the shared `posts-empty` illustration
 * and a "Create post" CTA that links to the composer. Loading shows three
 * skeleton rows; errors surface as a `<Banner tone="danger">`.
 *
 * The PostCard legacy component is no longer imported so the screen sheds its
 * .post-card CSS coupling.
 */
export function MyPostsScreen() {
  const t = useTranslations();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const communityState = useAppSelector(selectCommunity);
  const currentCommunityId = communityState.currentCommunityId;
  const postsQuery = useMyPosts(session?.access_token, {}, Boolean(session));

  // Pending (queued offline) posts for the user's current community. We
  // read them from IndexedDB on mount + whenever the user comes back to
  // this screen. The outbox drain (useOutboxDrain) removes entries as
  // they successfully publish; re-reading on visibility keeps the list
  // in sync without wiring up a pub/sub channel from IDB.
  const [pendingEntries, setPendingEntries] = useState<PendingPostEntry[]>([]);

  const refreshPending = useCallback(async () => {
    const scope = currentCommunityId ?? undefined;
    setPendingEntries(await listPendingPosts(scope));
  }, [currentCommunityId]);

  useEffect(() => {
    void refreshPending();

    // Re-poll IDB on visibility so the list stays fresh when the drain
    // hook (mounted in ShellFrame) removes entries while the user is on
    // another tab. Polling on `online` for the same reason.
    const handle = () => void refreshPending();
    window.addEventListener('online', handle);
    document.addEventListener('visibilitychange', handle);
    return () => {
      window.removeEventListener('online', handle);
      document.removeEventListener('visibilitychange', handle);
    };
  }, [refreshPending]);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitlePostsMine')} \u2014 WeaveNYC`;
  }, [t]);

  const items = useMemo<readonly PostSummary[]>(
    () => postsQuery.data?.items ?? [],
    [postsQuery.data?.items],
  );

  const showEmpty =
    !postsQuery.isLoading &&
    !postsQuery.isError &&
    items.length === 0 &&
    pendingEntries.length === 0;
  const showList = !postsQuery.isLoading && !postsQuery.isError && items.length > 0;

  const handleRetry = useCallback(
    async (entry: PendingPostEntry) => {
      // "Retry now" clears the permanent flag by overwriting the row with
      // last_failure_permanent=false — the next drain trigger will pick it
      // up. We also drop last_error so the UI visually transitions from
      // "Failed" back to "Queued". The drain itself runs on `online` /
      // visibility / mount so dispatching a synthetic online-style event
      // isn't necessary — the user can leave the screen and the drain will
      // walk the queue next time it fires.
      await enqueuePendingPost({
        ...entry,
        last_error: null,
        last_failure_permanent: false,
      });
      await refreshPending();
    },
    [refreshPending],
  );

  const handleDiscard = useCallback(
    async (entry: PendingPostEntry) => {
      await removePendingPost(entry.client_id);
      await refreshPending();
    },
    [refreshPending],
  );

  return (
    <>
      <TopBar
        variant="page"
        eyebrow={t('pageTitlePostsMine')}
        title={t('myPostsTitle')}
        backHref="/community"
      />
      <div className="page-content" data-screen="my-posts">
        <Stack gap={4} as="section">
          <p className="muted">{t('myPostsCopy')}</p>

          {postsQuery.isError ? (
            <Banner
              tone="danger"
              title={
                postsQuery.error
                  ? t(resolveErrorKey(postsQuery.error))
                  : t('resourceLoadError')
              }
            />
          ) : null}

          {pendingEntries.length > 0 ? (
            <Stack gap={3} data-testid="my-posts-pending-section">
              <Stack gap={1}>
                <span className="overline">{t('outboxPendingHeading')}</span>
                <p className="muted">{t('outboxPendingHint')}</p>
              </Stack>
              <Stack gap={3}>
                {pendingEntries.map((entry) => (
                  <PendingRow
                    key={entry.client_id}
                    entry={entry}
                    language={preferences.language}
                    failedCopy={t('outboxFailedHint', {
                      error: entry.last_error
                        ? t(resolveErrorKey(new Error(entry.last_error)))
                        : '',
                    })}
                    pendingCopy={t('outboxPendingHint')}
                    retryLabel={t('outboxRetryAction')}
                    discardLabel={t('outboxDiscardAction')}
                    pendingTagLabel={t('outboxPendingHeading')}
                    onRetry={() => void handleRetry(entry)}
                    onDiscard={() => void handleDiscard(entry)}
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}

          {postsQuery.isLoading ? (
            <div
              role="status"
              aria-busy="true"
              aria-label={t('loadingLabel')}
              data-testid="my-posts-loading"
            >
              <Stack gap={3}>
                {[0, 1, 2].map((idx) => (
                  <Card key={idx}>
                    <Stack gap={2}>
                      <Skeleton
                        variant="text"
                        width="55%"
                        label={idx === 0 ? t('postsLoading') : undefined}
                      />
                      <Skeleton variant="text" width="85%" />
                      <Skeleton variant="text" width="30%" />
                    </Stack>
                  </Card>
                ))}
              </Stack>
            </div>
          ) : null}

          {showEmpty ? (
            <EmptyState
              illustrationName="posts-empty"
              title={t('emptyStatePostsTitle')}
              subtitle={t('emptyStatePostsSubtitle')}
              cta={{
                label: t('emptyStatePostsCta'),
                href: '/posts/new',
                testId: 'my-posts-empty-cta',
              }}
            />
          ) : null}

          {showList ? (
            <Stack gap={3}>
              {items.map((post) => (
                <PostRow key={post.post_id} post={post} language={preferences.language} />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </div>
    </>
  );
}

/**
 * Render a single pending outbox entry. Visually distinct from published
 * rows: no anchor (nothing to navigate to yet), muted tone, warning Tag,
 * inline Retry/Discard actions. Copy is resolved by the parent so the
 * row itself doesn't need the `useTranslations` hook.
 */
function PendingRow({
  entry,
  language,
  failedCopy,
  pendingCopy,
  retryLabel,
  discardLabel,
  pendingTagLabel,
  onRetry,
  onDiscard,
}: {
  entry: PendingPostEntry;
  language: SupportedLanguage;
  failedCopy: string;
  pendingCopy: string;
  retryLabel: string;
  discardLabel: string;
  pendingTagLabel: string;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const title = entry.payload.title || '\u2014';
  const excerpt =
    entry.payload.body.length > 120
      ? `${entry.payload.body.slice(0, 120)}\u2026`
      : entry.payload.body;
  const failed = entry.last_failure_permanent === true;

  return (
    <Card as="article" data-testid={`my-post-pending-${entry.client_id}`}>
      <Stack gap={2}>
        <Inline gap={2} wrap>
          <Tag tone="warning">{pendingTagLabel}</Tag>
          <Tag tone={entry.payload.postType === 'offer' ? 'verified' : 'community'}>
            {getPostTypeLabel(language, entry.payload.postType)}
          </Tag>
          <Tag tone="accent">{getCategoryLabel(language, entry.payload.category)}</Tag>
        </Inline>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {excerpt ? <p className="muted">{excerpt}</p> : null}
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {failed ? failedCopy : pendingCopy}
        </p>
        <Inline gap={2} wrap>
          {failed ? (
            <Button
              data-testid={`pending-retry-${entry.client_id}`}
              onClick={onRetry}
              size="sm"
              variant="secondary"
            >
              {retryLabel}
            </Button>
          ) : null}
          <Button
            data-testid={`pending-discard-${entry.client_id}`}
            onClick={onDiscard}
            size="sm"
            variant="ghost"
          >
            {discardLabel}
          </Button>
        </Inline>
      </Stack>
    </Card>
  );
}

/**
 * Rendered as a semantic `<a>` so the whole row is a single tap target and
 * screen readers announce one navigable item per post (avoids the "two
 * interactive elements per card" WCAG concern).
 */
function PostRow({
  post,
  language,
}: {
  post: PostSummary;
  language: SupportedLanguage;
}) {
  const statusTone = STATUS_TONE[post.status] ?? 'neutral';
  const excerpt = post.body.length > 120 ? `${post.body.slice(0, 120)}\u2026` : post.body;

  return (
    <Card as="article">
      <a
        href={`/posts/${post.post_id}`}
        data-testid={`my-post-${post.post_id}`}
        style={{ color: 'inherit', textDecoration: 'none', display: 'block' }}
      >
        <Stack gap={2}>
          <Inline gap={2} wrap>
            <Tag tone={statusTone}>{getPostStatusLabel(language, post.status)}</Tag>
            <Tag tone={post.post_type === 'offer' ? 'verified' : 'community'}>
              {getPostTypeLabel(language, post.post_type)}
            </Tag>
            <Tag tone="accent">{getCategoryLabel(language, post.category)}</Tag>
          </Inline>
          <h3 style={{ margin: 0 }}>{post.title}</h3>
          {excerpt ? <p className="muted">{excerpt}</p> : null}
          <Inline gap={2} wrap>
            <Tag tone="neutral">{post.location_zip}</Tag>
            <Tag tone="neutral">{new Date(post.expires_at).toLocaleDateString()}</Tag>
          </Inline>
        </Stack>
      </a>
    </Card>
  );
}
