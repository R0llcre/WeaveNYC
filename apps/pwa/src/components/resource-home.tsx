'use client';

/**
 * ResourceHome — the Home tab. M8.5 Wave 3A redesign (W3 review close-out).
 *
 * Home does ONE thing: help the user discover nearby help. Everything else
 * has moved to dedicated tabs:
 *   - Language / ZIP pickers → /onboarding/* and /me/settings
 *   - Community join/feed    → /community tab
 *   - Post request/offer     → /post tab
 *   - Bookmarked list        → /me (future wave)
 *
 * Layout: TopBar (brand) → Hero (overline + h1 + subtitle + session CTA) →
 * ZIP status line (Tag + Change ghost link) → Filter pill rail (scroll-snap)
 * → results. Empty states split by cause:
 *   - no ZIP saved   → homeNoZip* keys, CTA routes to /me/settings
 *   - ZIP set, zero  → homeNoResults* keys, CTA routes to /me/settings
 *
 * All layout uses <Stack> / <Inline> atoms so the JSX carries NO dead BEM
 * classes (the former `.home__*` hooks had no matching rules in globals.css
 * and were load-bearing nowhere). The one new CSS addition is `.pill-scroll`,
 * a reusable filter-rail utility with scroll-snap.
 *
 * E2E testids preserved:
 *   - `create-session`       — Hero CTA. Bootstrap is auto-fired on mount;
 *                              the click is a refetch for smoke coverage.
 *   - `see-nearby`           — the "All" filter pill.
 *   - `resource-detail-{id}` — emitted by ResourceCard.
 *   - `bookmark-{id}`        — emitted by ResourceCard.
 *   - `session-chip`         — session id readout (now a Tag atom).
 */

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  Button,
  EmptyState,
  Inline,
  Pill,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { ResourceCard } from '@/components/ui/ResourceCard';
import { TopBar } from '@/components/shell';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import { selectPreferences, selectSession } from '@/lib/selectors';
import { toggleBookmark } from '@/lib/slices/preferences-slice';
import type { ResourceFilterType, ResourceSummary } from '@/lib/types';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useSessionBootstrap } from '@/lib/use-session-bootstrap';

// Redesign filter vocabulary maps onto the backend taxonomy so the wire
// protocol stays unchanged; only the presentation layer shifts.
type HomeFilterKey = 'all' | 'food' | 'meal' | 'fresh' | 'health' | 'housing';

const FILTERS: Array<{ key: HomeFilterKey; type: ResourceFilterType; i18n: string }> = [
  { key: 'all', type: 'all', i18n: 'homeFilterAll' },
  { key: 'food', type: 'pantry', i18n: 'homeFilterFood' },
  { key: 'meal', type: 'kitchen', i18n: 'homeFilterMeal' },
  { key: 'fresh', type: 'market', i18n: 'homeFilterFresh' },
  { key: 'health', type: 'benefits', i18n: 'homeFilterHealth' },
  { key: 'housing', type: 'other', i18n: 'homeFilterHousing' },
];

