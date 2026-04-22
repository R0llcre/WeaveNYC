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
 * V1-D filter redesign: the single-select 6-category rail forced false
 * choices ("pantry OR kitchen") and the categories didn't match user
 * mental models (SNAP retailer → market, FQHC → benefits). The real
 * question the user is asking is "is this open right now and can I walk
 * in?". So the rail is now TWO rows:
 *   1. Situational (multi-select): `Open now`, `Today`. Answers the real
 *      question. No `Walk-in` chip yet — `ResourceSummary` has no boolean
 *      for walk-in availability at the time of this change, so shipping
 *      it would be a promise the data can't keep. Revisit once the
 *      public-ingest pipeline learns that field.
 *   2. Category (single-select, existing): the 6 mental-model buckets
 *      All / Food / Meals / Fresh / Health / Housing. Sits below a small
 *      dashed divider added by the stacked `.pill-scroll + .pill-scroll`
 *      rule in globals.css.
 *
 * V1-D a11y: the result wrapper now has `role="region"` + `aria-live="polite"`
 * + `aria-atomic="true"` so screen readers announce the updated count when
 * the filter toggles change the list length.
 *
 * V1-D sparse-results fallback: when the list has 1-2 items, a secondary
 * EmptyState prompts "See a wider area? / Try a nearby ZIP". Reuses the
 * previously-dead `homeSparse*` slot so U3's dead-key flag is now coverage.
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
 *   - `home-filter-open-now` — V1-D situational chip.
 *   - `home-filter-today`    — V1-D situational chip.
 *   - `home-sparse-fallback` — V1-D sparse-results card (1-2 results).
 *   - `home-sparse-nearby`   — V1-D sparse-fallback CTA.
 */

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ActivityTicker } from '@/components/activity-ticker';
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
import {
  clearLastIntent,
  dismissTrustBanner,
  toggleBookmark,
} from '@/lib/slices/preferences-slice';
import type { HomeIntent, ResourceFilterType, ResourceSummary } from '@/lib/types';
import { narrowResourceType } from '@/lib/types';
import { usePullToRefresh } from '@/lib/use-pull-to-refresh';
import { useSessionBootstrap } from '@/lib/use-session-bootstrap';

// Redesign filter vocabulary maps onto the backend taxonomy so the wire
// protocol stays unchanged; only the presentation layer shifts.
type HomeFilterKey = 'all' | 'food' | 'meal' | 'fresh' | 'health' | 'housing';

const CATEGORY_FILTERS: Array<{
  key: HomeFilterKey;
  type: ResourceFilterType;
  i18n: string;
}> = [
  { key: 'all', type: 'all', i18n: 'homeFilterAll' },
  { key: 'food', type: 'pantry', i18n: 'homeFilterFood' },
  { key: 'meal', type: 'kitchen', i18n: 'homeFilterMeal' },
  { key: 'fresh', type: 'market', i18n: 'homeFilterFresh' },
  { key: 'health', type: 'benefits', i18n: 'homeFilterHealth' },
  { key: 'housing', type: 'other', i18n: 'homeFilterHousing' },
];

// V1-D situational chips — multi-select. `walk_in` deliberately dropped
// from the MVP because `ResourceSummary` has no boolean for it yet; add
// when the public-ingest pipeline surfaces that field.
type SituationalKey = 'open_now' | 'today';

const SITUATIONAL_FILTERS: Array<{
  key: SituationalKey;
  i18n: string;
  testId: string;
}> = [
  { key: 'open_now', i18n: 'homeFilterOpenNow', testId: 'home-filter-open-now' },
  { key: 'today', i18n: 'homeFilterToday', testId: 'home-filter-today' },
];

// V1-D sparse-results threshold. When the list length is strictly between 0
// and this value, we append the fallback card. 3 is the product threshold
// where a list stops reading as a failure and starts reading as "choice".
const SPARSE_RESULTS_THRESHOLD = 3;

// V2-E — freshness footer source. Injected at build time by `next.config.ts`
// from `packages/db/seed/generated/public-resources.snapshot.json`. When the
// API starts returning `snapshot_date` on every `ResourcesResponse` we can
// prefer the response value over these constants, but shipping both would
// blur the signal so we keep it single-sourced. Empty strings -> footer
// hides (never renders "Last updated ").
const DATA_SNAPSHOT_DATE = process.env.NEXT_PUBLIC_DATA_SNAPSHOT_DATE ?? '';
const DATA_SNAPSHOT_COUNT = process.env.NEXT_PUBLIC_DATA_SNAPSHOT_COUNT ?? '';

