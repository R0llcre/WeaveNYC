/**
 * VerifyScreen — S1 OTP + magic-link verify flow for the mobile app.
 *
 * Port of `apps/pwa/src/components/verify-screen.tsx` to React Native. The
 * state machine (bootstrap → start → verify → finish) is identical to the
 * PWA version but routes surface UI through the Wave B atom set
 * (Button / Card / Field / Banner / Stack / Inline / PageHeader / Toast)
 * and uses `expo-linking` instead of Next.js's useSearchParams for the
 * universal-link intake.
 *
 * Two entry paths (each wraps this component):
 *
 *   - `apps/mobile/app/verify.tsx` — root entry, no back button.
 *   - `apps/mobile/app/me/verify.tsx` — Me-hub entry, renders the "Back
 *     to Me" affordance via the `onBack` prop.
 *
 * Tabs
 * ----
 *   SMS code  — phone field + Send code + 6-digit OTP code field + Verify.
 *   Email link — email field + Send link + "check your inbox" banner.
 *                Tapping the link in the user's email hits
 *                https://weavenyc.org/verify?challenge_id=…&token=…;
 *                the iOS associated domain (`applinks:weavenyc.org`, see
 *                app.json) routes that URL back into the app where
 *                `Linking.addEventListener('url', …)` auto-consumes the
 *                token and verifies the session.
 *
 * testID contract (load-bearing for future Maestro / E2E):
 *   - `verify-screen`  on the outer scroll container
 *   - `verify-tab-otp` / `verify-tab-magic` on the two tab pills
 *   - `verify-phone-field` / `verify-email-field` on the start-form inputs
 *   - `verify-send-code` / `verify-send-link` on the primary send CTAs
 *   - `verify-code-field` / `verify-token-field` on the code-entry inputs
 *   - `verify-code-submit` / `verify-token-submit` on the verify CTAs
 *
 * All copy derives from `useTranslation('verify')` + `useTranslation('errors')` —
 * no English string literals.
 */

import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Banner,
  Button,
  Card,
  Field,
  Inline,
  PageHeader,
  Pill,
  Stack,
  Toast,
} from '@/components/ui';
import { createAnonymousSession } from '@/lib/api';
import { resolveErrorKey } from '@/lib/error-i18n';
import {
  useAppDispatch,
  useAppSelector,
  useMagicLinkStart,
  useMagicLinkVerify,
  useOtpStart,
  useOtpVerify,
} from '@/lib/hooks';
import {
  getPushPermissionStatus,
  registerForPushNotifications,
} from '@/lib/push-notifications';
import { selectPreferences, selectSession } from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';
import { useSessionBootstrap } from '@/lib/use-session-bootstrap';
import type { AuthSession } from '@/lib/types';
import { useAppTheme } from '@/theme';

export type VerifyScreenProps = {
  /**
   * When provided, renders a back chevron via PageHeader that lands the
   * user on the previous Me-hub screen. Omit for the root `/verify` entry.
   */
  onBack?: () => void;
  /**
   * Localized label for the back button (passed through to PageHeader).
   * Defaults to `verifyBackToMe` from the verify namespace.
   */
  backLabel?: string;
  /**
   * Fires on a successful verify mutation. Parent routes use this to
   * navigate (e.g. `router.replace('/')`). Kept injected (rather than
   * calling `router.replace` inside this file) so the component stays
   * testable against a plain jest.fn.
   */
  onVerified?: (session: AuthSession) => void;
};

type Mode = 'otp' | 'magic';

/**
 * Parse a `weavenyc://verify?...` or `https://weavenyc.org/verify?...` URL
 * and extract the magic-link challenge + token. The universal link hands
 * us the full query string via `Linking.addEventListener('url', …)`; we
 * split the querystring manually so we don't have to pull in `qs` or a
 * similar micro-dep.
 */
function extractMagicLinkFromUrl(
  url: string | null,
): { challengeId: string; token: string } | null {
  if (!url) return null;
  // Use URL if available, fall back to manual split for RN versions that
  // don't expose the WHATWG URL constructor.
  let search: string;
  const idx = url.indexOf('?');
  if (idx < 0) return null;
  search = url.slice(idx + 1);
  // Strip a trailing `#hash` if present so splitting the query pairs
  // doesn't eat the last value.
  const hashIdx = search.indexOf('#');
  if (hashIdx >= 0) search = search.slice(0, hashIdx);

  const pairs = search.split('&');
  let challengeId: string | null = null;
  let token: string | null = null;
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.split('=');
    if (!rawKey) continue;
    const key = decodeURIComponent(rawKey);
    const value = decodeURIComponent(rest.join('='));
    if (key === 'challenge_id' || key === 'challengeId') challengeId = value;
    if (key === 'token') token = value;
  }
  if (!challengeId || !token) return null;
  return { challengeId, token };
}

