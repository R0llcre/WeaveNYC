'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { CommunityAnnouncements } from '@/components/community-announcements';
import { Banner, Button, Card, Checkbox, PageHeader, Pill } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { isP2PDevDemoVisible } from '@/lib/p2p-env';
import { useAppDispatch, useAppSelector, useCommunityP2PSync, usePosts } from '@/lib/hooks';
import { loadCachedPosts, saveCachedPosts } from '@/lib/persistence';
import { setSession } from '@/lib/slices/auth-slice';
import { setCurrentCommunity } from '@/lib/slices/community-slice';
import { PostCard } from '@/components/post-card';
import type { CachedPostsValue } from '@/lib/types';

export function CommunityScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) => state.auth.session);
  const preferences = useAppSelector((state) => state.preferences);
  const communityState = useAppSelector((state) => state.community);
  const [tab, setTab] = useState<'community' | 'public'>('community');
  const [creatingSession, setCreatingSession] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [cachedPosts, setCachedPosts] = useState<CachedPostsValue | null>(null);
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
  const p2pSync = useCommunityP2PSync(session?.access_token, currentCommunity?.community_id ?? null);
  const showMdnsDemoToggle = isP2PDevDemoVisible();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncOnlineState = () => {
      setIsOnline(window.navigator.onLine);
    };

    syncOnlineState();
    window.addEventListener('online', syncOnlineState);
    window.addEventListener('offline', syncOnlineState);

    return () => {
      window.removeEventListener('online', syncOnlineState);
      window.removeEventListener('offline', syncOnlineState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!currentCommunity || !p2pSync.status.enabled) {
      setCachedPosts(null);
      return;
    }

    void (async () => {
      const nextCache = await loadCachedPosts(currentCommunity.community_id, tab);
      if (!cancelled) {
        setCachedPosts(nextCache);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentCommunity, p2pSync.status.enabled, p2pSync.status.lastSyncAt, tab]);

  useEffect(() => {
    if (!currentCommunity || !posts.data || !p2pSync.status.enabled) {
      return;
    }

    const nextCache: CachedPostsValue = {
      communityId: currentCommunity.community_id,
      scope: tab,
      items: posts.data.items,
      next_cursor: posts.data.next_cursor,
      updatedAt: new Date().toISOString(),
      source: 'network',
    };

    setCachedPosts(nextCache);
    void saveCachedPosts(nextCache);
  }, [currentCommunity, p2pSync.status.enabled, posts.data, tab]);

  const usingCachedPosts = Boolean(
    p2pSync.status.enabled &&
      currentCommunity &&
      cachedPosts &&
      cachedPosts.items.length > 0 &&
      (!isOnline || posts.isError),
  );
  const visiblePosts = usingCachedPosts ? cachedPosts?.items ?? [] : posts.data?.items ?? [];

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
        <PageHeader
          eyebrow={t('communityTitle')}
          title={t('communityTitle')}
          subtitle={t('communityCopy')}
          backHref="/"
          actions={
            <>
              <Link className="button button--primary button--md" data-testid="join-community" href="/community/join">
                {t('joinCommunityCta')}
              </Link>
              <Link
                className="button button--secondary button--md"
                data-testid="request-help"
                href="/posts/new?post_type=request"
              >
                {t('requestHelpCta')}
              </Link>
              <Link
                className="button button--secondary button--md"
                data-testid="offer-help"
                href="/posts/new?post_type=offer"
              >
                {t('offerHelpCta')}
              </Link>
              <Link className="button button--ghost button--md" href="/posts/mine">
                {t('myPostsTitle')}
              </Link>
              <ContactInboxLink />
            </>
          }
        />

        {!session ? (
          <Card as="section" className="card--verify">
            <div className="result-empty">
              <p>{t('joinNeedsSession')}</p>
              <Button
                variant="primary"
                size="md"
                data-testid="create-session"
                disabled={creatingSession}
                loading={creatingSession}
                onClick={() => void handleCreateSession()}
              >
                {creatingSession ? t('creatingSession') : t('createSession')}
              </Button>
            </div>
          </Card>
        ) : null}

        {currentCommunity ? (
          <Card as="section" className="card--results">
            <div className="section-head">
              <div>
                <h2>{t('p2pSyncTitle')}</h2>
                <p className="card__subtitle">
                  {t('p2pSyncCopy', { communityName: currentCommunity.name })}
                </p>
              </div>
              <span
                className={`status-badge ${
                  p2pSync.status.phase === 'ready' ? 'status-badge--ok' : 'status-badge--error'
                }`}
              >
                {t(`p2pPhase_${p2pSync.status.phase}`)}
              </span>
            </div>

            <div className="sync-card__grid">
              <div className="sync-card__metric">
                <span>{t('p2pTransportLabel')}</span>
                <strong>
                  {p2pSync.status.transportLabel === 'mdns-demo'
                    ? t('p2pTransportMdnsDemo')
                    : t('p2pTransportBootstrap')}
                </strong>
              </div>
              <div className="sync-card__metric">
                <span>{t('p2pPeerCountLabel')}</span>
                <strong>{t('p2pPeerCountValue', { count: p2pSync.status.peerCount })}</strong>
              </div>
              <div className="sync-card__metric">
                <span>{t('p2pLastSyncLabel')}</span>
                <strong>
                  {p2pSync.status.lastSyncAt
                    ? new Date(p2pSync.status.lastSyncAt).toLocaleString()
                    : t('p2pNoSyncYet')}
                </strong>
              </div>
              <div className="sync-card__metric">
                <span>{t('p2pPeerIdLabel')}</span>
                <strong className="sync-card__mono">
                  {p2pSync.status.peerId ?? t('p2pPeerIdPending')}
                </strong>
              </div>
            </div>

            {p2pSync.status.lastError ? (
              <Banner tone="danger" title={t('resourceLoadError')}>
                {p2pSync.status.lastError}
              </Banner>
            ) : null}

            {!isOnline ? (
              <Banner tone="warning" title={t('p2pOfflineMode')} />
            ) : null}

            <div className="actions">
              <Button
                variant="primary"
                size="md"
                disabled={!session}
                onClick={() => {
                  if (p2pSync.status.enabled) {
                    p2pSync.disable();
                    return;
                  }

                  p2pSync.enable();
                }}
              >
                {p2pSync.status.enabled ? t('p2pDisableAction') : t('p2pEnableAction')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={!session || !p2pSync.status.enabled}
                onClick={() => p2pSync.syncNow()}
              >
                {t('p2pSyncNowAction')}
              </Button>
            </div>

            {showMdnsDemoToggle ? (
              <div className="sync-toggle">
                <Checkbox
                  label={t('p2pMdnsToggle')}
                  hint={t('p2pMdnsToggleCopy')}
                  checked={p2pSync.status.mdnsDemoEnabled}
                  onChange={(event) => p2pSync.setMdnsDemoEnabled(event.target.checked)}
                />
              </div>
            ) : null}
          </Card>
        ) : null}

        <CommunityAnnouncements
          accessToken={session?.access_token}
          p2pEnabled={p2pSync.status.enabled}
          cacheSignal={p2pSync.status.lastSyncAt}
          communityId={currentCommunity?.community_id ?? null}
          communityName={currentCommunity?.name ?? null}
          isOnline={isOnline}
          language={preferences.language}
        />

        <Card as="section" className="card--results">
          <div className="section-head">
            <div>
              <h2>{t('communityFeedHeading')}</h2>
              <p className="card__subtitle">
                {currentCommunity
                  ? `${t('currentCommunityLabel')}: ${currentCommunity.name}`
                  : t('communityNoMembership')}
              </p>
            </div>
          </div>

          {communityState.joinedCommunities.length > 0 ? (
            <div className="language-row">
              {communityState.joinedCommunities.map((item) => (
                <Pill
                  key={item.community.community_id}
                  active={communityState.currentCommunityId === item.community.community_id}
                  onClick={() => dispatch(setCurrentCommunity(item.community.community_id))}
                >
                  {item.community.name}
                </Pill>
              ))}
            </div>
          ) : null}

          <div className="tab-row">
            <Pill
              active={tab === 'community'}
              data-testid="community-tab"
              onClick={() => setTab('community')}
            >
              {t('communityTab')}
            </Pill>
            <Pill
              active={tab === 'public'}
              data-testid="public-tab"
              onClick={() => setTab('public')}
            >
              {t('publicTab')}
            </Pill>
          </div>

          {tab === 'community' && !currentCommunity ? (
            <div className="result-empty">
              <p>{t('communityNoMembership')}</p>
              <Link className="button button--primary button--md" href="/community/join">
                {t('joinCommunityCta')}
              </Link>
            </div>
          ) : null}

          {usingCachedPosts && cachedPosts ? (
            <div className="sync-cache-note">
              <span className="meta-chip meta-chip--accent">{t('p2pCacheBadge')}</span>
              <span>{t('postsOfflineFallback', { updatedAt: new Date(cachedPosts.updatedAt).toLocaleString() })}</span>
            </div>
          ) : null}

          {posts.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
          {posts.isError ? (
            <Banner tone="danger" title={t('resourceLoadError')}>
              {usingCachedPosts
                ? t('p2pLiveRefreshDelayed')
                : posts.error instanceof Error
                  ? posts.error.message
                  : null}
            </Banner>
          ) : null}

          {visiblePosts.length === 0 ? (
            <div className="result-empty">{t('postsEmpty')}</div>
          ) : null}

          <div className="resource-grid">
            {visiblePosts.map((post) => (
              <PostCard
                href={`/posts/${post.post_id}`}
                key={post.post_id}
                language={preferences.language}
                post={post}
              />
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
