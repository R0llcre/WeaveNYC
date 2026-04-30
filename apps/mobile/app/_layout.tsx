/**
 * Root layout — the outermost React tree for the whole mobile app.
 *
 * Provider stack (outside-in):
 *   SafeAreaProvider         — safe-area insets (notch/home-indicator)
 *   AppThemeProvider         — Restyle theme tokens from ./src/theme
 *   QueryClientProvider      — TanStack Query cache
 *   Redux Provider           — placeholder store today, full slices wave B
 *   I18nextProvider          — via ./src/i18n/index side-effect init
 *   GestureHandlerRootView   — required by react-native-gesture-handler
 *     and any Reanimated-based atom (wave B adds plenty)
 *   OnboardingGuard          — first-run redirect (S6). See component
 *                              docblock below for the funnel contract.
 *   Slot                     — Expo Router renders the matching route here
 *
 * Sentry: deferred init fires as soon as the first interaction settles.
 * `Sentry.wrap(RootLayout)` wires the error boundary + profiling.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, Slot, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider, useDispatch, useSelector } from 'react-redux';

// Side-effect import: initialize i18next ASAP so the first render already
// has the right locale. Keep this import BEFORE any component uses
// useTranslation().
import i18n from '@/i18n';

import { loadPreferences } from '@/lib/persistence';
import {
  configureNotificationCategories,
  onNotificationResponse,
} from '@/lib/push-notifications';
import {
  applyDetectedLanguage,
  hydratePreferences,
  setLanguage,
} from '@/lib/slices/preferences-slice';
import { initSentryDeferred, Sentry } from '@/observability/sentry';
import { queryClient } from '@/providers/query-client';
import { store, type AppDispatch, type RootState } from '@/store';
import { AppThemeProvider } from '@/theme';

/**
 * OnboardingGuard — first-run redirect (S6).
 *
 * On every navigation (tracked via `useSegments`) we inspect the
 * preferences slice and nudge the user to the right step of the
 * onboarding funnel when they haven't completed it yet:
 *
 *   - `onboardingComplete === false` AND `hasUserChosenLanguage === false`
 *     → `/onboarding/language`
 *   - `onboardingComplete === false` AND `hasUserChosenLanguage === true`
 *     (browser locale was auto-detected, user hasn't seen the flow yet)
 *     → `/onboarding/trust` — skipping the picker matches the PWA's
 *     V1-B fast-forward behaviour.
 *
 * The guard never interrupts a user who is already inside the
 * onboarding stack (segments[0] === 'onboarding') — that would create
 * a redirect loop the moment the user lands on /onboarding/language.
 * It also only fires after the store has hydrated, otherwise the very
 * first frame could bounce a returning user who's already completed
 * onboarding to the picker while Redux reads back the persisted flag.
 *
 * The guard renders nothing; it sits above `<Slot />` so every tab /
 * nested stack sees the same redirect contract without copy-pasting
 * `useEffect(() => router.replace…)` into every screen.
 */
