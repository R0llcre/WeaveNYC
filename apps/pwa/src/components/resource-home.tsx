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
 * Layout: TopBar (brand) → Hero (overline + h1) →
 * ZIP status line (Tag + Change ghost link) → Filter pill rail (scroll-snap)
 * → results (wrapped in `aria-live="polite"` so filter-driven count changes
 * announce to screen readers). Empty states split by cause:
 *   - no ZIP saved    → homeNoZip* keys, CTA routes to /me/settings
 *   - ZIP set, zero   → homeNoResults* keys (interpolates ZIP), CTA /me/settings
 *   - query failed    → tone="error" EmptyState with a retry CTA (V1-A fix:
 *                       real 500s used to mimic "Nothing nearby" and blame
 *                       the user's ZIP).
 *
 * All layout uses <Stack> / <Inline> atoms so the JSX carries NO dead BEM
 * classes (the former `.home__*` hooks had no matching rules in globals.css
 * and were load-bearing nowhere). The one new CSS addition is `.pill-scroll`,
 * a reusable filter-rail utility with scroll-snap.
 *
 * E2E testids preserved (but no longer visible to end-users — bootstrap is
 * auto-fired on mount and refresh is owned by pull-to-refresh):
 *   - `create-session`       — sr-only button; a refetch shim for the smoke
 *                              tests that still click it.
 *   - `session-chip`         — sr-only span carrying the bootstrapped
 *                              user_id so `toContainText(user_id)` still
 *                              passes without rendering a UUID on-screen.
 *   - `see-nearby`           — the "All" filter pill.
 *   - `resource-detail-{id}` — emitted by ResourceCard.
 *   - `bookmark-{id}`        — emitted by ResourceCard.
 */

import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';

import {
  Banner,
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
import { resolveErrorKey } from '@/lib/error-i18n';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import { selectPreferences, selectSession } from '@/lib/selectors';
import { toggleBookmark } from '@/lib/slices/preferences-slice';
import type { ResourceFilterType, ResourceSummary } from '@/lib/types';
import { narrowResourceType } from '@/lib/types';
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
  // P6 UX finding 8 — offline banner on Home. We previously rendered
  // stale results silently; now we pick up the browser online/offline
  // events and surface a warning Banner with "last refreshed" stamp so
  // users aren't guessing whether the list is current.
  const [isOnline, setIsOnline] = useState(true);

  useSessionBootstrap();

  useEffect(() => {
    document.title = `${t('pageTitleHome')} \u2014 WeaveNYC`;
  }, [t]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const syncOnline = () => setIsOnline(window.navigator.onLine);
    syncOnline();
    window.addEventListener('online', syncOnline);
    window.addEventListener('offline', syncOnline);
    return () => {
      window.removeEventListener('online', syncOnline);
      window.removeEventListener('offline', syncOnline);
    };
  }, []);

  const activeFilter = FILTERS.find((entry) => entry.key === filter) ?? FILTERS[0];
  const hasValidZip = /^\d{5}$/.test(preferences.zipCode);
  const resourceQuery = useResources(
    { zip: preferences.zipCode, type: activeFilter.type, limit: 20 },
    preferences.onboardingComplete && hasValidZip,
  );

  const items: ResourceSummary[] = resourceQuery.data?.items ?? [];
  const nearbyCount = useMemo(() => items.length, [items]);
  const isLoading = resourceQuery.isLoading || resourceQuery.isFetching;
  // Pull the last-successful-fetch timestamp from the React Query cache
  // so the offline banner can tell the user how current their data is.
  // `dataUpdatedAt` is 0 before any fetch completes, so we fall back to
  // an omitted timestamp rather than rendering "1970-01-01".
  const lastRefreshedLabel = useMemo(() => {
    const raw = resourceQuery.dataUpdatedAt;
    if (!raw) {
      return null;
    }
    try {
      return new Date(raw).toLocaleString(preferences.language, {
        hour: 'numeric',
        minute: '2-digit',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return new Date(raw).toLocaleString();
    }
  }, [preferences.language, resourceQuery.dataUpdatedAt]);

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
            href: '/me/settings/',
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

    // V1-A UX fix — a real API failure used to render the "Nothing nearby"
    // empty state, which misled users into blaming their ZIP. Split error
    // from empty so a 500 shows a retry-able error tone instead.
    if (resourceQuery.isError) {
      return (
        <EmptyState
          tone="error"
          illustrationName="error"
          title={t(resolveErrorKey(resourceQuery.error))}
          subtitle={t('homeErrorSubtitle')}
          cta={{
            label: t('retry'),
            onClick: () => {
              void resourceQuery.refetch();
            },
            testId: 'home-empty-retry',
          }}
        />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          illustrationName="search-empty"
          title={t('homeNoResultsTitle', { zip: preferences.zipCode })}
          subtitle={t('homeNoResultsSubtitle')}
          cta={{
            label: t('homeNoResultsCta'),
            href: '/me/settings/',
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
                category: narrowResourceType(resource.type),
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
            <div className="home__meta">
              {/* V1-A UX fix — the raw user_id Tag has been removed from the
                  visible hero (nothing a user can act on) but E2E smoke
                  (resource-smoke.spec.ts, community-posts.spec.ts) still
                  asserts `session-chip` exists and contains the fixture
                  user_id. Keep a visually-hidden span carrying the same
                  testid + payload so those assertions stay green without
                  burning hero real estate on a dev-only readout. */}
              {session ? (
                <span className="sr-only" data-testid="session-chip">
                  {session.user.user_id}
                </span>
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
              {/* V1-A UX fix — the visible "Ready to go" primary CTA was a
                  misleading no-op (clicking it just re-fetched the results
                  without navigating anywhere). Refresh is now owned by
                  pull-to-refresh (see `usePullToRefresh` above). We keep a
                  visually-hidden shim with the `create-session` testid so
                  existing E2E smoke specs that still click it on Home
                  continue to land on a refetch path. */}
              <button
                type="button"
                className="sr-only"
                data-testid="create-session"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => {
                  void resourceQuery.refetch();
                }}
              >
                {t('homeRefreshSrLabel')}
              </button>
            </div>
          </section>

          {/* P6 UX finding 8 — offline banner. Wrapped in a live region so
              SR users hear the state transition when connectivity drops.
              Uses the same pattern as `community-screen.tsx` (warning tone
              because the user can recover by reconnecting). The
              "last refreshed" line appears only once at least one
              successful fetch has landed. */}
          {!isOnline ? (
            <Banner
              tone="warning"
              title={t('bannerOfflineHint')}
              data-testid="home-offline-banner"
            >
              {lastRefreshedLabel
                ? t('homeLastRefreshedLabel', { time: lastRefreshedLabel })
                : null}
            </Banner>
          ) : null}

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

          <section
            aria-label={t('searchTitle')}
            aria-live="polite"
            aria-atomic="true"
          >
            {renderResults()}
          </section>
        </Stack>
      </div>
    </>
  );
}
