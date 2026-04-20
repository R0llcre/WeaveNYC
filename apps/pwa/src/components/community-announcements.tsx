'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Banner, Card } from '@/components/ui';
import { useCommunityAnnouncements } from '@/lib/hooks';
import {
  filterVisibleAnnouncements,
  loadCachedAnnouncements,
  saveCachedAnnouncements,
} from '@/lib/persistence';
import type { CachedAnnouncementsValue, CommunityAnnouncement, SupportedLanguage } from '@/lib/types';

type CommunityAnnouncementsProps = {
  accessToken: string | null | undefined;
  communityId: string | null;
  communityName: string | null;
  isOnline: boolean;
  language: SupportedLanguage;
  p2pEnabled: boolean;
  cacheSignal?: string | null;
};

function getAnnouncementTimestamp(announcement: CommunityAnnouncement) {
  return announcement.published_at ?? announcement.updated_at ?? announcement.created_at ?? null;
}

function formatAnnouncementTimestamp(value: string | null, language: SupportedLanguage) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function CommunityAnnouncements({
  accessToken,
  communityId,
  communityName,
  isOnline,
  language,
  p2pEnabled,
  cacheSignal,
}: CommunityAnnouncementsProps) {
  const t = useTranslations();
  const query = useCommunityAnnouncements(accessToken, communityId, Boolean(accessToken) && Boolean(communityId));
  const [cachedAnnouncements, setCachedAnnouncements] = useState<CachedAnnouncementsValue | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!communityId || !p2pEnabled) {
      setCachedAnnouncements(null);
      return;
    }

    void (async () => {
      const nextCache = await loadCachedAnnouncements(communityId);
      if (!cancelled) {
        setCachedAnnouncements(nextCache);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheSignal, communityId, p2pEnabled]);

  useEffect(() => {
    if (!communityId || !query.data || !p2pEnabled) {
      return;
    }

    const nextCache: CachedAnnouncementsValue = {
      communityId,
      items: query.data.items,
      next_cursor: query.data.next_cursor,
      updatedAt: new Date().toISOString(),
      source: 'network',
    };

    setCachedAnnouncements(nextCache);
    void saveCachedAnnouncements(nextCache);
  }, [communityId, p2pEnabled, query.data]);

  // Tombstones remain in cache for p2p_version comparison but must be
  // excluded from the visible feed (see persistence.ts
  // `filterVisibleAnnouncements`).
  const cachedVisibleAnnouncements = filterVisibleAnnouncements(cachedAnnouncements?.items);
  const usingCachedAnnouncements = Boolean(
    p2pEnabled &&
    communityId &&
      cachedAnnouncements &&
      (query.isError || !isOnline) &&
      cachedVisibleAnnouncements.length > 0,
  );
  const orderedAnnouncements = usingCachedAnnouncements
    ? cachedVisibleAnnouncements
    : query.data?.items ?? [];
  const bannerAnnouncement = orderedAnnouncements[0] ?? null;
  const remainingAnnouncements = orderedAnnouncements.slice(1);
  const bannerTimestamp = bannerAnnouncement
    ? formatAnnouncementTimestamp(getAnnouncementTimestamp(bannerAnnouncement), language)
    : null;

  if (!accessToken || !communityId) {
    return null;
  }

  return (
    <Card className="card--results card--community-announcements">
      <div className="section-head">
        <div>
          <h2>{t('communityAnnouncementsHeading')}</h2>
          <p className="card__subtitle">
            {communityName ? t('communityAnnouncementsCopy', { communityName }) : t('communityAnnouncementsNoCommunity')}
          </p>
        </div>
        <span className="meta-chip meta-chip--accent">{t('communityAnnouncementsBannerLabel')}</span>
      </div>

      {usingCachedAnnouncements && cachedAnnouncements ? (
        <Banner
          tone="info"
          title={t('p2pCacheBadge')}
        >
          <span>{t('announcementsOfflineFallback', { updatedAt: formatAnnouncementTimestamp(cachedAnnouncements.updatedAt, language) ?? cachedAnnouncements.updatedAt })}</span>
        </Banner>
      ) : null}

      {query.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
      {query.isError ? (
        <p className="status-copy status-copy--error">
          {usingCachedAnnouncements
            ? t('p2pLiveRefreshDelayed')
            : query.error instanceof Error
              ? query.error.message
              : t('resourceLoadError')}
        </p>
      ) : null}

      {!query.isLoading && !query.isError && !bannerAnnouncement ? (
        <div className="result-empty">{t('communityAnnouncementsEmpty')}</div>
      ) : null}

      {bannerAnnouncement ? (
        <article className="announcement-banner">
          <div className="announcement-banner__meta">
            <div className="meta-strip">
              {bannerAnnouncement.is_pinned ? (
                <span className="meta-chip meta-chip--accent">{t('communityAnnouncementsPinnedLabel')}</span>
              ) : null}
              {bannerTimestamp ? <span className="meta-chip">{bannerTimestamp}</span> : null}
            </div>
          </div>
          <h3>{bannerAnnouncement.title}</h3>
          <p>{bannerAnnouncement.body}</p>
        </article>
      ) : null}

      {remainingAnnouncements.length > 0 ? (
        <div className="announcement-list">
          <h3 className="announcement-list__heading">{t('communityAnnouncementsListHeading')}</h3>
          <div className="announcement-items">
            {remainingAnnouncements.map((announcement) => {
              const announcementTimestamp = formatAnnouncementTimestamp(getAnnouncementTimestamp(announcement), language);

              return (
                <article className="announcement-item" key={announcement.announcement_id}>
                  <div className="announcement-item__head">
                    <div className="meta-strip">
                      {announcement.is_pinned ? (
                        <span className="meta-chip meta-chip--accent">{t('communityAnnouncementsPinnedLabel')}</span>
                      ) : null}
                      {announcementTimestamp ? <span className="meta-chip">{announcementTimestamp}</span> : null}
                    </div>
                  </div>
                  <h4 className="announcement-item__title">{announcement.title}</h4>
                  <p className="announcement-item__body">{announcement.body}</p>
                </article>
              );
            })}
          </div>
        </div>
      ) : bannerAnnouncement ? (
        <div className="result-empty">{t('communityAnnouncementsMoreEmpty')}</div>
      ) : null}
    </Card>
  );
}
