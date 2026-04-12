'use client';

import { useTranslations } from 'next-intl';

import { useCommunityAnnouncements } from '@/lib/hooks';
import type { CommunityAnnouncement, SupportedLanguage } from '@/lib/types';

type CommunityAnnouncementsProps = {
  accessToken: string | null | undefined;
  communityId: string | null;
  communityName: string | null;
  language: SupportedLanguage;
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
  language,
}: CommunityAnnouncementsProps) {
  const t = useTranslations();
  const query = useCommunityAnnouncements(accessToken, communityId, Boolean(accessToken) && Boolean(communityId));
  const orderedAnnouncements = query.data?.items ?? [];
  const bannerAnnouncement = orderedAnnouncements[0] ?? null;
  const remainingAnnouncements = orderedAnnouncements.slice(1);
  const bannerTimestamp = bannerAnnouncement
    ? formatAnnouncementTimestamp(getAnnouncementTimestamp(bannerAnnouncement), language)
    : null;

  if (!accessToken || !communityId) {
    return null;
  }

  return (
    <section className="card card--results card--community-announcements">
      <div className="section-head">
        <div>
          <h2>{t('communityAnnouncementsHeading')}</h2>
          <p className="card__subtitle">
            {communityName ? t('communityAnnouncementsCopy', { communityName }) : t('communityAnnouncementsNoCommunity')}
          </p>
        </div>
        <span className="meta-chip meta-chip--accent">{t('communityAnnouncementsBannerLabel')}</span>
      </div>

      {query.isLoading ? <p className="status-copy">{t('postsLoading')}</p> : null}
      {query.isError ? (
        <p className="status-copy status-copy--error">
          {query.error instanceof Error ? query.error.message : t('resourceLoadError')}
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
    </section>
  );
}
