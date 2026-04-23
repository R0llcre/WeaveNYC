/**
 * HomeWizard — crisis-first 4-card intent picker (mobile).
 *
 * RN port of `apps/pwa/src/components/home-wizard.tsx` (V2-D). Same
 * product rationale: a neighbor in food / health / housing stress
 * shouldn't have to translate "I'm hungry tonight" into "is it a pantry
 * or a kitchen?". Four big plain-language cards let them pick the shape
 * of their need in one tap; dispatching `setLastIntent(intent)` swaps
 * the home tab over to `<ResourceDirectory />` on the next render, and
 * the pick is persisted to the preferences slice so a returning user
 * lands on the same pre-filtered directory they chose last time.
 *
 * Intent → filter mapping (re-implemented in ResourceDirectory.tsx —
 * keep the two in sync):
 *   - food_now  → { type: 'all',      openNow: true }
 *   - food_week → { type: 'pantry',   today:   true }
 *   - doctor    → { type: 'benefits' }
 *   - sleep     → { type: 'other'    }
 *
 * testIDs exposed (Maestro / E2E):
 *   - `home-wizard`      — wizard root View.
 *   - `need-food-now`    — "I'm hungry right now" card.
 *   - `need-food-week`   — "Food for my family this week" card.
 *   - `need-doctor`      — "I need to see a doctor" card.
 *   - `need-sleep`       — "A safe place to sleep" card.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Icon, Stack, type IconName } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPreferences } from '@/lib/selectors';
import { setLastIntent } from '@/lib/slices/preferences-slice';
import type { HomeIntent } from '@/lib/types';
import { useAppTheme } from '@/theme';

/**
 * Local numeric coercion. The Restyle `BaseTheme` contract widens every
 * spacing / border-radius token to `string | number | undefined`, while
 * our real tokens (`@/theme/tokens.ts`) are always numeric. Centralising
 * the narrow keeps the JSX below free of `as number` noise.
 */
