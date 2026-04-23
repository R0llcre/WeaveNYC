/**
 * Privacy screen — static "how we protect you" copy.
 *
 * Mobile port of `apps/pwa/src/components/privacy-screen.tsx`. The PWA
 * version is intentionally single-paragraph; we stay faithful and render
 * the one `privacyLede` string inside a `Card` for visual weight.
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, PageHeader, Stack } from '@/components/ui';
import { loadNamespace } from '@/i18n';
import { useAppTheme } from '@/theme';

export default function PrivacyScreen() {
  const { t } = useTranslation(['privacy', 'chrome']);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void loadNamespace('privacy');
  }, []);

  const colors = theme.colors as Record<string, string>;
  const spacing = theme.spacing as unknown as Record<
    'xs' | 's' | 'sm' | 'm' | 'l' | 'xl',
    number
  >;

  return (
    <ScrollView
      testID="privacy-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.l,
      }}
    >
      <PageHeader
        title={t('privacy:privacyTitle')}
        onBack={() => router.back()}
        backAccessibilityLabel={t('chrome:shellBackButton')}
        testID="privacy-header"
      />

      <Stack gap="l">
        <Text
          testID="privacy-eyebrow"
          style={[styles.eyebrow, { color: colors.accent }]}
        >
          {t('privacy:privacyEyebrow')}
        </Text>
        <Card testID="privacy-card">
          <Text
            testID="privacy-lede"
            style={[
              styles.lede,
              { color: colors.inkPrimary },
            ]}
          >
            {t('privacy:privacyLede')}
          </Text>
        </Card>
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  lede: {
    fontSize: 16,
    lineHeight: 24,
  },
});
