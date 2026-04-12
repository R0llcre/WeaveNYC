'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { CommunityAnnouncements } from '@/components/community-announcements';
import { createAnonymousSession } from '@/lib/api';
import { useAppDispatch, useAppSelector, usePosts } from '@/lib/hooks';
import { setSession } from '@/lib/slices/auth-slice';
import { setCurrentCommunity } from '@/lib/slices/community-slice';
import { PostCard } from '@/components/post-card';

export function CommunityScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const preferences = useAppSelector((state) => state.preferences);
  const communityState = useAppSelector((state) => state.community);
  const [tab, setTab] = useState<'community' | 'public'>('community');
  const [creatingSession, setCreatingSession] = useState(false);
  const currentCommunity = useMemo(
    () =>
      communityState.joinedCommunities.find(
        (item) => item.community.community_id === communityState.currentCommunityId,
      )?.community ?? null,
    [communityState.currentCommunityId, communityState.joinedCommunities],
  );

  const posts = usePosts(
    session?.access_token,
    {
      scope: tab,
      communityId: tab === 'community' ? currentCommunity?.community_id : currentCommunity?.community_id ?? undefined,
      limit: 20,
    },
    Boolean(session) && (tab === 'public' || Boolean(currentCommunity)),
  );

  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      dispatch(setSession(await createAnonymousSession()));
    } finally {
      setCreatingSession(false);
    }
  };

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('communityTitle')}</span>
            <Link className="hero__link" href="/">
              {t('backHome')}
            </Link>
          </div>
          <h1>{t('communityTitle')}</h1>
          <p>{t('communityCopy')}</p>
          <div className="actions">
            <Link className="button button--primary" data-testid="join-community" href="/community/join">
              {t('joinCommunityCta')}
            </Link>
            <Link className="button button--secondary" data-testid="request-help" href="/posts/new?post_type=request">
              {t('requestHelpCta')}
            </Link>
            <Link className="button button--secondary" data-testid="offer-help" href="/posts/new?post_type=offer">
              {t('offerHelpCta')}
            </Link>
            <Link className="button button--secondary" href="/posts/mine">
              {t('myPostsTitle')}
            </Link>
            <ContactInboxLink />
          </div>
        </section>

        {!session ? (
          <section className="card card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <button
                className="button button--primary"
                data-testid="create-session"
                disabled={creatingSession}
                onClick={() => void handleCreateSession()}
                type="button"
              >
                {creatingSession ? t('creatingSession') : t('createSession')}
              </button>
            </div>
          </section>
        ) : null}

        <CommunityAnnouncements
          accessToken={session?.access_token}
          communityId={currentCommunity?.community_id ?? null}
          communityName={currentCommunity?.name ?? null}
          language={preferences.language}
        />

        <section className="card card--results">
          <div className="section-head">
            <div>
              <h2>{t('communityFeedHeading')}</h2>
              <p className="card__subtitle">
                {currentCommunity ? `${t('currentCommunityLabel')}: ${currentCommunity.name}` : t('communityNoMembership')}
              </p>
            </div>
          </div>

          {communityState.joinedCommunities.length > 0 ? (
            <div className="language-row">
              {communityState.joinedCommunities.map((item) => (
                <button
                  key={item.community.community_id}
                  className={`pill ${communityState.currentCommunityId === item.community.community_id ? 'pill--active' : ''}`}
                  onClick={() => dispatch(setCurrentCommunity(item.community.community_id))}
                  type="button"
                >
                  {item.community.name}
                </button>
              ))}
            </div>
          ) : null}

          <div className="tab-row">
            <button
              className={`pill ${tab === 'community' ? 'pill--active' : ''}`}
              data-testid="community-tab"
              onClick={() => setTab('community')}
              type="button"
            >
              {t('communityTab')}
            </button>
            <button
              className={`pill ${tab === 'public' ? 'pill--active' : ''}`}
              data-testid="public-tab"
              onClick={() => setTab('public')}
              type="button"
            >
              {t('publicTab')}
            </button>
          </div>

          {tab === 'community' && !currentCommunity ? (
            <div className="result-empty">
              <p>{t('communityNoMembership')}</p>
              <Link className="button button--primary" href="/community/join">
                {t('joinCommunityCta')}
              </Link>
            </div>
          ) : null}

          {posts.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
          {posts.isError ? (
            <p className="status-copy status-copy--error">
              {posts.error instanceof Error ? posts.error.message : t('resourceLoadError')}
            </p>
          ) : null}

          {posts.data?.items.length === 0 ? (
            <div className="result-empty">{t('postsEmpty')}</div>
          ) : null}

          <div className="resource-grid">
            {posts.data?.items.map((post) => (
              <PostCard href={`/posts/${post.post_id}`} key={post.post_id} language={preferences.language} post={post} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
