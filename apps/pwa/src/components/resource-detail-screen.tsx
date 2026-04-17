'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Banner, Button, Card, PageHeader } from '@/components/ui';
import { useAppDispatch, useAppSelector, useResource } from '@/lib/hooks';
import {
  selectPreferencesBookmarks,
  selectPreferencesLanguage,
  selectPreferencesZipCode,
} from '@/lib/selectors';
import { toggleBookmark } from '@/lib/slices/preferences-slice';

type ResourceDetailScreenProps = {
  providerId: string;
};

export function ResourceDetailScreen({ providerId }: ResourceDetailScreenProps) {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const zipCode = useAppSelector(selectPreferencesZipCode);
  const language = useAppSelector(selectPreferencesLanguage);
  const bookmarks = useAppSelector(selectPreferencesBookmarks);
  const resourceQuery = useResource(providerId, zipCode || undefined);

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleResourceDetail')} \u2014 WeaveNYC`;
  }, [t]);

  const dayLabels: Record<string, Record<typeof language, string>> = {
    mon: { en: 'Mon', es: 'Lun', zh: '周一' },
    tue: { en: 'Tue', es: 'Mar', zh: '周二' },
    wed: { en: 'Wed', es: 'Mié', zh: '周三' },
    thu: { en: 'Thu', es: 'Jue', zh: '周四' },
    fri: { en: 'Fri', es: 'Vie', zh: '周五' },
    sat: { en: 'Sat', es: 'Sáb', zh: '周六' },
    sun: { en: 'Sun', es: 'Dom', zh: '周日' },
  };

  // Unified render: the screen always returns a single `<main>` with a
  // PageHeader and swaps the content slots based on query state. Previously
  // this file early-returned three different `<main>` trees (loading / error
  // / data), which drifted from the rest of the PWA where screens render a
  // single shell and Banners/Cards toggle inside it. Keeping the shell
  // identical across states also means the skip-link and focus target stay
  // stable while the data resolves.
  const resource = resourceQuery.data ?? null;
  const isLoading = resourceQuery.isLoading;
  const isError = !isLoading && (resourceQuery.isError || !resource);
  const bookmarked = resource ? bookmarks.includes(resource.provider_id) : false;

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          eyebrow={resource?.source_label ?? resource?.source ?? t('resourceLoading')}
          title={resource?.name ?? t('resourceLoading')}
          subtitle={resource?.address ?? ''}
          backHref="/"
          actions={
            resource ? (
              <>
                {resource.phone ? (
                  <Button as="a" variant="secondary" size="md" href={`tel:${resource.phone}`}>
                    {t('call')}
                  </Button>
                ) : null}
                <Button
                  as="a"
                  variant="secondary"
                  size="md"
                  href={resource.directions_url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {t('directions')}
                </Button>
                <Button
                  variant={bookmarked ? 'primary' : 'secondary'}
                  size="md"
                  data-testid={`bookmark-${resource.provider_id}`}
                  onClick={() => dispatch(toggleBookmark(resource.provider_id))}
                >
                  {bookmarked ? t('bookmarked') : t('save')}
                </Button>
              </>
            ) : null
          }
        />

        {isLoading ? (
          <Card as="section" className="card--results">
            <p className="status-copy">{t('resourceLoading')}</p>
          </Card>
        ) : null}

        {isError ? (
          <Card as="section" className="card--results">
            <Banner tone="danger" title={t('resourceNotFound')}>
              {resourceQuery.error instanceof Error ? resourceQuery.error.message : null}
            </Banner>
            <div className="actions">
              <Button as="a" variant="ghost" size="md" href="/">
                {t('backHome')}
              </Button>
            </div>
          </Card>
        ) : null}

        {resource ? (
          <section className="grid grid--detail">
            <Card as="article" className="detail-card">
              <h2>{t('hoursTitle')}</h2>
              <div className="hours-list">
                {resource.weekly_hours.map((entry) => (
                  <div className="hours-row" key={entry.day}>
                    <span>{dayLabels[entry.day]?.[language] ?? entry.day.toUpperCase()}</span>
                    <strong>
                      {entry.closed
                        ? t('closedLabel')
                        : entry.windows
                            .map((window) => `${window.opens_at} - ${window.closes_at}`)
                            .join(' / ')}
                    </strong>
                  </div>
                ))}
              </div>
            </Card>

            <Card as="article" className="detail-card">
              <h2>{t('languagesTitle')}</h2>
              <p>{resource.languages.length > 0 ? resource.languages.join(', ') : t('notListed')}</p>
              <h2>{t('notesTitle')}</h2>
              <p>{resource.notes ?? t('noAdditionalNotes')}</p>
              <h2>{t('sourceTitle')}</h2>
              <p>{resource.source_label ?? resource.source}</p>
              {resource.source_url ? (
                <p>
                  <a href={resource.source_url} rel="noreferrer" target="_blank">
                    {resource.source_url}
                  </a>
                </p>
              ) : null}
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}
