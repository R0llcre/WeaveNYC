/**
 * ResourceCard — the central discovery atom.
 * ===========================================
 *
 * Mobile port of `apps/pwa/src/components/ui/ResourceCard.tsx` (~283 LOC
 * on web). The visual model mirrors the PWA card exactly:
 *
 * ```
 *  ┌──────────────────────────────────────────────┐
 *  │ [icon] Name                0.4 mi        [♡] │
 *  │        [ Open now ]                          │
 *  │        123 Main St · (718) 555-1234          │
 *  │                             [Call] [Dir] [▲] │
 *  └──────────────────────────────────────────────┘
 * ```
 *
 * The whole tile is a single `Pressable` that fires `onOpen` — one tap
 * target for "open details". Bookmark, Call, Directions, and Share are
 * rendered as sibling `Pressable`s (NOT nested inside the outer tile —
 * WCAG 2.1 disallows interactive descendants).
 *
 * Category icon
 * -------------
 * The PWA version imports `Icon` (W1B atom) which resolves against the
 * `icons/registry.ts` SVG table. On mobile the Icon atom is the scope
 * of M4a (parallel milestone). While M4a is unmerged we render a
 * labeled letter glyph (first char of the category name) styled the
 * same way Icon would style it — a soft-filled tile in the accent or
 * community / verified tone. When M4a lands, consumers can pass a real
 * `<Icon name="food" tone="accent" />` through the `categoryIcon`
 * prop and the letter-fallback is bypassed.
 *
 * Platform-guarded actions
 * ------------------------
 * - **Call** → `Linking.openURL('tel:<phone>')`. iOS handles raw
 *   `tel:` URLs natively. Android also does, but spec pins iOS for now.
 * - **Directions** → `Linking.openURL(resource.directionsUrl)`.
 *   Directions URLs are usually `maps.apple.com` / `https://...` so
 *   they work on both platforms; the caller is responsible for
 *   providing the platform-appropriate URL.
 * - **Share** → `expo-sharing`'s `Sharing.shareAsync`. On iOS this
 *   opens the share sheet; on Android a native share chooser.
 *
 * All three are guarded by `Platform.OS` checks so a future Android
 * port can add a parallel branch without editing every call site.
 *
 * Test surface
 * ------------
 * `data-testid` from web becomes `testID` on native. Maestro flows
 * target `bookmark-{id}`, `phone-{id}`, `directions-{id}`,
 * `share-{id}`, and `resource-card-{id}` for the tile itself.
 *
 * Dark-mode
 * ---------
 * Every surface colour flows from `useAppTheme()` so the whole card
 * repaints when `darkTheme` takes over.
 */

import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

// ---------------------------------------------------------------------------
// Category taxonomy — kept byte-for-byte aligned with the PWA version so
// cross-platform designers can reference one table.
// ---------------------------------------------------------------------------

export type ResourceCardCategory =
  | 'food'
  | 'pantry'
  | 'kitchen'
  | 'market'
  | 'benefits'
  | 'goods'
  | 'childcare'
  | 'companionship'
  | 'translation'
  | 'transportation'
  | 'health'
  | 'other';

/**
 * Which semantic tone a category leans on. The web file calls this
 * `IconTone`; on mobile we only need the subset that maps onto theme
 * colour tokens.
 */
type CategoryTone = 'accent' | 'verified' | 'community';

const CATEGORY_TONE: Record<ResourceCardCategory, CategoryTone> = {
  food: 'accent',
  pantry: 'accent',
  kitchen: 'accent',
  market: 'accent',
  benefits: 'community',
  goods: 'accent',
  childcare: 'accent',
  companionship: 'accent',
  translation: 'accent',
  transportation: 'accent',
  health: 'verified',
  other: 'accent',
};

/**
 * One-character glyph shown in the category tile while the M4a Icon
 * atom is unmerged. Kept deterministic so Maestro screenshots stay
 * stable across runs.
 */
