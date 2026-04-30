/**
 * ResourceDirectory — Home directory list (mobile).
 *
 * RN port of `apps/pwa/src/components/resource-home.tsx` (~771 LOC on the
 * web). The mobile port trims three web-only branches:
 *
 *   1. `TopBar` / `main#main-content` landmark chrome — replaced by the
 *      expo-router stack header and safe-area padding.
 *   2. The offline banner bound to `window.addEventListener('online')` —
 *      `@react-native-community/netinfo` wiring is Phase-3 (M6 outbox).
 *   3. ActivityTicker + neighbor banner — skipped for MVP parity per the
 *      S2 spec (can add in Phase 3 alongside a real `/v1/activity` feed).
 *
 * Kept intact: every filter pill, every empty-state branch, the sparse-
 * results fallback, the build-time freshness footer, and the
 * "Change what I'm looking for" ghost button that dispatches
 * `clearLastIntent` → the parent re-renders <HomeWizard />.
 *
 * Data: `useResources({ zip, type, openNow, today, limit: 20 })` from
 * `@/lib/hooks` is the same React-Query hook the PWA uses — the wire
 * contract is single-sourced across platforms.
 *
 * Pull-to-refresh: RN's built-in `RefreshControl` on the `FlatList`
 * drives `resourceQuery.refetch()`. No custom drag-to-refresh gesture
 * needed (the PWA has one because the web has no native PTR).
 *
 * testIDs mirror the PWA so the same Maestro flows can bind to them:
 *   - `resource-directory`     — the root View.
 *   - `home-filter-open-now`   — situational chip.
 *   - `home-filter-today`      — situational chip.
 *   - `home-filter-<key>`      — category chip (all | food | meal | ...).
 *   - `see-nearby`             — the "All" category pill (smoke-test anchor).
 *   - `home-empty-set-zip`     — no-ZIP CTA.
 *   - `home-empty-retry`       — error-state retry CTA.
 *   - `home-empty-change-zip`  — no-results CTA.
 *   - `home-sparse-fallback`   — sparse-results fallback card.
 *   - `home-sparse-nearby`     — sparse-results CTA.
 *   - `home-change-intent`     — "Change what I'm looking for" ghost button.
 *   - `home-freshness-footer`  — build-time snapshot footer.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import {
  Banner,
  Button,
  EmptyState,
  Inline,
  Pill,
  ResourceCard,
  Skeleton,
  Stack,
  Tag,
} from '@/components/ui';
import { useAppDispatch, useAppSelector, useResources } from '@/lib/hooks';
import { selectPreferences } from '@/lib/selectors';
import {
  clearLastIntent,
  toggleBookmark,
} from '@/lib/slices/preferences-slice';
import type {
  HomeIntent,
  ResourceFilterType,
  ResourceSummary,
} from '@/lib/types';
import { narrowResourceType } from '@/lib/types';
import { useAppTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/**
 * Narrow a widened Restyle spacing / radius token to a concrete number.
 * `@/theme/tokens.ts` ships numeric values for every key but Restyle's
 * `BaseTheme` widens the lookup to `string | number | undefined`; this
 * helper keeps the JSX below free of `as number` casts.
 */