// V2-D — crisis-first wizard intent → initial filter state. When the user
// picks an intent in HomeWizard, the directory mounts with these defaults
// already applied. The wire types / backend contract are unchanged; the
// intent is purely a client-side shortcut over the existing filter rail.
// The user can still tap the category pills to override — we only pre-seed
// the initial state, we don't lock it to the intent.
type InitialFilterState = {
  filter: HomeFilterKey;
  situational: ReadonlyArray<SituationalKey>;
};

function initialFilterStateForIntent(
  intent: HomeIntent | null,
): InitialFilterState {
  switch (intent) {
    case 'food_now':
      // "I'm hungry right now" — pantries AND kitchens open right now. We
      // leave `filter: 'all'` so both food types surface, and set the
      // `open_now` situational chip active so the user immediately sees
      // only places that can help tonight.
      return { filter: 'all', situational: ['open_now'] };
    case 'food_week':
      // "Food for my family this week" — pantry-heavy category with the
      // `today` chip active. `today` is the closest approximation we have
      // to "next 7 days" on the existing API; the copy on the wizard card
      // promises "next 7 days" as a rolling window the user can refine
      // with their own visits across the week.
      return { filter: 'food', situational: ['today'] };
    case 'doctor':
      // "I need to see a doctor" — `benefits` bucket, which
      // `narrowResourceType()` maps to FQHCs (sliding-scale clinics).
      return { filter: 'health', situational: [] };
    case 'sleep':
      // "A safe place to sleep" — `other` bucket holds shelter / housing.
      return { filter: 'housing', situational: [] };
    case null:
    default:
      return { filter: 'all', situational: [] };
  }
}

/**
 * Suggest up to 3 adjacent ZIPs by flexing the last digit of the current
 * ZIP. This is a deliberately cheap client-side heuristic — the V1-D
 * spec allows the sparse CTA to simply guide the user toward a nearby ZIP
 * rather than implement server-side radius expansion. The walk fans out
 * (+1, -1, +2, -2, …) so adjacent ZIPs surface first.
 */
function suggestNearbyZips(current: string): string[] {
  const match = /^(\d{4})(\d)$/.exec(current);
  if (!match) {
    return [];
  }
  const prefix = match[1];
  const last = Number(match[2]);
  const candidates: string[] = [];
  for (let step = 1; step <= 5 && candidates.length < 3; step += 1) {
    for (const delta of [step, -step]) {
      const nextDigit = last + delta;
      if (nextDigit >= 0 && nextDigit <= 9) {
        const candidate = `${prefix}${nextDigit}`;
        if (candidate !== current && !candidates.includes(candidate)) {
          candidates.push(candidate);
          if (candidates.length === 3) {
            break;
          }
        }
      }
    }
  }
  return candidates;
}

