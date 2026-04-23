/**
 * Onboarding · Location gate — S6.
 *
 * Port of `apps/pwa/src/components/location-gate-screen.tsx`. Step 2 of
 * the funnel. Collects a 5-digit ZIP to seed the resource directory
 * query. V1-B removed two older affordances from the PWA and this port
 * keeps them removed so the mobile flow mirrors the current-best PWA:
 *
 *   1. V1-B Task 3 — the "Use my device location" button. The PWA
 *      originally granted permission, got coords, and then told the
 *      user "we couldn't use your location" because no reverse-geocoder
 *      existed. Until that gateway endpoint ships we hide the
 *      affordance on mobile too. (The OS permission prompt is real on
 *      native, so the lie would be even more obvious here.)
 *   2. V1-B Task 6 — the bare "Skip" dead-end. Previously flipped
 *      `onboardingComplete=true` with no ZIP, leaving Home stuck on a
 *      "set your ZIP" empty state with a link back to Settings (a
 *      loop). Replaced with a "Use sample neighborhood" CTA that seeds
 *      11368 (Corona / Elmhurst, Queens — the pilot anchor
 *      neighborhood) so Home lands on real results, with a footnote
 *      explaining the provenance.
 *
 * testid preservation:
 *   - `onboarding-location-zip-input` — ZIP text input (shared hook)
 *   - `onboarding-location-submit` — primary submit button
 *   - `onboarding-location-skip` — repurposed as the sample-neighborhood
 *     CTA; testid preserved so future Detox specs continue to find it.
 *
 * On submit we:
 *   1. Validate `/^\d{5}$/` and surface an inline error otherwise.
 *   2. Dispatch `setZipCode(zip)` + `completeOnboarding()` to persist
 *      the user's answer to the preferences slice.
 *   3. `router.replace('/')` to land the user on the Home tab. Using
 *      `replace` (not `push`) means the back button on Home won't
 *      bounce the user back into the funnel — onboarding is
 *      one-direction by design.
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Field, Stack } from '@/components/ui';
import { loadNamespace } from '@/i18n';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPreferences } from '@/lib/selectors';
import {
  completeOnboarding,
  setZipCode,
} from '@/lib/slices/preferences-slice';
import { useAppTheme } from '@/theme';

/**
 * Fallback ZIP when the user taps "Use a sample neighborhood". 11368
 * covers Corona / Elmhurst in Queens, which is the pilot anchor
 * neighborhood with the densest resource coverage in the directory.
 * Kept as a module constant so the choice is one edit away from the
 * docblock that explains the rationale — no magic number hunting in
 * three months.
 */
const SAMPLE_NEIGHBORHOOD_ZIP = '11368';

export default function OnboardingLocationScreen() {
  const { t } = useTranslation('onboarding');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const preferences = useAppSelector(selectPreferences);

  const [localZip, setLocalZip] = useState(preferences.zipCode);
  const [zipError, setZipError] = useState<string | null>(null);

  useEffect(() => {
    void loadNamespace('onboarding');
  }, []);

  const handleSubmit = () => {
    if (!/^\d{5}$/.test(localZip)) {
      setZipError(t('onboardingLocationZipInvalid'));
      return;
    }
    setZipError(null);
    dispatch(setZipCode(localZip));
    dispatch(completeOnboarding());
    // `replace` so the user can't back-swipe into the funnel from Home.
    router.replace('/');
  };

  const handleUseSample = () => {
    dispatch(setZipCode(SAMPLE_NEIGHBORHOOD_ZIP));
    dispatch(completeOnboarding());
    router.replace('/');
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/onboarding/language');
    }
  };

  const colors = theme.colors as Record<string, string>;
  const spaceXs = (theme.spacing.xs as number | undefined) ?? 4;
  const spaceS = (theme.spacing.s as number | undefined) ?? 8;
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
        <View style={styles.topRow}>
          <Text
            accessibilityRole="button"
            accessibilityLabel={t('obLocBack')}
            onPress={handleBack}
            testID="onboarding-location-back"
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
            {t('onboardingStepLocation')}
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
            {t('obLocTitle')}
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
            {t('obLocSubtitle')}
          </Text>
        </View>

        <Field
          testID="onboarding-location-zip-input"
          label={t('obLocZipLabel')}
          hint={t('onboardingLocationPrivacyNote')}
          error={zipError ?? undefined}
          value={localZip}
          onChangeText={(next) => {
            // Strip non-digits + clamp to 5 chars. Mirrors the PWA's
            // `replace(/\D/g, '').slice(0, 5)` so paste-from-clipboard
            // ("ZIP 11368") behaves identically on both platforms.
            setZipError(null);
            setLocalZip(next.replace(/\D/g, '').slice(0, 5));
          }}
          keyboardType="number-pad"
          placeholder={t('onboardingLocationZipPlaceholder')}
        />

        <Stack gap="s">
          <Button
            testID="onboarding-location-submit"
            variant="primary"
            size="lg"
            onPress={handleSubmit}
          >
            {t('obLocCta')}
          </Button>
          <Button
            testID="onboarding-location-skip"
            variant="ghost"
            size="lg"
            onPress={handleUseSample}
          >
            {t('obLocUseSample')}
          </Button>
        </Stack>

        <Text
          style={{
            color: colors.inkMuted,
            fontSize: theme.textVariants.micro.fontSize as number,
            lineHeight: theme.textVariants.micro.lineHeight as number,
          }}
        >
          {t('obLocSampleHint')}
        </Text>
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
});
