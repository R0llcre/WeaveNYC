'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

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
          <section className="card card--results">
            <p className="status-copy">{t('resourceLoading')}</p>
          </section>
        </div>
      </main>
    );
  }

  if (resourceQuery.isError || !resourceQuery.data) {
    return (
      <main className="shell">
        <div className="shell__inner">
          <section className="card card--results">
            <p className="status-copy status-copy--error">
              {resourceQuery.error instanceof Error ? resourceQuery.error.message : t('resourceNotFound')}
            </p>
            <Link className="button button--secondary" href="/">
              {t('backHome')}
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const resource = resourceQuery.data;
  const bookmarked = bookmarks.includes(resource.provider_id);

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--detail">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{resource.source_label ?? resource.source}</span>
            <Link className="hero__link" href="/">
              {t('backHome')}
            </Link>
          </div>
          <h1>{resource.name}</h1>
          <p>{resource.address}</p>
          <div className="actions">
            {resource.phone ? (
              <a className="button button--secondary" href={`tel:${resource.phone}`}>
                {t('call')}
              </a>
            ) : null}
            <a className="button button--secondary" href={resource.directions_url} rel="noreferrer" target="_blank">
              {t('directions')}
            </a>
            <button
              className={`button ${bookmarked ? 'button--primary' : 'button--secondary'}`}
              onClick={() => dispatch(toggleBookmark(resource.provider_id))}
              type="button"
            >
              {bookmarked ? t('bookmarked') : t('save')}
            </button>
          </div>
        </section>

        <section className="grid grid--detail">
          <article className="card detail-card">
            <h2>{t('hoursTitle')}</h2>
            <div className="hours-list">
              {resource.weekly_hours.map((entry) => (
                <div className="hours-row" key={entry.day}>
                  <span>{dayLabels[entry.day]?.[language] ?? entry.day.toUpperCase()}</span>
                  <strong>
                    {entry.closed
                      ? t('closedLabel')
                      : entry.windows.map((window) => `${window.opens_at} - ${window.closes_at}`).join(" / ")}
                  </strong>
                </div>
              ))}
            </div>
          </article>

          <article className="card detail-card">
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
          </article>
        </section>
      </div>
    </main>
  );
}
