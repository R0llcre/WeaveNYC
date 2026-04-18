'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { TopBar } from '@/components/shell';
import {
  Banner,
  Card,
  EmptyState,
  Inline,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { useAppSelector, useMyPosts } from '@/lib/hooks';
import {
  getCategoryLabel,
  getPostStatusLabel,
  getPostTypeLabel,
} from '@/lib/i18n';
import { selectPreferences, selectSession } from '@/lib/selectors';
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
  const postsQuery = useMyPosts(session?.access_token, {}, Boolean(session));

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitlePostsMine')} \u2014 WeaveNYC`;
  }, [t]);

  const items = useMemo<readonly PostSummary[]>(
    () => postsQuery.data?.items ?? [],
    [postsQuery.data?.items],
  );

  const showEmpty = !postsQuery.isLoading && !postsQuery.isError && items.length === 0;
  const showList = !postsQuery.isLoading && !postsQuery.isError && items.length > 0;

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
                postsQuery.error instanceof Error
                  ? postsQuery.error.message
                  : t('resourceLoadError')
              }
            />
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