export function ResourceHome() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  const [filter, setFilter] = useState<HomeFilterKey>('all');

  useSessionBootstrap();

  useEffect(() => {
    document.title = `${t('pageTitleHome')} \u2014 WeaveNYC`;
  }, [t]);

  const activeFilter = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
  const hasValidZip = /^\d{5}$/.test(preferences.zipCode);
  const resourceQuery = useResources(
    { zip: preferences.zipCode, type: activeFilter.type, limit: 20 },
    preferences.onboardingComplete && hasValidZip,
  );

  const items: ResourceSummary[] = resourceQuery.data?.items ?? [];
  const nearbyCount = useMemo(() => items.length, [items]);
  const isLoading = resourceQuery.isLoading || resourceQuery.isFetching;

  // Wave 6B pull-to-refresh. The hook binds to the inner page-content wrapper
  // rather than the outermost fragment so any future framer-motion
  // `<motion.div>` page transition (W6A) can wrap the whole tree without
  // having its own `transform` overwritten every frame.
  const { pullDistance, status: ptrStatus, bindContainer } = usePullToRefresh({
    onRefresh: () => resourceQuery.refetch(),
  });
  const ptrLabel =
    ptrStatus === 'refreshing'
      ? t('pullToRefreshLoading')
      : ptrStatus === 'ready'
        ? t('pullToRefreshRelease')
        : t('pullToRefreshLabel');

  const cardLabels = {
    openLabel: t('detailCta'),
    bookmarkLabel: t('resourceCardActionBookmark'),
    bookmarkedLabel: t('resourceCardActionBookmarked'),
    callLabel: t('resourceCardActionCall'),
    directionsLabel: t('resourceCardActionDirections'),
  };

  const renderResults = () => {
    if (!hasValidZip) {
      return (
        <EmptyState
          illustrationName="search-empty"
          title={t('homeNoZipTitle')}
          subtitle={t('homeNoZipSubtitle')}
          cta={{
            label: t('homeNoZipCta'),
            href: '/me/settings',
            testId: 'home-empty-set-zip',
          }}
        />
      );
    }

    if (isLoading) {
      return (
        <Stack gap={3} aria-live="polite" aria-busy="true">
          <span className="sr-only">{t('homeLoadingLabel')}</span>
          <Skeleton variant="rect" height={72} label={t('homeLoadingLabel')} />
          <Skeleton variant="rect" height={72} />
          <Skeleton variant="rect" height={72} />
        </Stack>
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          illustrationName="search-empty"
          title={t('homeNoResultsTitle')}
          subtitle={t('homeNoResultsSubtitle')}
          cta={{
            label: t('homeNoResultsCta'),
            href: '/me/settings',
            testId: 'home-empty-change-zip',
          }}
        />
      );
    }

    return (
      <Stack gap={3}>
        <p className="muted">{t('homeResultsCount', { count: nearbyCount })}</p>
        <Stack gap={2} as="section">
          {items.map((resource) => (
            <ResourceCard
              key={resource.provider_id}
              resource={{
                id: resource.provider_id,
                name: resource.name,
                category: resource.type,
                distanceLabel:
                  resource.distance_miles !== null
                    ? t('resourceCardDistanceMiles', {
                        distance: resource.distance_miles.toFixed(1),
                      })
                    : undefined,
                hoursLabel: resource.is_open_now ? t('resourceCardOpenNow') : undefined,
                address: resource.address,
                phone: resource.phone,
                bookmarked: preferences.bookmarks.includes(resource.provider_id),
              }}
              labels={cardLabels}
              onOpen={(id) => {
                window.location.href = `/resources/${id}`;
              }}
              onBookmark={(id) => dispatch(toggleBookmark(id))}
              onCall={(phone) => {
                window.location.href = `tel:${phone}`;
              }}
              onDirections={() => {
                window.open(resource.directions_url, '_blank', 'noopener,noreferrer');
              }}
            />
          ))}
        </Stack>
      </Stack>
    );
  };

  return (
    <>
      <TopBar variant="brand" />
      <div
        ref={bindContainer}
        className={`page-content ptr-host ptr-host--${ptrStatus}`}
        style={{ transform: `translateY(${pullDistance}px)` }}
      >
        <div
          className={`ptr-indicator ptr-indicator--${ptrStatus}`}
          aria-live="polite"
          data-testid="ptr-indicator-home"
        >
          <span
            className="ptr-indicator__glyph"
            aria-hidden="true"
            style={{ transform: `rotate(${Math.min(pullDistance * 4, 360)}deg)` }}
          />
          <span className="ptr-indicator__label">{ptrLabel}</span>
        </div>
        <Stack gap={5}>
          <section className="home__masthead">
            <span className="overline home__kicker">{t('homeHeroEyebrow')}</span>
            <h1 className="home__headline">{t('homeHeroTitle')}</h1>
            <p className="home__deck">{t('homeHeroSubtitle')}</p>
            <span aria-hidden="true" className="home__rule" />
            <div className="home__meta">
              {session ? (
                <Tag tone="neutral" data-testid="session-chip">
                  {t('sessionIdChip', { userId: session.user.user_id })}
                </Tag>
              ) : null}
              {hasValidZip ? (
                <Tag tone="neutral">
                  {t('homeZipStatus', { zip: preferences.zipCode })}
                </Tag>
              ) : null}
              {hasValidZip ? (
                <Button
                  as="a"
                  variant="ghost"
                  size="sm"
                  href="/me/settings/"
                  data-testid="home-change-zip"
                >
                  {t('homeZipChange')}
                </Button>
              ) : null}
              <Button
                variant="primary"
                size="sm"
                data-testid="create-session"
                onClick={() => void resourceQuery.refetch()}
              >
                {session ? t('sessionReady') : t('createSession')}
              </Button>
            </div>
          </section>

          <Inline
            as="nav"
            gap={2}
            className="pill-scroll"
            aria-label={t('filtersType')}
          >
            {FILTERS.map(({ key, i18n }) => (
              <Pill
                key={key}
                active={filter === key}
                data-testid={key === 'all' ? 'see-nearby' : `home-filter-${key}`}
                onClick={() => {
                  setFilter(key);
                  if (key === 'all') {
                    void resourceQuery.refetch();
                  }
                }}
              >
                {t(i18n)}
              </Pill>
            ))}
          </Inline>

          <section aria-label={t('searchTitle')}>{renderResults()}</section>
        </Stack>
      </div>
    </>
  );
}
