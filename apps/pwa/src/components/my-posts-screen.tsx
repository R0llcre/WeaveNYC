'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { PostCard } from '@/components/post-card';
import { Card, PageHeader } from '@/components/ui';
import { useAppSelector, useMyPosts } from '@/lib/hooks';

const statusGroups = ['active', 'pending_review', 'closed', 'removed'] as const;

export function MyPostsScreen() {
  const t = useTranslations();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const postsQuery = useMyPosts(session?.access_token, {}, Boolean(session));

  const grouped = Object.fromEntries(
    statusGroups.map((status) => [status, postsQuery.data?.items.filter((item) => item.status === status) ?? []]),
  ) as Record<(typeof statusGroups)[number], NonNullable<typeof postsQuery.data>['items']>;

  return (
    <main className="shell">
      <div className="shell__inner">
        <PageHeader
          eyebrow={t('myPostsTitle')}
          title={t('myPostsTitle')}
          subtitle={t('myPostsCopy')}
          actions={
            <Link className="hero__link" href="/community">
              {t('backHome')}
            </Link>
          }
        />

        <Card className="card--results">
          {postsQuery.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
          {postsQuery.isError ? (
            <p className="status-copy status-copy--error">
              {postsQuery.error instanceof Error ? postsQuery.error.message : t('resourceLoadError')}
            </p>
          ) : null}

          {statusGroups.map((status) => (
            <div className="section-stack" key={status}>
              <div className="section-head">
                <div>
                  <h2>{t(`postsGroup_${status}`)}</h2>
                </div>
              </div>
              {grouped[status].length === 0 ? <div className="result-empty">{t('postsEmptyGroup')}</div> : null}
              <div className="resource-grid">
                {grouped[status].map((post) => (
                  <PostCard href={`/posts/${post.post_id}`} key={post.post_id} language={preferences.language} post={post} />
                ))}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </main>
  );
}
