/**
 * Me hub — directory page for account / language / privacy / verify / danger.
 *
 * Mobile port of `apps/pwa/src/components/me-screen.tsx`. The screen is a
 * thin list of `Card` rows; each row navigates to a sub-route
 * (`/me/settings`, `/me/danger`, `/privacy`, `/verify`) via Expo Router.
 * The only action executed locally is sign-out, which defers to
 * `useSignOut()` just like the PWA does.
 *
 * Level pill
 * ----------
 * The user's level (`anonymous | verified | anchor`) surfaces as a Tag in
 * the header card. We localize the three labels through the `me` namespace
 * so ZH / ES users see the matching phrase.
 */

import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  Icon,
  Inline,
  PageHeader,
  Stack,
  Tag,
} from '@/components/ui';
import { loadNamespace } from '@/i18n';
import type { Resources } from '@/i18n/types';
import { useAppSelector } from '@/lib/hooks';
import {
  selectIsVerified,
  selectPreferences,
  selectSession,
} from '@/lib/selectors';
import { useSignOut } from '@/lib/use-sign-out';
import { useAppTheme } from '@/theme';
import type { SupportedLanguage, UserLevel } from '@/lib/types';

type MeKey = keyof Resources['me'];

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  es: 'Español',
  zh: '中文',
};

const LEVEL_KEY: Record<UserLevel, MeKey> = {
  anonymous: 'settingsAccountLevelAnonymous',
  verified: 'settingsAccountLevelVerified',
  anchor: 'settingsAccountLevelAnchor',
};

export default function MeTab() {
  const { t } = useTranslation('me');
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const prefs = useAppSelector(selectPreferences);
  const isVerified = useAppSelector(selectIsVerified);
  const session = useAppSelector(selectSession);
  const signOut = useSignOut();

  useEffect(() => {
    void loadNamespace('me');
  }, []);

  const level: UserLevel = session?.user.level ?? 'anonymous';
  const levelLabel = t(LEVEL_KEY[level]);
  const verifyCaption = isVerified
    ? t('meVerifyStatusVerified')
    : t('meVerifyStatusUnverified');
  const currentLang = LANGUAGE_LABELS[prefs.language] ?? LANGUAGE_LABELS.en;

  const colors = theme.colors as Record<string, string>;
  const spacing = theme.spacing as unknown as Record<
    'xs' | 's' | 'sm' | 'm' | 'l' | 'xl',
    number
  >;

  return (
    <ScrollView
      testID="me-hub"
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + spacing.l,
        paddingHorizontal: spacing.l,
      }}
    >
      <PageHeader title={t('meTitle')} testID="me-header" />

      <Stack gap="l">
        <Card testID="me-account-header">
          <Stack gap="xs">
            <Inline gap="s" align="center">
              <Text
                style={{
                  color: colors.inkPrimary,
                  fontSize: 18,
                  lineHeight: 24,
                  fontWeight: '600',
                }}
              >
                {session
                  ? `WeaveNYC ${session.user.user_id.slice(0, 6)}`
                  : t('meNotSignedIn')}
              </Text>
              <Tag tone={isVerified ? 'verified' : 'neutral'} testID="me-level-pill">
                {levelLabel}
              </Tag>
            </Inline>
            <Text style={[styles.caption, { color: colors.inkMuted }]}>
              {verifyCaption}
            </Text>
          </Stack>
        </Card>

        <NavRow
          testID="me-row-account"
          label={t('meSectionAccount')}
          onPress={() => router.push('/me/settings')}
        />

        <NavRow
          testID="me-row-language"
          label={t('meSectionLanguage')}
          trailingLabel={currentLang}
          onPress={() => router.push('/me/settings')}
        />

        <NavRow
          testID="me-row-privacy"
          label={t('meSectionPrivacy')}
          onPress={() => router.push('/privacy')}
        />

        <Card testID="me-verify-card">
          <Stack gap="s">
            <Inline gap="s" justify="between" align="center">
              <Text style={{ color: colors.inkPrimary, fontSize: 16, fontWeight: '600' }}>
                {t('meSectionVerify')}
              </Text>
              {isVerified ? (
                <Tag tone="verified">{t('meVerifyStatusVerified')}</Tag>
              ) : null}
            </Inline>
            {!isVerified ? (
              <>
                <Text style={[styles.caption, { color: colors.inkSecondary }]}>
                  {t('meVerifyHelper')}
                </Text>
                <Button
                  testID="me-verify-cta"
                  variant="primary"
                  size="md"
                  onPress={() => router.push('/verify')}
                >
                  {t('meActionVerifyIdentity')}
                </Button>
              </>
            ) : null}
          </Stack>
        </Card>

        {session ? (
          <Card testID="me-signout-card">
            <Stack gap="xs">
              <Button
                testID="me-sign-out"
                variant="ghost"
                size="md"
                onPress={() => {
                  void signOut();
                }}
              >
                {t('meActionSignOut')}
              </Button>
              <Text style={[styles.caption, { color: colors.inkMuted }]}>
                {t('meSignOutHint')}
              </Text>
            </Stack>
          </Card>
        ) : null}

        <View style={styles.dangerZone}>
          <Text
            style={[
              styles.overline,
              { color: colors.danger, marginBottom: spacing.s },
            ]}
          >
            {t('meSectionDanger')}
          </Text>
          <Card testID="me-danger-card">
            <Stack gap="s">
              <Stack gap="xs">
                <Text style={{ color: colors.inkPrimary, fontSize: 16, fontWeight: '600' }}>
                  {t('meDangerTitle')}
                </Text>
                <Text style={[styles.caption, { color: colors.inkMuted }]}>
                  {t('meDangerSubtitle')}
                </Text>
              </Stack>
              <Button
                testID="me-danger-cta"
                variant="danger"
                size="md"
                onPress={() => router.push('/me/danger')}
              >
                {t('meDangerCta')}
              </Button>
            </Stack>
          </Card>
        </View>
      </Stack>
    </ScrollView>
  );
}

/**
 * NavRow — a tappable `Card` row showing a label + optional trailing text +
 * a chevron. Uses the existing Button atom for a11y + press handling and
 * lets the Card supply the surface + border.
 */
function NavRow({
  testID,
  label,
  trailingLabel,
  onPress,
}: {
  testID: string;
  label: string;
  trailingLabel?: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const colors = theme.colors as Record<string, string>;

  return (
    <Card testID={testID}>
      <Button
        testID={`${testID}-button`}
        variant="ghost"
        size="md"
        haptic={false}
        onPress={onPress}
        style={{ alignSelf: 'stretch', paddingHorizontal: 0, paddingVertical: 0 }}
      >
        <Inline gap="s" justify="between" align="center" style={{ flex: 1, width: '100%' }}>
          <Text style={{ color: colors.inkPrimary, fontSize: 16, fontWeight: '500' }}>
            {label}
          </Text>
          <Inline gap="xs" align="center">
            {trailingLabel ? (
              <Tag tone="neutral">{trailingLabel}</Tag>
            ) : null}
            <Icon name="chevron-right" size="sm" tone="muted" />
          </Inline>
        </Inline>
      </Button>
    </Card>
  );
}

const styles = StyleSheet.create({
  caption: {
    fontSize: 13,
    lineHeight: 18,
  },
  overline: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  dangerZone: {
    marginTop: 8,
  },
});
