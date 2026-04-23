/**
 * Onboarding · Trust explainer — S6.
 *
 * Port of `apps/pwa/src/components/trust-onboarding-screen.tsx`. Step 1.5
 * of the funnel (`language → trust → location`). A user opening the app
 * for the first time has no signal that WeaveNYC:
 *   1. never asks for legal ID / SSN / status,
 *   2. only shows proximity-local services,
 *   3. keeps their data on the device.
 * Three bullets put the framing up front before the user hands over any
 * information at all (ZIP on the next screen).
 *
 * V2-E: bullet 3 was "neighbors vouch for neighbors" when the anchor
 * model first shipped in the PWA, but no anchor signal surfaces in the
 * UX yet, so the claim was unsupported. The PWA copy was updated to
 * "Your info stays on this phone"; the mobile port adopts the corrected
 * copy via the same i18n key (`trustBullet3Title`). The test id
 * `trust-bullet-anchors` stays — it's a stable E2E hook regardless of
 * the underlying concept.
 *
 * Routing:
 *   - Primary CTA advances to `/onboarding/location`. `push` keeps the
 *     back gesture active so a user who wants to tweak their language
 *     can backtrack.
 *   - Secondary `Tell me more` deep-links to `/privacy`. The mobile
 *     privacy page ships in a later wave; until then the tap is a no-op
 *     route that the expo-router runtime handles with its fallback
 *     404. Rather than hard-code a disabled state here, we point at the
 *     eventual destination so the link becomes live the moment
 *     `app/privacy.tsx` lands (S7 or later). We use `router.push`
 *     through a guard rather than a direct link so no extra atom (Link)
 *     is required.
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Stack } from '@/components/ui';
import { loadNamespace } from '@/i18n';
import { useAppTheme } from '@/theme';

/**
 * Bullet definitions. The three icons are emoji rather than Icon atom
 * glyphs because the concepts (shield / pin / phone) don't map cleanly
 * to the brand icon set yet — an emoji is the closest scalable option
 * that reads the same on light and dark mode. `testId` values match the
 * PWA so a shared Maestro / Detox spec can target either platform.
 */
type TrustBullet = {
  icon: string;
  titleKey: 'trustBullet1Title' | 'trustBullet2Title' | 'trustBullet3Title';
  testId: string;
};

const TRUST_BULLETS: ReadonlyArray<TrustBullet> = [
  { icon: '\u{1F6E1}', titleKey: 'trustBullet1Title', testId: 'trust-bullet-id' },
  { icon: '\u{1F4CD}', titleKey: 'trustBullet2Title', testId: 'trust-bullet-nearby' },
  { icon: '\u{1F4F1}', titleKey: 'trustBullet3Title', testId: 'trust-bullet-anchors' },
];

export default function OnboardingTrustScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void loadNamespace('onboarding');
  }, []);

  const handleContinue = () => {
    router.push('/onboarding/location');
  };

  const handleLearnMore = () => {
    // The privacy page is a later-wave import; route to the eventual
    // path so the link lights up automatically once the screen lands.
    router.push('/privacy');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback if a user deep-links directly to trust without going
      // through language — send them one step back in the funnel.
      router.replace('/onboarding/language');
    }
  };

  const colors = theme.colors as Record<string, string>;
  const spaceXs = (theme.spacing.xs as number | undefined) ?? 4;
  const spaceS = (theme.spacing.s as number | undefined) ?? 8;
  const spaceM = (theme.spacing.m as number | undefined) ?? 16;
  const spaceL = (theme.spacing.l as number | undefined) ?? 24;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[
        styles.container,
        {
          paddingTop: insets.top + spaceL,
          paddingBottom: insets.bottom + spaceL,
          paddingHorizontal: spaceL,
        },
      ]}
    >
      <Stack gap="l">
        {/* Custom back affordance — we bypass the Stack header (see
            `_layout.tsx` rationale) and render the glyph inline so it
            shares typography with the rest of the onboarding copy. */}
        <View style={styles.topRow}>
          <Text
            accessibilityRole="button"
            accessibilityLabel={t('obLocBack')}
            onPress={handleBack}
            testID="onboarding-trust-back"
            style={{
              color: colors.inkPrimary,
              fontSize: 22,
              padding: spaceXs,
            }}
          >
            {'\u2190'}
          </Text>
        </View>

        <View>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.accent, marginBottom: spaceXs },
            ]}
          >
            {t('onboardingStepTrust')}
          </Text>
          <Text
            style={[
              styles.title,
              {
                color: colors.inkPrimary,
                fontSize: theme.textVariants.h1.fontSize as number,
                lineHeight: theme.textVariants.h1.lineHeight as number,
              },
            ]}
          >
            {t('obTrustTitle')}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: colors.inkSecondary,
                fontSize: theme.textVariants.body.fontSize as number,
                lineHeight: theme.textVariants.body.lineHeight as number,
                marginTop: spaceS,
              },
            ]}
          >
            {t('obTrustSubtitle')}
          </Text>
        </View>

        <Stack gap="m">
          {TRUST_BULLETS.map((bullet) => (
            <View
              key={bullet.testId}
              testID={bullet.testId}
              style={[styles.bullet, { gap: spaceM }]}
            >
              <Text
                accessibilityElementsHidden
                style={{ fontSize: 28, lineHeight: 32 }}
              >
                {bullet.icon}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: colors.inkPrimary,
                  fontSize: theme.textVariants.h3.fontSize as number,
                  lineHeight: theme.textVariants.h3.lineHeight as number,
                  fontWeight: '600',
                }}
              >
                {t(bullet.titleKey)}
              </Text>
            </View>
          ))}
        </Stack>

        <Stack gap="s">
          <Button
            testID="onboarding-trust-continue"
            variant="primary"
            size="lg"
            onPress={handleContinue}
          >
            {t('obTrustCta')}
          </Button>
          <Button
            testID="onboarding-trust-learn-more"
            variant="ghost"
            size="lg"
            onPress={handleLearnMore}
            haptic={false}
          >
            {t('obTrustLearnMore')}
          </Button>
        </Stack>
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    fontWeight: '600',
  },
  subtitle: {
    // sizing + marginTop come from the theme at render time
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
