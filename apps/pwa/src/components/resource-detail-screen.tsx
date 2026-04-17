'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Banner, Button, Card, PageHeader } from '@/components/ui';
import { useAppDispatch, useAppSelector, useResource } from '@/lib/hooks';
import { toggleBookmark } from '@/lib/slices/preferences-slice';

type ResourceDetailScreenProps = {
  providerId: string;
};

export function ResourceDetailScreen({ providerId }: ResourceDetailScreenProps) {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const zipCode = useAppSelector((state) => state.preferences.zipCode);
  const language = useAppSelector((state) => state.preferences.language);
  const bookmarks = useAppSelector((state) => state.preferences.bookmarks);
  const resourceQuery = useResource(providerId, zipCode || undefined);

  const dayLabels: Record<string, Record<typeof language, string>> = {
    mon: { en: 'Mon', es: 'Lun', zh: '周一' },
    tue: { en: 'Tue', es: 'Mar', zh: '周二' },
    wed: { en: 'Wed', es: 'Mié', zh: '周三' },
    thu: { en: 'Thu', es: 'Jue', zh: '周四' },
    fri: { en: 'Fri', es: 'Vie', zh: '周五' },
    sat: { en: 'Sat', es: 'Sáb', zh: '周六' },
    sun: { en: 'Sun', es: 'Dom', zh: '周日' },
  };

  if (resourceQuery.isLoading) {
    return (
      <main className="shell">
        <div className="shell__inner">
          <Card as="section" className="card--results">
            <p className="status-copy">{t('resourceLoading')}</p>
          </Card>
        </div>
      </main>
    );
  }

  if (resourceQuery.isError || !resourceQuery.data) {
    return (
      <main className="shell">
        <div className="shell__inner">
          <Card as="section" className="card--results">
            <Banner tone="danger" title={t('resourceNotFound')}>
              {resourceQuery.error instanceof Error ? resourceQuery.error.message : null}
            </Banner>
            <div className="actions">
              <Link className="button button--ghost button--md" href="/">
                {t('backHome')}
              </Link>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const resource = resourceQuery.data;
  const bookmarked = bookmarks.includes(resource.provider_id);

  return (
    <main className="shell">
      <div className="shell__inner">
        <PageHeader
          eyebrow={resource.source_label ?? resource.source}
          title={resource.name}
          subtitle={resource.address}
          backHref="/"
          actions={
            <>
              {resource.phone ? (
                <a className="button button--secondary button--md" href={`tel:${resource.phone}`}>
                  {t('call')}
                </a>
              ) : null}
              <a
                className="button button--secondary button--md"
                href={resource.directions_url}
                rel="noreferrer"
                target="_blank"
              >
                {t('directions')}
              </a>
              <Button
                variant={bookmarked ? 'primary' : 'secondary'}
                size="md"
                data-testid={`bookmark-${resource.provider_id}`}
                onClick={() => dispatch(toggleBookmark(resource.provider_id))}
              >
                {bookmarked ? t('bookmarked') : t('save')}
              </Button>
            </>
          }
        />

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
      </div>
    </main>
  );
}
