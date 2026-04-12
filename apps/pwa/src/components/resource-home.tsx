'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { createAnonymousSession } from '@/lib/api';
import { getSessionLabel, getTypeLabel, resourceFilterTypes } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import { setSession } from '@/lib/slices/auth-slice';
import {
  completeOnboarding,
  setLanguage,
  setZipCode,
  toggleBookmark,
  toggleLowBandwidth,
} from '@/lib/slices/preferences-slice';
import type { ResourceFilterType } from '@/lib/types';

const supportedLanguages = ['en', 'es', 'zh'] as const;

export function ResourceHome() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const community = useAppSelector((state) => state.community);
  const [openNow, setOpenNow] = useState(false);
  const [today, setToday] = useState(false);
  const [type, setType] = useState<ResourceFilterType>('all');
  const [submittingSession, setSubmittingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  const resourceQuery = useResources(
    {
      zip: preferences.zipCode,
      openNow,
      today,
      type,
      limit: 20,
    },
    preferences.onboardingComplete && /^\d{5}$/.test(preferences.zipCode),
  );

  const resourceItems = resourceQuery.data?.items ?? [];
  const activeLanguage = preferences.language;
  const sessionLabel = session ? getSessionLabel(activeLanguage, session.user.level) : t('sessionAnonymous');
  const nearbyCount = useMemo(() => resourceItems.length, [resourceItems]);

  const handleCreateAnonymousSession = async () => {
    setSessionError(null);
    setSubmittingSession(true);

    try {
      const response = await createAnonymousSession();
      dispatch(setSession(response));
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : t('anonymousSessionError'));
    } finally {
      setSubmittingSession(false);
    }
  };

  return (
    <main className="shell">
      <div className="shell__inner">
        <section className="hero hero--home">
          <div className="hero__topbar">
            <span className="hero__eyebrow">{t('heroEyebrow')}</span>
          </div>

          <h1>{t('heroTitle')}</h1>
          <p>{t('heroCopy')}</p>

          <div className="hero__meta">
            <span className="meta-chip">{sessionLabel}</span>
            {session ? <span className="meta-chip">{t('sessionIdChip', { userId: session.user.user_id })}</span> : null}
            {preferences.zipCode ? <span className="meta-chip">{t('zipChip', { zip: preferences.zipCode })}</span> : null}
            {community.currentCommunityId ? <span className="meta-chip">{t('homeCommunityReady')}</span> : null}
          </div>

          <div className="actions">
            <button
              className="button button--primary"
              data-testid="create-session"
              disabled={submittingSession}
              onClick={() => void handleCreateAnonymousSession()}
              type="button"
            >
              {submittingSession ? t('creatingSession') : t('createSession')}
            </button>
            <Link className="button button--secondary" href="/verify">
              {t('goVerify')}
            </Link>
            <ContactInboxLink />
          </div>

          {sessionError ? <p className="status-copy status-copy--error">{sessionError}</p> : null}
        </section>

        <section className="card card--onboarding">
          <div className="section-head">
            <div>
              <h2>{t('onboardingTitle')}</h2>
              <p className="card__subtitle">{t('onboardingCopy')}</p>
            </div>
          </div>

          <div className="language-row">
            {supportedLanguages.map((language) => (
              <button
                className={`pill ${preferences.language === language ? 'pill--active' : ''}`}
                key={language}
                onClick={() => dispatch(setLanguage(language))}
                type="button"
              >
                {language.toUpperCase()}
              </button>
            ))}
          </div>

          <form
            className="search-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!/^\d{5}$/.test(preferences.zipCode)) {
                setZipError(t('zipValidation'));
                return;
              }
              setZipError(null);
              dispatch(completeOnboarding());
            }}
          >
            <label className="field">
              <span>{t('zipLabel')}</span>
              <input
                inputMode="numeric"
                maxLength={5}
                onChange={(event) => {
                  setZipError(null);
                  dispatch(setZipCode(event.target.value.replace(/\D/g, '').slice(0, 5)));
                }}
                placeholder={t('zipPlaceholder')}
                value={preferences.zipCode}
              />
            </label>
            {zipError ? <p className="status-copy status-copy--error">{zipError}</p> : null}

            <label className="checkbox">
              <input checked={preferences.lowBandwidth} onChange={() => dispatch(toggleLowBandwidth())} type="checkbox" />
              <span>{t('lowBandwidth')}</span>
            </label>

            <button className="button button--primary" data-testid="see-nearby" type="submit">
              {t('seeNearby')}
            </button>
          </form>
        </section>

        <section className="card card--community-cta">
          <div className="section-head">
            <div>
              <h2>{t('communityTitle')}</h2>
              <p className="card__subtitle">{t('homeCommunityCopy')}</p>
            </div>
          </div>
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
            <Link className="button button--secondary" href="/community">
              {t('communityFeedHeading')}
            </Link>
            <ContactInboxLink />
          </div>
        </section>

        <section className="card card--results">
          <div className="section-head">
            <div>
              <h2>{t('searchTitle')}</h2>
              <p className="card__subtitle">
                {nearbyCount > 0 ? t('resultCount', { count: nearbyCount }) : t('resultTitle')}
              </p>
            </div>
          </div>

          <div className="filter-row">
            <label className="checkbox">
              <input checked={openNow} onChange={() => setOpenNow((value) => !value)} type="checkbox" />
              <span>{t('filtersOpenNow')}</span>
            </label>
            <label className="checkbox">
              <input checked={today} onChange={() => setToday((value) => !value)} type="checkbox" />
              <span>{t('filtersToday')}</span>
            </label>
            <label className="field field--select">
              <span>{t('filtersType')}</span>
              <select onChange={(event) => setType(event.target.value as ResourceFilterType)} value={type}>
                {resourceFilterTypes.map((option) => (
                  <option key={option} value={option}>
                    {getTypeLabel(activeLanguage, option)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {resourceQuery.isLoading ? <p className="status-copy">{t('resourceLoadingList')}</p> : null}
          {resourceQuery.isError ? (
            <p className="status-copy status-copy--error">
              {resourceQuery.error instanceof Error ? resourceQuery.error.message : t('resourceLoadError')}
            </p>
          ) : null}
          {resourceQuery.data?.source_mode === 'fixture' ? <p className="status-copy">{t('sampleMode')}</p> : null}

          {!resourceQuery.isLoading && resourceItems.length === 0 ? (
            <div className="result-empty">{t('noResults')}</div>
          ) : null}

          <div className="resource-grid">
            {resourceItems.map((resource) => {
              const bookmarked = preferences.bookmarks.includes(resource.provider_id);

              return (
                <article className="resource-card" key={resource.provider_id}>
                  <div className="resource-card__meta">
                    <span className="meta-chip">{getTypeLabel(activeLanguage, resource.type)}</span>
                    {resource.distance_miles !== null ? (
                      <span className="meta-chip">{t('distanceMiles', { distance: resource.distance_miles.toFixed(1) })}</span>
                    ) : null}
                    {resource.is_open_now ? <span className="meta-chip meta-chip--accent">{t('filtersOpenNow')}</span> : null}
                  </div>
                  <h3>{resource.name}</h3>
                  <p>{resource.address}</p>
                  <p className="resource-card__subtle">
                    {resource.source_label ?? resource.source}
                    {resource.phone ? ` · ${resource.phone}` : ''}
                  </p>

                  <div className="actions actions--stack">
                    <Link
                      className="button button--secondary"
                      data-testid={`resource-detail-${resource.provider_id}`}
                      href={`/resources/${resource.provider_id}`}
                    >
                      {t('detailCta')}
                    </Link>
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
                      data-testid={`bookmark-${resource.provider_id}`}
                      onClick={() => dispatch(toggleBookmark(resource.provider_id))}
                      type="button"
                    >
                      {bookmarked ? t('bookmarked') : t('save')}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