function num(value: string | number | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

/**
 * Card-level descriptor. The keys are identical to the PWA version so a
 * design review can diff the two side-by-side and the i18n bundle stays
 * single-sourced across platforms (see `src/locales/<locale>/home.json`).
 */
type NeedCard = {
  intent: HomeIntent;
  testID: string;
  iconName: IconName;
  titleKey: 'needFoodNow' | 'needFoodWeek' | 'needDoctor' | 'needSleep';
  subtitleKey:
    | 'needFoodNowSubtitle'
    | 'needFoodWeekSubtitle'
    | 'needDoctorSubtitle'
    | 'needSleepSubtitle';
};

const NEED_CARDS: ReadonlyArray<NeedCard> = [
  {
    intent: 'food_now',
    testID: 'need-food-now',
    iconName: 'meal',
    titleKey: 'needFoodNow',
    subtitleKey: 'needFoodNowSubtitle',
  },
  {
    intent: 'food_week',
    testID: 'need-food-week',
    iconName: 'food',
    titleKey: 'needFoodWeek',
    subtitleKey: 'needFoodWeekSubtitle',
  },
  {
    intent: 'doctor',
    testID: 'need-doctor',
    iconName: 'health',
    titleKey: 'needDoctor',
    subtitleKey: 'needDoctorSubtitle',
  },
  {
    intent: 'sleep',
    testID: 'need-sleep',
    iconName: 'housing',
    titleKey: 'needSleep',
    subtitleKey: 'needSleepSubtitle',
  },
];

export function HomeWizard() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);
  // react-i18next's `useTranslation` returns a typed `t` narrowed to the
  // default namespace (`chrome`). The home-namespace keys we need live
  // under `home` so we pass it as the namespace arg; TS still resolves
  // the `t` callable against the custom-type-options `chrome` dictionary
  // which is why the call sites below pass keys as plain strings via an
  // untyped `tr` alias — the runtime behaviour is correct (react-i18next
  // looks up the `home` namespace bundle) but the type system has no
  // way to re-narrow `t` against a non-default NS without a module-
  // augmentation overload per namespace. Aliasing to `any` keeps the
  // compile path clean; every key used below is statically listed in
  // `src/locales/en/home.json` and covered by the i18n-parity CI step.
  const { t } = useTranslation('home');
  const tr = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  const s = {
    xs: num(theme.spacing.xs, 4),
    s: num(theme.spacing.s, 8),
    sm: num(theme.spacing.sm, 12),
    m: num(theme.spacing.m, 16),
    l: num(theme.spacing.l, 24),
    xxl: num(theme.spacing.xxl, 32),
  };
  const radii = {
    md: num(theme.borderRadii?.md, 6),
    lg: num(theme.borderRadii?.lg, 8),
  };

  const handlePick = (intent: HomeIntent) => {
    // Dispatch alone is enough — the parent page re-reads
    // `preferences.lastIntent` and swaps wizard → directory on the next
    // render. No router.push to avoid adding a no-op history entry.
    dispatch(setLastIntent(intent));
  };

  return (
    <ScrollView
      testID="home-wizard"
      accessibilityLabel={tr('wizardTitle')}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingTop: insets.top + s.l,
          paddingBottom: s.xxl,
          paddingHorizontal: s.l,
          backgroundColor: theme.colors.bg,
        },
      ]}
      style={{ backgroundColor: theme.colors.bg }}
    >
      <Stack gap="xl">
        {/* Hero — eyebrow + headline + subtitle. Kept small on mobile so
            the four need-cards land above the fold on a typical 375pt
            viewport. */}
        <View>
          <Text
            style={[
              styles.eyebrow,
              {
                color: theme.colors.accent,
                fontSize: theme.textVariants.micro.fontSize,
                lineHeight: theme.textVariants.micro.lineHeight,
                marginBottom: s.s,
              },
            ]}
          >
            {tr('homeHeroEyebrow')}
          </Text>
          <Text
            accessibilityRole="header"
            style={[
              styles.headline,
              {
                color: theme.colors.inkPrimary,
                fontSize: theme.textVariants.h1.fontSize,
                lineHeight: theme.textVariants.h1.lineHeight,
                fontWeight: theme.textVariants.h1.fontWeight as '600',
              },
            ]}
          >
            {tr('wizardTitle')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.inkSecondary,
                fontSize: theme.textVariants.body.fontSize,
                lineHeight: theme.textVariants.body.lineHeight,
                marginTop: s.s,
              },
            ]}
          >
            {tr('wizardSubtitle')}
          </Text>
        </View>

        {/* 4-card grid — stacked vertically on phone. Each card is a big
            tappable with icon tile + title + subtitle. Kept as raw
            Pressable (not `Button`) because Button is a label-only CTA
            atom; these need a multi-line layout with an icon tile. */}
        <Stack gap="m">
          {NEED_CARDS.map((card) => (
            <Pressable
              key={card.intent}
              testID={card.testID}
              accessibilityRole="button"
              accessibilityLabel={`${tr(card.titleKey)}. ${tr(card.subtitleKey)}`}
              onPress={() => handlePick(card.intent)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: radii.lg,
                  padding: s.m,
                  opacity: pressed ? 0.85 : 1,
                  gap: s.sm,
                },
                theme.boxShadows.sm,
              ]}
            >
              <View
                style={[
                  styles.iconTile,
                  {
                    backgroundColor: theme.colors.accentSoft,
                    borderRadius: radii.md,
                  },
                ]}
              >
                <Icon name={card.iconName} size="lg" tone="accent" />
              </View>
              <View style={styles.cardBody}>
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: theme.colors.inkPrimary,
                      fontSize: theme.textVariants.h3.fontSize,
                      lineHeight: theme.textVariants.h3.lineHeight,
                      fontWeight: theme.textVariants.h3.fontWeight as '600',
                    },
                  ]}
                >
                  {tr(card.titleKey)}
                </Text>
                <Text
                  style={[
                    styles.cardSubtitle,
                    {
                      color: theme.colors.inkSecondary,
                      fontSize: theme.textVariants.bodySmall.fontSize,
                      lineHeight: theme.textVariants.bodySmall.lineHeight,
                      marginTop: s.xs,
                    },
                  ]}
                >
                  {tr(card.subtitleKey)}
                </Text>
              </View>
            </Pressable>
          ))}
        </Stack>

        {/* ZIP status footnote mirrors the PWA pattern. Hidden entirely
            when the user hasn't set a ZIP yet — nothing actionable to
            surface. */}
        {preferences.zipCode ? (
          <Text
            style={[
              styles.footnote,
              {
                color: theme.colors.inkMuted,
                fontSize: theme.textVariants.bodySmall.fontSize,
                lineHeight: theme.textVariants.bodySmall.lineHeight,
              },
            ]}
          >
            {tr('homeZipStatus', { zip: preferences.zipCode })}
          </Text>
        ) : null}
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  eyebrow: {
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headline: {},
  subtitle: {},
  card: {
    borderWidth: 1,
  },
  iconTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {},
  cardTitle: {},
  cardSubtitle: {},
  footnote: {
    textAlign: 'center',
  },
});
