'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { ContactInboxLink } from '@/components/contact-inbox-link';
import { Banner, Button, Card, Checkbox, Field, PageHeader } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { getSessionLabel, getTypeLabel, resourceFilterTypes } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import { setSession } from '@/lib/slices/auth-slice';
import { toggleBookmark } from '@/lib/slices/preferences-slice';
import type { ResourceFilterType } from '@/lib/types';

export function ResourceHome() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector((state) => state.preferences);
  const session = useAppSelector((state) => state.auth.session);
  const community = useAppSelector((state) => state.community);
  const [openNow, setOpenNow] = useState(false);
  const [today, setToday] = useState(false);
  const [type, setType] = useState<ResourceFilterType>('all');
  const [submittingSession, setSubmittingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // First-visit guard: push new users through the onboarding language/location
  // flow. We defer the redirect by a tick so the async hydration in
  // `providers.tsx` has a chance to repopulate preferences from IndexedDB
  // before we decide whether onboarding was already completed. Without this
  // defer, a page reload could race the guard and bounce a returning user
  // back to /onboarding/language even though their preferences are saved.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      if (!preferences.onboardingComplete && !preferences.zipCode) {
        router.replace('/onboarding/language');
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [preferences.onboardingComplete, preferences.zipCode, router]);

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
        <PageHeader
          eyebrow={t('heroEyebrow')}
          title={t('heroTitle')}
          subtitle={t('heroCopy')}
          actions={
            <>
              <div className="hero__meta">
                <span className="meta-chip">{sessionLabel}</span>
                {session ? (
                  <span className="meta-chip">{t('sessionIdChip', { userId: session.user.user_id })}</span>
                ) : null}
                {preferences.zipCode ? (
                  <span className="meta-chip">{t('zipChip', { zip: preferences.zipCode })}</span>
                ) : null}
                {community.currentCommunityId ? (
                  <span className="meta-chip">{t('homeCommunityReady')}</span>
                ) : null}
              </div>
              <Button
                variant="primary"
                size="md"
                data-testid="create-session"
                disabled={submittingSession}
                loading={submittingSession}
                onClick={() => void handleCreateAnonymousSession()}
              >
                {submittingSession ? t('creatingSession') : t('createSession')}
              </Button>
              <Link className="button button--secondary button--md" href="/verify">
                {t('goVerify')}
              </Link>
              <ContactInboxLink />
              <Link className="button button--ghost button--md" href="/settings">
                {t('settingsTitle')}
              </Link>
            </>
          }
        />

        {sessionError ? (
          <Banner tone="danger" title={t('anonymousSessionError')}>
            {sessionError}
          </Banner>
        ) : null}

        <Card as="section" className="card--community-cta">
          <div className="section-head">
            <div>
              <h2>{t('communityTitle')}</h2>
              <p className="card__subtitle">{t('homeCommunityCopy')}</p>
            </div>
          </div>
          <div className="actions">
            <Link className="button button--primary button--md" data-testid="join-community" href="/community/join">
              {t('joinCommunityCta')}
            </Link>
            <Link className="button button--secondary button--md" data-testid="request-help" href="/posts/new?post_type=request">
              {t('requestHelpCta')}
            </Link>
            <Link className="button button--secondary button--md" data-testid="offer-help" href="/posts/new?post_type=offer">
              {t('offerHelpCta')}
            </Link>
            <Link className="button button--ghost button--md" href="/community">
              {t('communityFeedHeading')}
            </Link>
            <ContactInboxLink />
          </div>
        </Card>

        <Card as="section" className="card--results">
          <div className="section-head">
            <div>
              <h2>{t('searchTitle')}</h2>
              <p className="card__subtitle">
                {nearbyCount > 0 ? t('resultCount', { count: nearbyCount }) : t('resultTitle')}
              </p>
            </div>
          </div>

          <div className="filter-row">
            <Checkbox
              label={t('filtersOpenNow')}
              checked={openNow}
              onChange={() => setOpenNow((value) => !value)}
            />
            <Checkbox
              label={t('filtersToday')}
              checked={today}
              onChange={() => setToday((value) => !value)}
            />
            <Field label={t('filtersType')} className="field--select">
              <select onChange={(event) => setType(event.target.value as ResourceFilterType)} value={type}>
                {resourceFilterTypes.map((option) => (
                  <option key={option} value={option}>
                    {getTypeLabel(activeLanguage, option)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {resourceQuery.isLoading ? <p className="status-copy">{t('resourceLoadingList')}</p> : null}
          {resourceQuery.isError ? (
            <Banner tone="danger" title={t('resourceLoadError')}>
              {resourceQuery.error instanceof Error ? resourceQuery.error.message : null}
            </Banner>
          ) : null}
          {resourceQuery.data?.source_mode === 'fixture' ? (
            <p className="status-copy">{t('sampleMode')}</p>
          ) : null}

          {!resourceQuery.isLoading && resourceItems.length === 0 && preferences.zipCode ? (
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
                      <span className="meta-chip">
                        {t('distanceMiles', { distance: resource.distance_miles.toFixed(1) })}
                      </span>
                    ) : null}
                    {resource.is_open_now ? (
                      <span className="meta-chip meta-chip--accent">{t('filtersOpenNow')}</span>
                    ) : null}
                  </div>
                  <h3>{resource.name}</h3>
                  <p>{resource.address}</p>
                  <p className="resource-card__subtle">
                    {resource.source_label ?? resource.source}
                    {resource.phone ? ` · ${resource.phone}` : ''}
                  </p>

                  <div className="actions actions--stack">
                    <Link
                      className="button button--secondary button--md"
                      data-testid={`resource-detail-${resource.provider_id}`}
                      href={`/resources/${resource.provider_id}`}
                    >
                      {t('detailCta')}
                    </Link>
                    {resource.phone ? (
                      <a className="button button--ghost button--md" href={`tel:${resource.phone}`}>
                        {t('call')}
                      </a>
                    ) : null}
                    <a
                      className="button button--ghost button--md"
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
                  </div>
                </article>
              );
            })}
          </div>

          {/* "See nearby" keeps its data-testid for smoke coverage; now it
              refreshes results once the user has completed onboarding. */}
          <div className="actions">
            <Button
              variant="secondary"
              size="md"
              data-testid="see-nearby"
              onClick={() => {
                void resourceQuery.refetch();
              }}
            >
              {t('seeNearby')}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
