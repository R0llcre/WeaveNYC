'use client';

import { useMutation } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import { Banner, Button, Card, Checkbox, Field, PageHeader } from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { getSessionLabel, getTypeLabel, resourceFilterTypes } from '@/lib/i18n';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import {
  selectCommunity,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import { setZipCode, toggleBookmark } from '@/lib/slices/preferences-slice';
import type { ResourceFilterType } from '@/lib/types';

// ContactInboxLink is verified-user-only (renders null for anonymous). Splitting
// it into its own chunk keeps the anonymous-first-visit JS payload smaller and
// defers the contact-requests inbox polling setup until after LCP. `ssr: false`
// is safe because the static-export shell already renders without it.
const ContactInboxLink = dynamic(
  () => import('@/components/contact-inbox-link').then((m) => ({ default: m.ContactInboxLink })),
  { ssr: false },
);

export function ResourceHome() {
  const t = useTranslations();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const community = useAppSelector(selectCommunity);
  const [openNow, setOpenNow] = useState(false);
  const [today, setToday] = useState(false);
  const [type, setType] = useState<ResourceFilterType>('all');

  // Standardise on a React-Query mutation for the anonymous-session bootstrap
  // so the loading/error state follows the same `isPending` / `error` shape as
  // every other async call on the screen. Previously this file carried its own
  // `submittingSession` + `sessionError` flags that duplicated what
  // `useMutation` already exposes, which is exactly the async-naming drift R7
  // flagged.
  const anonymousSessionMutation = useMutation({
    mutationFn: createAnonymousSession,
    onSuccess: (response) => {
      dispatch(setSession(response));
    },
  });
  const sessionError =
    anonymousSessionMutation.error instanceof Error
      ? anonymousSessionMutation.error.message
      : null;

  // F10: per-route document.title so screen readers and the browser tab
  // announce the current page instead of the static layout "WeaveNYC PWA".
  useEffect(() => {
    document.title = `${t('pageTitleHome')} \u2014 WeaveNYC`;
  }, [t]);

  // First-visit guard: push new users through the onboarding language/location
  // flow. We wait for `hydrationComplete` — flipped `true` by the
  // `hydratePreferences` reducer once IndexedDB has repopulated the slice —
  // before making any decision. The previous implementation used a
  // setTimeout(150ms) heuristic that could race the async hydration on
  // slow devices and redirect returning users back to /onboarding/language.
  useEffect(() => {
    if (!preferences.hydrationComplete) return;
    if (!preferences.onboardingComplete && !preferences.zipCode) {
      router.replace('/onboarding/language');
    }
  }, [
    preferences.hydrationComplete,
    preferences.onboardingComplete,
    preferences.zipCode,
    router,
  ]);

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

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
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
                disabled={anonymousSessionMutation.isPending}
                loading={anonymousSessionMutation.isPending}
                onClick={() => anonymousSessionMutation.mutate()}
              >
                {anonymousSessionMutation.isPending
                  ? t('creatingSession')
                  : t('createSession')}
              </Button>
              <Button as="a" variant="secondary" size="md" href="/verify">
                {t('goVerify')}
              </Button>
              <ContactInboxLink />
              <Button as="a" variant="ghost" size="md" href="/settings">
                {t('settingsTitle')}
              </Button>
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
            <Button as="a" variant="primary" size="md" data-testid="join-community" href="/community/join">
              {t('joinCommunityCta')}
            </Button>
            <Button as="a" variant="secondary" size="md" data-testid="request-help" href="/posts/new?post_type=request">
              {t('requestHelpCta')}
            </Button>
            <Button as="a" variant="secondary" size="md" data-testid="offer-help" href="/posts/new?post_type=offer">
              {t('offerHelpCta')}
            </Button>
            <Button as="a" variant="ghost" size="md" href="/community">
              {t('communityFeedHeading')}
            </Button>
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
            <Banner
              tone="info"
              title={t('resourceEmptyTitle', { zip: preferences.zipCode })}
              actionLabel={t('resourceEmptyTryAgain')}
              onAction={() => {
                // Clearing the ZIP returns the list to the empty-state
                // "set a location" view, which matches what a user would
                // want after realising their ZIP has no nearby matches.
                dispatch(setZipCode(''));
              }}
            >
              {t('resourceEmptyBody')}
            </Banner>
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
                    <Button
                      as="a"
                      variant="secondary"
                      size="md"
                      data-testid={`resource-detail-${resource.provider_id}`}
                      href={`/resources/${resource.provider_id}`}
                    >
                      {t('detailCta')}
                    </Button>
                    {resource.phone ? (
                      <Button as="a" variant="ghost" size="md" href={`tel:${resource.phone}`}>
                        {t('call')}
                      </Button>
                    ) : null}
                    <Button
                      as="a"
                      variant="ghost"
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