function OnboardingGuard() {
  const segments = useSegments();
  const dispatch = useDispatch<AppDispatch>();
  const preferences = useSelector((state: RootState) => state.preferences);

  // One-shot hydration — pull the persisted preferences row and dispatch
  // `hydratePreferences` so `hydrationComplete` flips to `true`. A
  // missing row (first install) or a corrupt row still flips the flag
  // via the reducer's `...initialPreferencesState` spread, which means
  // the guard never blocks indefinitely on a clean install.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const persisted = await loadPreferences();
      if (cancelled) return;
      dispatch(hydratePreferences(persisted ?? {}));

      // Reconcile the i18n active locale with the persisted Redux
      // preference. Three branches:
      //
      //   1. The user has already picked a language explicitly
      //      (`hasUserChosenLanguage=true`): trust their pick and force
      //      i18next over to that locale.
      //   2. There is no explicit pick yet: i18next has already chosen a
      //      device-detected locale during module init, so push that
      //      detected locale BACK into Redux so every component that
      //      reads `preferences.language` (and the funnel guard below)
      //      sees the same answer as `useTranslation()`.
      //   3. Anything else falls through to the english default.
      //
      // Without this reconciliation, the device-detected zh-Hans / es
      // locale renders correctly on screens that read i18next directly
      // but flips back to English on screens that branch on
      // `preferences.language` (and on the next remount once Redux
      // re-hydrates with its initialState default of `'en'`).
      const i18nLang = i18n.language;
      const reduxToI18n: Record<string, 'en' | 'es' | 'zh-Hans'> = {
        en: 'en',
        es: 'es',
        zh: 'zh-Hans',
      };
      const i18nToRedux: Record<string, 'en' | 'es' | 'zh'> = {
        en: 'en',
        es: 'es',
        'zh-Hans': 'zh',
      };
      if (persisted?.hasUserChosenLanguage && persisted.language) {
        const target = reduxToI18n[persisted.language] ?? 'en';
        if (i18nLang !== target) {
          void i18n.changeLanguage(target);
        }
        // setLanguage flips hasUserChosenLanguage=true; idempotent.
        dispatch(setLanguage(persisted.language));
      } else {
        const detected = i18nToRedux[i18nLang] ?? 'en';
        dispatch(applyDetectedLanguage(detected));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    // If hydrationComplete is still false the persisted flags haven't
    // been read yet — wait, otherwise we'd bounce returning users into
    // the funnel on every cold start before Redux settles.
    if (!preferences.hydrationComplete) {
      return;
    }

    const inOnboardingStack = segments[0] === 'onboarding';

    if (preferences.onboardingComplete) {
      // Already completed — nothing to do; the user owns their nav.
      return;
    }

    if (inOnboardingStack) {
      // Already in the funnel; let each step advance on its own.
      return;
    }

    // User hasn't completed onboarding and isn't inside the stack yet:
    // fast-forward to the right step. When a language has already been
    // auto-detected (hasUserChosenLanguage === true after an explicit
    // settings change, or after the PWA's applyDetectedLanguage path)
    // we skip to trust so a first-time visitor doesn't have to confirm
    // the picker.
    const firstStep = preferences.hasUserChosenLanguage
      ? '/onboarding/trust'
      : '/onboarding/language';
    router.replace(firstStep);
  }, [
    preferences.hydrationComplete,
    preferences.onboardingComplete,
    preferences.hasUserChosenLanguage,
    segments,
  ]);

  return null;
}

function RootLayout() {
  useEffect(() => {
    initSentryDeferred();
  }, []);

  // Configure iOS notification categories on mount (P3-A). Idempotent —
  // re-registering the same category identifier is a no-op; it just
  // overwrites the action list. Runs before any notification arrives so
  // the Reply / Mark read / Accept / Decline / View buttons are ready.
  // Silently no-ops on Expo Go / simulator where the native module is
  // not linked.
  useEffect(() => {
    void configureNotificationCategories();
  }, []);

  // Register the tap handler once at the root. When the user taps a
  // notification (foreground or from a cold launch), expo-notifications
  // fires `response.notification.request.content.data.route` back here
  // and we `router.push` into the right screen. Kept at the root so
  // deep routes stay reachable no matter what screen the app mounts to.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        onNotificationResponse(response, (route) => {
          router.push(route as Parameters<typeof router.push>[0]);
        });
      },
    );
    return () => sub.remove?.();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <QueryClientProvider client={queryClient}>
            <ReduxProvider store={store}>
              <StatusBar style="auto" />
              <OnboardingGuard />
              <Slot />
            </ReduxProvider>
          </QueryClientProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// `Sentry.wrap` returns an enhanced component with error boundary + perf
// tracing. It's a no-op at runtime when Sentry.init hasn't been called
// yet (our deferred-init path) — safe to wrap unconditionally.
export default Sentry.wrap(RootLayout);