export function ResourceHome() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  const session = useAppSelector(selectSession);
  // V2-D — initial filter + situational state are derived from the wizard
  // intent, if any. Lazy initializers run once at mount, so after the
  // user taps a category pill or situational chip the intent does NOT
  // re-seed state (spec: "doesn't reset the intent; just overrides").
  // Changing the intent via the "Change what I'm looking for" button
  // dispatches `clearLastIntent` which causes `page.tsx` to unmount this
  // component entirely and render `<HomeWizard />` instead, so no
  // reactive re-seed is needed here.
  const [filter, setFilter] = useState<HomeFilterKey>(
    () => initialFilterStateForIntent(preferences.lastIntent).filter,
  );
  // V1-D: situational chips are multi-select. A `Set` keeps the add/remove
  // logic simple, and memoised `has` lookups are O(1) for the query-input
  // derivation below. V2-D seeds it from the wizard intent (empty Set when
  // lastIntent is null).
  const [situational, setSituational] = useState<Set<SituationalKey>>(
    () => new Set(initialFilterStateForIntent(preferences.lastIntent).situational),
  );
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

  const toggleSituational = useCallback((key: SituationalKey) => {
    setSituational((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const activeFilter =
    CATEGORY_FILTERS.find((entry) => entry.key === filter) ?? CATEGORY_FILTERS[0];
  const hasValidZip = /^\d{5}$/.test(preferences.zipCode);
  const resourceQuery = useResources(
    {
      zip: preferences.zipCode,
      type: activeFilter.type,
      // `|| undefined` means the flag omits the query param when false,
      // keeping the wire payload identical to pre-V1-D when no situational
      // chip is active. The backend's `searchResources` only appends these
      // to the URLSearchParams when truthy, but this double-guard keeps
      // the React Query cache key minimal too.
      openNow: situational.has('open_now') || undefined,
      today: situational.has('today') || undefined,
      limit: 20,
    },
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

  // V2-E — freshness footer. Format the build-time snapshot date into the
  // user's current locale so a ZH visitor sees `2026年4月21日` rather than
  // the raw ISO string. Guards: if either token is empty (contributor ran
  // the PWA without running the public-ingest step), hide the footer. If
  // the ISO parses invalid we surface the raw date rather than "Invalid
  // Date" — it's still more truthful than silence.
  const freshnessLabel = useMemo(() => {
    if (!DATA_SNAPSHOT_DATE || !DATA_SNAPSHOT_COUNT) {
      return null;
    }
    const parsed = new Date(DATA_SNAPSHOT_DATE);
    let dateLabel: string = DATA_SNAPSHOT_DATE;
    if (Number.isFinite(parsed.getTime())) {
      try {
        dateLabel = parsed.toLocaleDateString(preferences.language, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        dateLabel = parsed.toLocaleDateString();
      }
    }
    return t('homeFreshnessFooter', {
      date: dateLabel,
      count: DATA_SNAPSHOT_COUNT,
    });
  }, [preferences.language, t]);

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
        <Stack gap={3} aria-busy="true">
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

    // V1-D sparse-results fallback — list AND secondary CTA. When the user
    // sees only 1-2 rows the raw list looks like a failure; this card re-
    // frames that as "you can expand your search" instead of "nothing here".
    const showSparseFallback =
      items.length > 0 && items.length < SPARSE_RESULTS_THRESHOLD;
    const nearbyZipSuggestions = showSparseFallback
      ? suggestNearbyZips(preferences.zipCode)
      : [];
    const sparseSubtitle = t('homeSparseSubtitle', { count: nearbyCount });

    // V2-A — show the widened-radius banner when the backend had to walk
    // past the default 5mi tier to find results. `> 5` intentionally
    // excludes the zero-radius case (null) and the 5mi happy path.
    const widenedToMiles = resourceQuery.data?.widened_to_miles ?? null;
    const showWidenedBanner =
      widenedToMiles !== null && widenedToMiles > 5;

    return (
      <Stack gap={3}>
        {showWidenedBanner ? (
          <Banner
            tone="info"
            title={t('homeRadiusWidenedBanner', {
              zip: preferences.zipCode,
              miles: widenedToMiles,
            })}
            data-testid="home-widened-banner"
          />
        ) : null}
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
        {showSparseFallback ? (
          <EmptyState
            data-testid="home-sparse-fallback"
            illustrationName="search-empty"
            title={t('homeSparseTitle')}
            subtitle={
              nearbyZipSuggestions.length > 0
                ? `${sparseSubtitle} ${nearbyZipSuggestions.join(', ')}`
                : sparseSubtitle
            }
            cta={{
              label: t('homeSparseCta'),
              href: '/me/settings/',
              variant: 'secondary',
              testId: 'home-sparse-nearby',
            }}
          />
        ) : null}
      </Stack>
    );
  };

  // V1-B Task 4 — first-visit trust banner. Sits ABOVE the hero so the
  // user's very first impression names the boundaries we never cross
  // (no name, no SSN, no status). Dismiss is a one-time action; the
  // `trustBannerDismissed` flag persists via the preferences slice +
  // IndexedDB so a returning user doesn't see it again. The banner also
  // doubles as the signal that the user has already read the privacy
  // framing, so the anchor-model onboarding step skips them on a future
  // reboot (see `/onboarding/trust/page.tsx`).
  const shouldShowTrustBanner =
    preferences.hydrationComplete && !preferences.trustBannerDismissed;

  // V2-C — "returning neighbor" proxy. The V2-C spec pointed at a
  // `session?.user?.display_name` field, but the AuthUser shape today
  // only carries `{ user_id, level }` (see `lib/types.ts`). Until a real
  // display-name channel lands we gate the returning-user banner copy
  // on the session level: anonymous users see the generic "See what your
  // neighbors did this week" banner, while verified/anchor users see
  // "Welcome back — your neighborhood moved while you were gone".
  // Rationale: `level === 'anonymous'` literally means the user has
  // never identified themselves, so any other level is a credible
  // "returning neighbor" signal.
  const isReturningNeighbor =
    Boolean(session) && session?.user.level !== 'anonymous';

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
          {shouldShowTrustBanner ? (
            <Banner
              tone="info"
              title={t('homeTrustBannerTitle')}
              onDismiss={() => dispatch(dismissTrustBanner())}
              dismissLabel={t('commonDismiss')}
              data-testid="home-trust-banner"
            >
              {t('homeTrustBannerBody')}
            </Banner>
          ) : null}

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
                // V2-F a11y fix — `sr-only` hides the UUID visually but the
                // VoiceOver accessibility tree previously announced all 36
                // characters one-by-one on every home visit ("7 2 7 3 1
                // b a 2 dash…"). `aria-hidden` removes it from the AT tree
                // while preserving it in the DOM for E2E testid assertions
                // (Playwright reads innerHTML, not accessibility). This is
                // safe because nothing about a bootstrapped anon UUID is
                // useful to a screen-reader user.
                <span className="sr-only" aria-hidden="true" data-testid="session-chip">
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
              {/* V2-D — "Change what I'm looking for" ghost button. Only
                  surfaces when the user arrived here from the wizard (i.e.
                  `lastIntent !== null`); clearing the intent makes
                  `page.tsx` swap this component back for `<HomeWizard />`
                  on the next render. The button stays small + ghost-variant
                  so it doesn't compete with actionable chips below the
                  hero. */}
              {preferences.lastIntent !== null ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch(clearLastIntent())}
                  data-testid="home-change-intent"
                >
                  {t('wizardChangeIntentCta')}
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

          {/* V2-C — neighbor banner + rotating activity ticker. Sits below
              the hero so Home's first impression ("Help near you") leads,
              but above the filter rail so a brand-new anonymous user sees
              the social layer breathe before they try to filter. The
              banner variant swaps based on whether the session carries a
              non-anonymous level (proxy for "returning neighbor") so the
              copy acknowledges the user instead of re-greeting them like
              a stranger. See `activity-ticker.tsx` for rotation, reduced-
              motion handling, and the feature-flag. */}
          <Stack gap={3} data-testid="home-neighbor-section">
            <p
              className="overline"
              data-testid="home-neighbor-banner"
              style={{ margin: 0 }}
            >
              {isReturningNeighbor
                ? t('homeNeighborBannerTitleReturning')
                : t('homeNeighborBannerTitle')}
            </p>
            <ActivityTicker />
          </Stack>

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

          {/* V1-D filter rail — two adjacent scroll-rails sharing the
              `.pill-scroll` atom. The stacked `.pill-scroll + .pill-scroll`
              rule adds a dashed divider in CSS so the JSX stays atom-first.
              Each nav has its own accessible name so SR users hear
              "When: Open now pressed" vs "Category: Food pressed". */}
          <Inline
            as="nav"
            gap={2}
            className="pill-scroll"
            aria-label={t('homeFilterSituationalLabel')}
          >
            {SITUATIONAL_FILTERS.map(({ key, i18n, testId }) => (
              <Pill
                key={key}
                active={situational.has(key)}
                data-testid={testId}
                onClick={() => toggleSituational(key)}
              >
                {t(i18n)}
              </Pill>
            ))}
          </Inline>

          <Inline
            as="nav"
            gap={2}
            className="pill-scroll"
            aria-label={t('homeFilterCategoryLabel')}
          >
            {CATEGORY_FILTERS.map(({ key, i18n }) => (
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

          {/* V1-A + V1-D a11y: wrap results in a polite live region so the
              count change is announced when a filter toggle mutates the list.
              `aria-atomic="true"` ensures the full label is re-read
              (otherwise only the diff would be spoken, which is unhelpful
              for a count readout). */}
          <section
            role="region"
            aria-label={t('searchTitle')}
            aria-live="polite"
            aria-atomic="true"
          >
            {renderResults()}
          </section>

          {/* V2-E — freshness footer. Sourced from the public-ingest
              snapshot (`packages/db/seed/generated/public-resources.snapshot.json`)
              and injected at build time via `next.config.ts`. Renders a
              small, muted line so the user knows how current the list is
              ("43 places · updated 2026-04-21"). Hidden entirely when the
              build-time env vars are empty (dev without ingest run). */}
          {freshnessLabel ? (
            <footer
              className="home__freshness muted"
              data-testid="home-freshness-footer"
            >
              {freshnessLabel}
            </footer>
          ) : null}
        </Stack>
      </div>
    </>
  );
}