function num(value: string | number | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Filter taxonomy — byte-for-byte aligned with resource-home.tsx (PWA) so
// a designer can diff the two side-by-side. Changing either side without
// the other would cause the two platforms to show different filter sets
// for the same mental-model bucket.
// ---------------------------------------------------------------------------

type HomeFilterKey = 'all' | 'food' | 'meal' | 'fresh' | 'health' | 'housing';

const CATEGORY_FILTERS: ReadonlyArray<{
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

type SituationalKey = 'open_now' | 'today';

const SITUATIONAL_FILTERS: ReadonlyArray<{
  key: SituationalKey;
  i18n: string;
  testID: string;
}> = [
  { key: 'open_now', i18n: 'homeFilterOpenNow', testID: 'home-filter-open-now' },
  { key: 'today', i18n: 'homeFilterToday', testID: 'home-filter-today' },
];

// Sparse threshold — list length strictly between 0 and this value gets
// the "see a wider area?" fallback card appended. `3` is the product
// threshold where a list stops reading as failure and starts reading as
// choice.
const SPARSE_RESULTS_THRESHOLD = 3;

// Build-time freshness footer tokens. Expo's static env-var surface is
// `EXPO_PUBLIC_*`; set these in `app.config.*` or the EAS build profile
// to surface the last public-ingest snapshot. Empty tokens hide the
// footer (never render "Last updated ").
const DATA_SNAPSHOT_DATE = process.env.EXPO_PUBLIC_DATA_SNAPSHOT_DATE ?? '';
const DATA_SNAPSHOT_COUNT = process.env.EXPO_PUBLIC_DATA_SNAPSHOT_COUNT ?? '';

// V2-D — intent → initial filter state. Lazy-init only at mount, so a
// subsequent pill tap does NOT reset to the intent defaults (spec: "just
// an override"). Clearing the intent swaps this component out for the
// wizard on the next render.
type InitialFilterState = {
  filter: HomeFilterKey;
  situational: ReadonlyArray<SituationalKey>;
};

function initialFilterStateForIntent(
  intent: HomeIntent | null,
): InitialFilterState {
  switch (intent) {
    case 'food_now':
      return { filter: 'all', situational: ['open_now'] };
    case 'food_week':
      return { filter: 'food', situational: ['today'] };
    case 'doctor':
      return { filter: 'health', situational: [] };
    case 'sleep':
      return { filter: 'housing', situational: [] };
    case null:
    default:
      return { filter: 'all', situational: [] };
  }
}

// Deliberately-cheap nearby-ZIP heuristic — flexes the last digit of the
// current ZIP (+1 / -1 / +2 / -2 …) and returns the first three valid
// candidates. The V1-D spec allows this kind of client-side guidance in
// lieu of server-side radius expansion (the real radius widening lands
// on the response itself via `widened_to_miles`).
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

export function ResourceDirectory() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  // See the analogous comment in HomeWizard — react-i18next's type
  // narrowing only knows the default `chrome` namespace. Aliasing the
  // `t` callable to a loose shape here lets the wide set of `home:*`
  // keys resolve at runtime without per-key overload noise. The
  // i18n-parity CI step covers the presence of each key.
  const { t, i18n } = useTranslation('home');
  const tr = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  const s = {
    xs: num(theme.spacing.xs, 4),
    s: num(theme.spacing.s, 8),
    sm: num(theme.spacing.sm, 12),
    m: num(theme.spacing.m, 16),
    l: num(theme.spacing.l, 24),
    xl: num(theme.spacing.xl, 28),
    xxl: num(theme.spacing.xxl, 32),
  };

  const [filter, setFilter] = useState<HomeFilterKey>(
    () => initialFilterStateForIntent(preferences.lastIntent).filter,
  );
  const [situational, setSituational] = useState<Set<SituationalKey>>(
    () => new Set(initialFilterStateForIntent(preferences.lastIntent).situational),
  );

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

  // The find never returns undefined because the state union is one of
  // CATEGORY_FILTERS' own keys, but TS can't narrow that statically —
  // `!` / fallback to the first entry both work; we pick the fallback so
  // the runtime never crashes if the slice ever widens `filter` beyond
  // the declared union.
  const activeFilter =
    CATEGORY_FILTERS.find((entry) => entry.key === filter) ?? CATEGORY_FILTERS[0]!;
  const hasValidZip = /^\d{5}$/.test(preferences.zipCode);
  const resourceQuery = useResources(
    {
      zip: preferences.zipCode,
      type: activeFilter.type,
      openNow: situational.has('open_now') || undefined,
      today: situational.has('today') || undefined,
      limit: 20,
    },
    hasValidZip,
  );

  const items: ResourceSummary[] = resourceQuery.data?.items ?? [];
  const nearbyCount = items.length;
  const isLoading = resourceQuery.isLoading || resourceQuery.isFetching;
  const isRefreshing = resourceQuery.isFetching && !resourceQuery.isLoading;

  // V2-E freshness footer — formatted in the user's current locale so a
  // zh-Hans visitor sees `2026年4月21日` rather than the raw ISO.
  const freshnessLabel = useMemo(() => {
    if (!DATA_SNAPSHOT_DATE || !DATA_SNAPSHOT_COUNT) {
      return null;
    }
    const parsed = new Date(DATA_SNAPSHOT_DATE);
    let dateLabel: string = DATA_SNAPSHOT_DATE;
    if (Number.isFinite(parsed.getTime())) {
      try {
        dateLabel = parsed.toLocaleDateString(i18n.language, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      } catch {
        dateLabel = parsed.toLocaleDateString();
      }
    }
    return tr('homeFreshnessFooter', {
      date: dateLabel,
      count: DATA_SNAPSHOT_COUNT,
    });
  }, [i18n.language, tr]);

  const cardLabels = useMemo(
    () => ({
      openLabel: tr('detailCta'),
      bookmarkLabel: tr('resourceCardActionBookmark'),
      bookmarkedLabel: tr('resourceCardActionBookmarked'),
      callLabel: tr('resourceCardActionCall'),
      directionsLabel: tr('resourceCardActionDirections'),
      shareLabel: tr('resourceDetailShareLabel'),
    }),
    [tr],
  );

  const handleRefresh = useCallback(() => {
    void resourceQuery.refetch();
  }, [resourceQuery]);

  const handleGoToSettings = useCallback(() => {
    router.push('/me');
  }, [router]);

  // Build the row renderer once so FlatList's diffing is stable.
  const renderItem: ListRenderItem<ResourceSummary> = useCallback(
    ({ item: resource }) => (
      <ResourceCard
        resource={{
          id: resource.provider_id,
          name: resource.name,
          category: narrowResourceType(resource.type),
          distanceLabel:
            resource.distance_miles !== null
              ? tr('resourceCardDistanceMiles', {
                  distance: resource.distance_miles.toFixed(1),
                })
              : undefined,
          hoursLabel: resource.is_open_now ? tr('resourceCardOpenNow') : undefined,
          isOpenNow: resource.is_open_now,
          address: resource.address,
          phone: resource.phone,
          directionsUrl: resource.directions_url,
          bookmarked: preferences.bookmarks.includes(resource.provider_id),
        }}
        labels={cardLabels}
        onBookmark={(id) => dispatch(toggleBookmark(id))}
      />
    ),
    [cardLabels, dispatch, preferences.bookmarks, tr],
  );

  // Hero + ZIP status + "change intent" + filter rails all render above
  // the list as the FlatList header. Keeping them in `ListHeaderComponent`
  // means a refresh on the list doesn't unmount the filter state.
  const listHeader = (
    <Stack gap="l">
      {/* Hero — eyebrow + headline. Smaller than the wizard variant so
          the filter rails + first card land on-screen together. */}
      <View>
        <Text
          style={[
            styles.eyebrow,
            {
              color: theme.colors.accent,
              fontSize: theme.textVariants.micro.fontSize,
              lineHeight: theme.textVariants.micro.lineHeight,
              marginBottom: s.xs,
            },
          ]}
        >
          {tr('homeHeroEyebrow')}
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            color: theme.colors.inkPrimary,
            fontSize: theme.textVariants.h2.fontSize,
            lineHeight: theme.textVariants.h2.lineHeight,
            fontWeight: theme.textVariants.h2.fontWeight as '600',
          }}
        >
          {tr('homeHeroTitle')}
        </Text>
      </View>

      {/* ZIP status + change-intent ghost button. Both are optional —
          an un-ZIP'd user sees neither because the empty state is its
          own branch below. */}
      {(hasValidZip || preferences.lastIntent !== null) ? (
        <Inline gap="s" wrap>
          {hasValidZip ? (
            <Tag tone="neutral">
              {tr('homeZipStatus', { zip: preferences.zipCode })}
            </Tag>
          ) : null}
          {hasValidZip ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleGoToSettings}
              testID="home-change-zip"
            >
              {tr('homeZipChange')}
            </Button>
          ) : null}
          {preferences.lastIntent !== null ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => dispatch(clearLastIntent())}
              testID="home-change-intent"
            >
              {tr('wizardChangeIntentCta')}
            </Button>
          ) : null}
        </Inline>
      ) : null}

      {/* Situational chip row — multi-select. Wraps so dense locales
          (es: "Abierto ahora") don't overflow. */}
      <Inline
        gap="s"
        wrap
        accessibilityLabel={tr('homeFilterSituationalLabel')}
      >
        {SITUATIONAL_FILTERS.map(({ key, i18n: labelKey, testID: pillTestID }) => (
          <Pill
            key={key}
            selected={situational.has(key)}
            testID={pillTestID}
            onPress={() => toggleSituational(key)}
          >
            {tr(labelKey)}
          </Pill>
        ))}
      </Inline>

      {/* Category chip row — single-select. The `all` pill preserves
          the `see-nearby` testID so cross-platform smoke tests keep
          binding to it. */}
      <Inline
        gap="s"
        wrap
        accessibilityLabel={tr('homeFilterCategoryLabel')}
      >
        {CATEGORY_FILTERS.map(({ key, i18n: labelKey }) => (
          <Pill
            key={key}
            selected={filter === key}
            testID={key === 'all' ? 'see-nearby' : `home-filter-${key}`}
            onPress={() => setFilter(key)}
          >
            {tr(labelKey)}
          </Pill>
        ))}
      </Inline>
    </Stack>
  );

  // Results-only subtree. Rendering branches mirror the PWA:
  //   1. No ZIP      → EmptyState with CTA → /me
  //   2. Loading     → 3 Skeleton placeholders
  //   3. Error       → EmptyState(tone="error") with retry CTA
  //   4. Empty       → EmptyState with CTA → /me
  //   5. Sparse      → list + sparse fallback card
  //   6. Happy path  → list + results count
  const renderBody = () => {
    if (!hasValidZip) {
      return (
        <EmptyState
          illustrationName="search-empty"
          title={tr('homeNoZipTitle')}
          subtitle={tr('homeNoZipSubtitle')}
          cta={{
            label: tr('homeNoZipCta'),
            onPress: handleGoToSettings,
            testID: 'home-empty-set-zip',
          }}
        />
      );
    }

    if (isLoading && items.length === 0) {
      return (
        <View testID="home-loading-skeletons">
          <Stack gap="s">
            <Skeleton variant="rect" height={72} label={tr('homeLoadingLabel')} />
            <Skeleton variant="rect" height={72} />
            <Skeleton variant="rect" height={72} />
          </Stack>
        </View>
      );
    }

    if (resourceQuery.isError) {
      return (
        <EmptyState
          tone="error"
          illustrationName="error"
          title={tr('resourceLoadError')}
          subtitle={tr('homeErrorSubtitle')}
          cta={{
            label: tr('resourceEmptyTryAgain'),
            onPress: handleRefresh,
            testID: 'home-empty-retry',
          }}
        />
      );
    }

    if (items.length === 0) {
      return (
        <EmptyState
          illustrationName="search-empty"
          title={tr('homeNoResultsTitle', { zip: preferences.zipCode })}
          subtitle={tr('homeNoResultsSubtitle')}
          cta={{
            label: tr('homeNoResultsCta'),
            onPress: handleGoToSettings,
            testID: 'home-empty-change-zip',
          }}
        />
      );
    }

    // Past this point we have >= 1 item. The sparse-results fallback
    // triggers for 1-2 items so the list doesn't read as failure.
    const showSparseFallback =
      items.length > 0 && items.length < SPARSE_RESULTS_THRESHOLD;
    const nearbyZipSuggestions = showSparseFallback
      ? suggestNearbyZips(preferences.zipCode)
      : [];
    const sparseSubtitle = tr('homeSparseSubtitle', { count: nearbyCount });

    const widenedToMiles = resourceQuery.data?.widened_to_miles ?? null;
    const showWidenedBanner =
      widenedToMiles !== null && widenedToMiles > 5;

    return (
      <Stack gap="m">
        {showWidenedBanner ? (
          <Banner
            tone="info"
            title={tr('homeRadiusWidenedBanner', {
              zip: preferences.zipCode,
              miles: widenedToMiles,
            })}
            testID="home-widened-banner"
          />
        ) : null}
        <Text
          style={{
            color: theme.colors.inkMuted,
            fontSize: theme.textVariants.bodySmall.fontSize,
            lineHeight: theme.textVariants.bodySmall.lineHeight,
          }}
        >
          {tr('homeResultsCount', { count: nearbyCount })}
        </Text>
        {showSparseFallback ? (
          <EmptyState
            testID="home-sparse-fallback"
            illustrationName="search-empty"
            title={tr('homeSparseTitle')}
            subtitle={
              nearbyZipSuggestions.length > 0
                ? `${sparseSubtitle} ${nearbyZipSuggestions.join(', ')}`
                : sparseSubtitle
            }
            cta={{
              label: tr('homeSparseCta'),
              onPress: handleGoToSettings,
              variant: 'secondary',
              testID: 'home-sparse-nearby',
            }}
          />
        ) : null}
      </Stack>
    );
  };

  const listFooter = freshnessLabel ? (
    <Text
      testID="home-freshness-footer"
      style={[
        styles.freshnessFooter,
        {
          color: theme.colors.inkMuted,
          fontSize: theme.textVariants.bodySmall.fontSize,
          lineHeight: theme.textVariants.bodySmall.lineHeight,
          marginTop: s.xl,
        },
      ]}
    >
      {freshnessLabel}
    </Text>
  ) : null;

  return (
    <View
      testID="resource-directory"
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: insets.top,
        },
      ]}
    >
      <FlatList
        data={items}
        keyExtractor={(resource) => resource.provider_id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={{ paddingBottom: s.m }}>{listHeader}</View>
        }
        ListEmptyComponent={<View>{renderBody()}</View>}
        ListFooterComponent={
          items.length > 0 ? (
            <Stack gap="m">
              {/* On the happy path, the footer carries the results-count
                  readout + the sparse fallback (when 1-2 items) + the
                  freshness label. Everything here is metadata below the
                  list — the list rows themselves live in `renderItem`. */}
              {renderBody()}
              {listFooter}
            </Stack>
          ) : (
            listFooter
          )
        }
        contentContainerStyle={{
          padding: s.l,
          paddingBottom: insets.bottom + s.xxl,
          gap: s.m,
        }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.accent}
            accessibilityLabel={tr('refreshNearby')}
          />
        }
        // Keep the filter-pill state visible while the list virtualises;
        // windowSize 5 is RN's default, pinned explicitly so a future
        // perf-tuning pass doesn't drift into jank.
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  eyebrow: {
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  freshnessFooter: {
    textAlign: 'center',
  },
});
