/**
 * PlaceholderScreen — simple "coming soon" stub used by every M1 tab.
 *
 * Uses the Restyle theme directly via `useAppTheme()` (not via Box/Text
 * prop shorthands) so that the scaffold compiles today without the
 * full Restyle component factory that wave B will add.
 */

import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export function PlaceholderScreen({ titleKey }: { titleKey: string }) {
  const theme = useAppTheme();
  const { t } = useTranslation('chrome');
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: insets.top + (theme.spacing.xl as number),
          paddingHorizontal: theme.spacing.l as number,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.inkPrimary,
            fontSize: theme.textVariants.h1.fontSize as number,
            lineHeight: theme.textVariants.h1.lineHeight as number,
          },
        ]}
      >
        {(t as (k: string) => string)(titleKey)}
      </Text>
      <Text
        style={[
          styles.eyebrow,
          { color: theme.colors.accent, marginTop: theme.spacing.m as number },
        ]}
      >
        {t('comingSoon')}
      </Text>
      <Text
        style={[
          styles.body,
          {
            color: theme.colors.inkSecondary,
            marginTop: theme.spacing.l as number,
            fontSize: theme.textVariants.body.fontSize as number,
            lineHeight: theme.textVariants.body.lineHeight as number,
          },
        ]}
      >
        {t('placeholderBody')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  body: {
    maxWidth: 420,
  },
});