/**
 * Main verify component. Consumed by `app/verify.tsx` and
 * `app/me/verify.tsx` — both routes pass through the same state machine
 * and differ only in whether the PageHeader shows a back chevron.
 */
export function VerifyScreen({ onBack, backLabel, onVerified }: VerifyScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('verify');
  const { t: tErrors } = useTranslation('errors');
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);
  const preferences = useAppSelector(selectPreferences);

  const [mode, setMode] = useState<Mode>('otp');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [magicToken, setMagicToken] = useState('');
  const [autoConsumed, setAutoConsumed] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<Error | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [pendingMagicLink, setPendingMagicLink] = useState<
    { challengeId: string; token: string } | null
  >(null);

  // Push-primer state (P3-A). `showPushPrimer` flips to true after a
  // verify success when the permission is still `undetermined` — the
  // psychologically right moment to ask. `pushPrimerPending` tracks the
  // in-flight register call so the button disables while APNs is doing
  // its thing. Captured here (rather than in a sibling hook) so the
  // banner can live inside the existing card stack.
  const [showPushPrimer, setShowPushPrimer] = useState(false);
  const [pushPrimerPending, setPushPrimerPending] = useState(false);
  const [pushPrimerError, setPushPrimerError] = useState<string | null>(null);

  // Keep the session fresh. See lib/use-session-bootstrap.ts — no-op when
  // the access_token is already populated; refresh → anon mint fallback
  // otherwise.
  useSessionBootstrap();

  const otpStart = useOtpStart(session?.access_token);
  const otpVerify = useOtpVerify(session?.access_token);
  const magicLinkStart = useMagicLinkStart(session?.access_token);
  const magicLinkVerify = useMagicLinkVerify(session?.access_token);

  const alreadyVerified =
    session?.user.level === 'verified' || session?.user.level === 'anchor';

  const finishVerification = useCallback(
    (nextSession: AuthSession) => {
      // Mirror the PWA's cancel-in-flight-mutations dance so any pending
      // OTP/magic-link mutation holding the previous token is dropped
      // before the reducer swap.
      otpStart.reset();
      otpVerify.reset();
      magicLinkStart.reset();
      magicLinkVerify.reset();
      dispatch(setSession(nextSession));
      setSuccessToast(t('verifySuccessTitle'));

      // P3-A — post-verify is the psychologically right moment to ask
      // for APNs permission. We probe the current status first (silent;
      // no prompt) so we only surface the primer when it's actually
      // `undetermined` — users who already granted / denied don't see
      // the banner again. The hard prompt only fires on the "Turn on"
      // button inside the primer.
      void (async () => {
        const status = await getPushPermissionStatus();
        if (status === 'undetermined') {
          setShowPushPrimer(true);
        }
      })();

      onVerified?.(nextSession);
    },
    [
      dispatch,
      magicLinkStart,
      magicLinkVerify,
      onVerified,
      otpStart,
      otpVerify,
      t,
    ],
  );

  // Handler for the "Turn on notifications" CTA inside the primer. Runs
  // the atomic register pipeline (permission → Expo token → backend
  // POST → persist). Any failure renders as an inline error — the rest
  // of the verified session stays usable.
  const handleEnablePush = useCallback(async () => {
    if (!session?.access_token) return;
    setPushPrimerPending(true);
    setPushPrimerError(null);
    try {
      await registerForPushNotifications(session.access_token, {
        deviceId: session.user.user_id,
        locale: preferences.language,
      });
      setShowPushPrimer(false);
    } catch (error) {
      setPushPrimerError(
        error instanceof Error ? error.message : 'Could not register push',
      );
    } finally {
      setPushPrimerPending(false);
    }
  }, [preferences.language, session?.access_token, session?.user.user_id]);

  /**
   * Universal-link intake. When the app is launched (or foregrounded)
   * from a tap on `https://weavenyc.org/verify?challenge_id=…&token=…`,
   * expo-linking fires `addEventListener('url', {url})` and
   * `getInitialURL()` returns the launch URL. Both paths flip the tab to
   * `magic`, prefill the token, and queue the verify mutation for after
   * the session is available.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const initial = await Linking.getInitialURL();
      if (cancelled) return;
      const parsed = extractMagicLinkFromUrl(initial);
      if (parsed) {
        setMode('magic');
        setMagicToken(parsed.token);
        setPendingMagicLink(parsed);
      }
    })();

    const sub = Linking.addEventListener('url', (event) => {
      const parsed = extractMagicLinkFromUrl(event.url);
      if (!parsed) return;
      setMode('magic');
      setMagicToken(parsed.token);
      setPendingMagicLink(parsed);
    });

    return () => {
      cancelled = true;
      // expo-linking returns a subscription with `remove()`; older Expo
      // versions returned void from `addEventListener` so guard for
      // undefined.
      sub?.remove?.();
    };
  }, []);

  /**
   * Bootstrap an anonymous session when a magic-link URL arrived before
   * the app had any session. Mirrors the PWA's `hasMagicLinkQuery`
   * branch so the auto-consume can fire as soon as an access_token
   * exists.
   */
  useEffect(() => {
    if (!pendingMagicLink) return;
    if (session?.access_token || isBootstrapping || alreadyVerified) return;

    let cancelled = false;
    setIsBootstrapping(true);
    setBootstrapError(null);
    void (async () => {
      try {
        const anonymousSession = await createAnonymousSession();
        if (cancelled) return;
        dispatch(setSession(anonymousSession));
      } catch (error) {
        if (cancelled) return;
        setBootstrapError(
          error instanceof Error ? error : new Error('Session bootstrap failed'),
        );
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    alreadyVerified,
    dispatch,
    isBootstrapping,
    pendingMagicLink,
    session?.access_token,
  ]);

  /**
   * Auto-consume a queued magic link as soon as a session exists.
   * Re-runs whenever either `pendingMagicLink` or the session's
   * access_token changes so the order of (link arrival / session boot)
   * doesn't matter.
   */
  useEffect(() => {
    if (!pendingMagicLink) return;
    if (!session?.access_token) return;
    if (autoConsumed || magicLinkVerify.isPending || alreadyVerified) return;

    setAutoConsumed(true);
    magicLinkVerify.mutate(
      {
        challengeId: pendingMagicLink.challengeId,
        token: pendingMagicLink.token,
      },
      {
        onSuccess: (nextSession) => finishVerification(nextSession),
      },
    );
  }, [
    alreadyVerified,
    autoConsumed,
    finishVerification,
    magicLinkVerify,
    pendingMagicLink,
    session?.access_token,
  ]);

  // Aggregated error list — rate limits, network failures, bootstrap
  // errors all render as danger banners below the main form.
  const errors = [
    otpStart.error,
    otpVerify.error,
    magicLinkStart.error,
    magicLinkVerify.error,
    bootstrapError,
  ].filter((err): err is Error => err instanceof Error);

  const otpChallengeActive = Boolean(otpStart.data);
  const magicLinkChallengeActive = Boolean(magicLinkStart.data);
  const needsSessionBanner = !session && !pendingMagicLink;

  // Narrow the theme lookups to the specific keys we use so
  // `noUncheckedIndexedAccess` doesn't widen every read to `T | undefined`.
  // See Banner.tsx for the same pattern — Restyle's BaseTheme widens all
  // palette entries to optional even though the runtime values are
  // exhaustively populated at module load.
  const colors = theme.colors as unknown as { bg: string };
  const spacing = theme.spacing as unknown as {
    l: number;
    xxl: number;
  };

  return (
    <View
      testID="verify-screen"
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: insets.top },
      ]}
    >
      <PageHeader
        title={t('verifyTitle')}
        onBack={onBack}
        backAccessibilityLabel={backLabel ?? t('verifyBackToMe')}
      />

      <ScrollView
        contentContainerStyle={{
          padding: spacing.l,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.l,
        }}
      >
        <Card>
          <Stack gap="m">
            <Banner tone="info" title={t('verifyCopy')} />
            <Stack gap="s">
              <Banner
                tone="info"
                title={t('verifyBenefitsTitle')}
              />
              <Banner tone="info" title={t('verifyBenefit1')} />
              <Banner tone="info" title={t('verifyBenefit2')} />
              <Banner tone="info" title={t('verifyBenefit3')} />
            </Stack>
          </Stack>
        </Card>

        {needsSessionBanner ? (
          <Banner tone="warning" title={t('verifyNeedsSession')} />
        ) : null}

        {alreadyVerified ? (
          <Card>
            <Stack gap="m">
              <Banner
                tone="success"
                title={t('verifySuccessTitle')}
              />
              <Banner tone="info" title={t('verifySuccessSubtitle')} />
              {showPushPrimer ? (
                <Stack gap="s">
                  <Banner
                    tone="info"
                    title={t('pushPrimerTitle')}
                  >
                    {t('pushPrimerBody')}
                  </Banner>
                  {pushPrimerError ? (
                    <Banner tone="danger" title={t('verifyError')}>
                      {pushPrimerError}
                    </Banner>
                  ) : null}
                  <Inline gap="s" wrap>
                    <Button
                      testID="verify-push-primer-enable"
                      variant="primary"
                      size="md"
                      loading={pushPrimerPending}
                      disabled={pushPrimerPending}
                      onPress={() => {
                        void handleEnablePush();
                      }}
                    >
                      {t('pushPrimerEnable')}
                    </Button>
                    <Button
                      testID="verify-push-primer-skip"
                      variant="secondary"
                      size="md"
                      disabled={pushPrimerPending}
                      onPress={() => setShowPushPrimer(false)}
                    >
                      {t('pushPrimerSkip')}
                    </Button>
                  </Inline>
                </Stack>
              ) : null}
            </Stack>
          </Card>
        ) : (
          <>
            {/* Method card — tab pills + phone/email + send CTA */}
            <Card>
              <Stack gap="m">
                <Inline gap="s" wrap>
                  <Pill
                    testID="verify-tab-otp"
                    selected={mode === 'otp'}
                    onPress={() => setMode('otp')}
                  >
                    {t('otpTab')}
                  </Pill>
                  <Pill
                    testID="verify-tab-magic"
                    selected={mode === 'magic'}
                    onPress={() => setMode('magic')}
                  >
                    {t('magicLinkTab')}
                  </Pill>
                </Inline>

                {mode === 'otp' ? (
                  <Stack gap="s">
                    <Field
                      testID="verify-phone-field"
                      label={t('phoneLabel')}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      placeholder="+15165550101"
                    />
                    <Button
                      testID="verify-send-code"
                      variant="primary"
                      size="md"
                      disabled={!session?.access_token || otpStart.isPending}
                      loading={otpStart.isPending}
                      onPress={() => otpStart.mutate({ phone })}
                    >
                      {otpChallengeActive
                        ? t('verifyResendCode')
                        : t('sendCode')}
                    </Button>
                  </Stack>
                ) : (
                  <Stack gap="s">
                    <Field
                      testID="verify-email-field"
                      label={t('emailLabel')}
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="neighbor@example.com"
                    />
                    <Button
                      testID="verify-send-link"
                      variant="primary"
                      size="md"
                      disabled={
                        !session?.access_token || magicLinkStart.isPending
                      }
                      loading={magicLinkStart.isPending}
                      onPress={() => magicLinkStart.mutate({ email })}
                    >
                      {magicLinkChallengeActive
                        ? t('verifyResendCode')
                        : t('sendLink')}
                    </Button>
                    {magicLinkChallengeActive ? (
                      // TODO(verify): add `verifyEmailLinkSent` copy
                      // ("Check your email. Tap the link from your
                      // inbox.") to verify.json when design ships the
                      // finalised string; the existing `verifyCodeSentBody`
                      // is the closest matching PWA key.
                      <Banner
                        tone="info"
                        title={t('verifyCodeSentTitle')}
                      />
                    ) : null}
                  </Stack>
                )}
              </Stack>
            </Card>

            {/* Code card — 6-digit OTP input or magic-link token input */}
            <Card>
              {mode === 'otp' ? (
                <Stack gap="s">
                  <Field
                    testID="verify-code-field"
                    label={t('codeLabel')}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                  />
                  <Button
                    testID="verify-code-submit"
                    variant="primary"
                    size="md"
                    disabled={
                      !session?.access_token ||
                      otpVerify.isPending ||
                      !otpStart.data
                    }
                    loading={otpVerify.isPending}
                    onPress={() =>
                      otpVerify.mutate(
                        {
                          challengeId: otpStart.data!.challenge_id,
                          code: otpCode,
                        },
                        {
                          onSuccess: (nextSession) =>
                            finishVerification(nextSession),
                        },
                      )
                    }
                  >
                    {t('verifyCode')}
                  </Button>
                </Stack>
              ) : (
                <Stack gap="s">
                  <Field
                    testID="verify-token-field"
                    label={t('tokenLabel')}
                    value={magicToken}
                    onChangeText={setMagicToken}
                    autoCapitalize="none"
                  />
                  <Button
                    testID="verify-token-submit"
                    variant="primary"
                    size="md"
                    disabled={
                      magicLinkVerify.isPending ||
                      (!magicLinkStart.data && !pendingMagicLink)
                    }
                    loading={magicLinkVerify.isPending}
                    onPress={() =>
                      magicLinkVerify.mutate(
                        {
                          challengeId:
                            magicLinkStart.data?.challenge_id ??
                            pendingMagicLink?.challengeId ??
                            '',
                          token: magicToken,
                        },
                        {
                          onSuccess: (nextSession) =>
                            finishVerification(nextSession),
                        },
                      )
                    }
                  >
                    {t('useDemoLink')}
                  </Button>
                </Stack>
              )}
            </Card>
          </>
        )}

        {errors.length > 0 ? (
          <Stack gap="xs">
            {errors.map((error, index) => (
              <Banner
                key={index}
                tone="danger"
                title={t('verifyError')}
              >
                {tErrors(resolveErrorKey(error))}
              </Banner>
            ))}
          </Stack>
        ) : null}

        {successToast ? (
          <Toast
            tone="success"
            message={successToast}
            testID="verify-success-toast"
          />
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