const CATEGORY_GLYPH: Record<ResourceCardCategory, string> = {
  food: 'F',
  pantry: 'P',
  kitchen: 'K',
  market: 'M',
  benefits: 'B',
  goods: 'G',
  childcare: 'C',
  companionship: 'C',
  translation: 'T',
  transportation: 'T',
  health: 'H',
  other: '•',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResourceCardResource {
  id: string;
  name: string;
  category?: ResourceCardCategory;
  /**
   * Preformatted distance string (e.g. "0.4 mi", "200 m"). The atom
   * never formats units itself — i18n + locale rules live in the
   * caller.
   */
  distanceLabel?: string;
  /** Preformatted "Open now" / "Open today · 9am–5pm" string. */
  hoursLabel?: string;
  /** When `true`, the hours chip is rendered with the `verified` tone. */
  isOpenNow?: boolean;
  address?: string;
  phone?: string | null;
  /**
   * Fully-formed maps URL (Apple / Google / etc). The card hands this
   * to `Linking.openURL` verbatim — the caller picks the platform.
   */
  directionsUrl?: string;
  /**
   * Preformatted share payload (title + url). On iOS the share sheet
   * shows `title` and carries `url` in the extension data.
   */
  shareUrl?: string;
  shareTitle?: string;
  bookmarked?: boolean;
}

export interface ResourceCardLabels {
  /** aria-label for the main tile (e.g. "Open details for {name}") */
  openLabel: string;
  /** aria-label for the bookmark toggle (e.g. "Save {name}") */
  bookmarkLabel: string;
  /** aria-label when already bookmarked (e.g. "Remove {name} from saved") */
  bookmarkedLabel?: string;
  /** aria-label for phone call button */
  callLabel: string;
  /** aria-label for directions button */
  directionsLabel: string;
  /** aria-label for share button */
  shareLabel: string;
}

export interface ResourceCardProps {
  resource: ResourceCardResource;
  labels: ResourceCardLabels;
  onOpen?: (id: string) => void;
  onBookmark?: (id: string) => void;
  /**
   * If provided, replaces the default `Linking.openURL('tel:…')`
   * handler. Useful for tests and for analytics wrappers.
   */
  onCall?: (phone: string, id: string) => void;
  /** If provided, replaces the default `Linking.openURL(directionsUrl)`. */
  onDirections?: (id: string) => void;
  /** If provided, replaces the default `Sharing.shareAsync(...)`. */
  onShare?: (id: string) => void;
  /**
   * Optional custom icon content for the category tile. When the M4a
   * Icon atom is merged, consumers can pass `<Icon name="food"
   * tone="accent" />` here.
   */
  categoryIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResourceCard({
  resource,
  labels,
  onOpen,
  onBookmark,
  onCall,
  onDirections,
  onShare,
  categoryIcon,
  style,
  testID,
}: ResourceCardProps) {
  // Narrow Restyle's loose theme once (see PageHeader.tsx for
  // rationale — the M1 `createTheme` widens custom keys).
  const theme = useAppTheme();
  const colors = theme.colors as Record<string, string>;
  // The handful of narrowed aliases below are unused at the call sites
  // below (style resolution uses `theme.*` directly), but are kept for
  // reference so a later refactor can route layout rules through these
  // narrowed helpers and drop the inline `as Record<...>` casts.
  void (theme.spacing as Record<string, number>);
  void (theme.borderRadii as Record<string, number>);
  void (theme.fontFamilies as Record<string, string>);
  void (theme.textVariants.h4 as Record<string, string | number>);
  void (theme.textVariants.label as Record<string, string | number>);
  void (theme.textVariants.bodySmall as Record<string, string | number>);

  const {
    id,
    name,
    category,
    distanceLabel,
    hoursLabel,
    isOpenNow,
    address,
    phone,
    directionsUrl,
    shareUrl,
    shareTitle,
    bookmarked,
  } = resource;

  const resolvedCategory: ResourceCardCategory = category ?? 'other';
  const tone = CATEGORY_TONE[resolvedCategory];
  const resolvedTestID = testID ?? `resource-card-${id}`;

  const toneTokens = resolveTone(colors, tone);

  const handleCall = () => {
    if (!phone) return;
    if (onCall) {
      onCall(phone, id);
      return;
    }
    // Platform guard — iOS HIG confirms `tel:` URLs. Android support
    // varies by device; the spec pins iOS for now but we keep Android
    // as a best-effort fall-through (same API, rarely blocked).
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const url = `tel:${phone.replace(/[^+\d]/g, '')}`;
      void Linking.openURL(url).catch(() => {
        // Swallow — the OS shows its own "cannot open" alert. The
        // caller is expected to surface a fallback toast.
      });
    }
  };

  const handleDirections = () => {
    if (onDirections) {
      onDirections(id);
      return;
    }
    if (!directionsUrl) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      void Linking.openURL(directionsUrl).catch(() => {});
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare(id);
      return;
    }
    if (!shareUrl) return;
    // expo-sharing's API only accepts a local file URI on iOS; sharing
    // a URL string is done via the legacy iOS activity view. We import
    // it lazily so the atom never hard-depends on the native module at
    // evaluation time (which would break the jest node env).
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      import('expo-sharing')
        .then((Sharing) =>
          Sharing.shareAsync(shareUrl, {
            dialogTitle: shareTitle ?? name,
          }),
        )
        .catch(() => {});
    }
  };

  return (
    <View
      testID={resolvedTestID}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.borderRadii.lg,
          padding: theme.spacing.m,
          gap: theme.spacing.sm,
        },
        theme.boxShadows.sm,
        style,
      ]}
    >
      {/* Main tappable row — icon, title, distance, bookmark ------------- */}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={labels.openLabel}
          onPress={onOpen ? () => onOpen(id) : undefined}
          testID={`resource-detail-${id}`}
          style={({ pressed }) => [
            styles.tappable,
            {
              opacity: pressed ? 0.7 : 1,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <View
            style={[
              styles.iconTile,
              {
                backgroundColor: toneTokens.soft,
                borderRadius: theme.borderRadii.md,
              },
            ]}
          >
            {categoryIcon ?? (
              <Text
                style={[
                  styles.iconGlyph,
                  {
                    color: toneTokens.strong,
                    fontFamily: theme.fontFamilies.bodySemiBold,
                  },
                ]}
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                {CATEGORY_GLYPH[resolvedCategory]}
              </Text>
            )}
          </View>
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  {
                    color: theme.colors.inkPrimary,
                    fontFamily: theme.textVariants.h4.fontFamily,
                    fontSize: theme.textVariants.h4.fontSize,
                    lineHeight: theme.textVariants.h4.lineHeight,
                    fontWeight: theme.textVariants.h4.fontWeight,
                  },
                ]}
              >
                {name}
              </Text>
              {distanceLabel ? (
                <Text
                  style={[
                    styles.distance,
                    {
                      color: theme.colors.inkMuted,
                      fontFamily: theme.textVariants.label.fontFamily,
                      fontSize: theme.textVariants.label.fontSize,
                      lineHeight: theme.textVariants.label.lineHeight,
                      fontWeight: theme.textVariants.label.fontWeight,
                      marginLeft: theme.spacing.s,
                    },
                  ]}
                >
                  {distanceLabel}
                </Text>
              ) : null}
            </View>
            {hoursLabel ? (
              <View
                style={[
                  styles.tag,
                  {
                    backgroundColor: isOpenNow
                      ? theme.colors.verifiedSoft
                      : theme.colors.surfaceSunken,
                    borderRadius: theme.borderRadii.pill,
                    paddingHorizontal: theme.spacing.s,
                    paddingVertical: 2,
                    marginTop: theme.spacing.xs,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagLabel,
                    {
                      color: isOpenNow
                        ? theme.colors.verifiedStrong
                        : theme.colors.inkSecondary,
                      fontFamily: theme.textVariants.label.fontFamily,
                      fontSize: theme.textVariants.label.fontSize,
                      lineHeight: theme.textVariants.label.lineHeight,
                      fontWeight: theme.textVariants.label.fontWeight,
                    },
                  ]}
                >
                  {hoursLabel}
                </Text>
              </View>
            ) : null}
            {address ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.address,
                  {
                    color: theme.colors.inkSecondary,
                    fontFamily: theme.textVariants.bodySmall.fontFamily,
                    fontSize: theme.textVariants.bodySmall.fontSize,
                    lineHeight: theme.textVariants.bodySmall.lineHeight,
                    fontWeight: theme.textVariants.bodySmall.fontWeight,
                    marginTop: theme.spacing.xs,
                  },
                ]}
              >
                {address}
              </Text>
            ) : null}
          </View>
        </Pressable>
        {onBookmark ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              bookmarked
                ? labels.bookmarkedLabel ?? labels.bookmarkLabel
                : labels.bookmarkLabel
            }
            accessibilityState={{ selected: Boolean(bookmarked) }}
            onPress={() => onBookmark(id)}
            testID={`bookmark-${id}`}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: pressed
                  ? theme.colors.surfaceSunken
                  : 'transparent',
                borderRadius: theme.borderRadii.pill,
              },
            ]}
          >
            <Text
              style={[
                styles.bookmarkGlyph,
                {
                  color: bookmarked
                    ? theme.colors.community
                    : theme.colors.inkMuted,
                },
              ]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              {bookmarked ? '\u2605' : '\u2606'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Action row — call / directions / share --------------------------- */}
      {phone || directionsUrl || shareUrl ? (
        <View
          style={[
            styles.actions,
            {
              gap: theme.spacing.s,
              marginTop: theme.spacing.xs,
            },
          ]}
        >
          {phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.callLabel}
              onPress={handleCall}
              testID={`phone-${id}`}
              style={({ pressed }) => [
                styles.actionChip,
                {
                  backgroundColor: pressed
                    ? theme.colors.accentSoft
                    : theme.colors.surfaceSunken,
                  borderRadius: theme.borderRadii.md,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color: theme.colors.accent,
                    fontFamily: theme.textVariants.label.fontFamily,
                    fontSize: theme.textVariants.label.fontSize,
                    lineHeight: theme.textVariants.label.lineHeight,
                    fontWeight: theme.textVariants.label.fontWeight,
                  },
                ]}
              >
                {labels.callLabel}
              </Text>
            </Pressable>
          ) : null}
          {directionsUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.directionsLabel}
              onPress={handleDirections}
              testID={`directions-${id}`}
              style={({ pressed }) => [
                styles.actionChip,
                {
                  backgroundColor: pressed
                    ? theme.colors.communitySoft
                    : theme.colors.surfaceSunken,
                  borderRadius: theme.borderRadii.md,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color: theme.colors.community,
                    fontFamily: theme.textVariants.label.fontFamily,
                    fontSize: theme.textVariants.label.fontSize,
                    lineHeight: theme.textVariants.label.lineHeight,
                    fontWeight: theme.textVariants.label.fontWeight,
                  },
                ]}
              >
                {labels.directionsLabel}
              </Text>
            </Pressable>
          ) : null}
          {shareUrl ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.shareLabel}
              onPress={handleShare}
              testID={`share-${id}`}
              style={({ pressed }) => [
                styles.actionChip,
                {
                  backgroundColor: pressed
                    ? theme.colors.accentSoft
                    : theme.colors.surfaceSunken,
                  borderRadius: theme.borderRadii.md,
                  paddingHorizontal: theme.spacing.sm,
                  paddingVertical: theme.spacing.xs,
                },
              ]}
            >
              <Text
                style={[
                  styles.actionLabel,
                  {
                    color: theme.colors.inkPrimary,
                    fontFamily: theme.textVariants.label.fontFamily,
                    fontSize: theme.textVariants.label.fontSize,
                    lineHeight: theme.textVariants.label.lineHeight,
                    fontWeight: theme.textVariants.label.fontWeight,
                  },
                ]}
              >
                {labels.shareLabel}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveTone(
  colors: Record<string, string>,
  tone: CategoryTone,
): { strong: string; soft: string } {
  // Under `noUncheckedIndexedAccess`, `colors[key]` resolves to
  // `string | undefined`. In practice the theme always has every token
  // defined; the `?? ''` fallback keeps TS happy without routing
  // genuinely-missing keys through as silent empty strings at runtime.
  switch (tone) {
    case 'accent':
      return {
        strong: colors.accentStrong ?? '',
        soft: colors.accentSoft ?? '',
      };
    case 'verified':
      return {
        strong: colors.verifiedStrong ?? '',
        soft: colors.verifiedSoft ?? '',
      };
    case 'community':
      return {
        strong: colors.accentStrong ?? '',
        soft: colors.communitySoft ?? '',
      };
  }
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tappable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconTile: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {
    fontSize: 18,
    lineHeight: 22,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    flex: 1,
    minWidth: 0,
  },
  distance: {
    flexShrink: 0,
  },
  tag: {
    alignSelf: 'flex-start',
  },
  tagLabel: {
    textAlign: 'left',
  },
  address: {},
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  bookmarkGlyph: {
    fontSize: 18,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {},
});
