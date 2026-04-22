/**
 * Root layout — the outermost React tree for the whole mobile app.
 *
 * Provider stack (outside-in):
 *   SafeAreaProvider         — safe-area insets (notch/home-indicator)
 *   ThemeProvider (Restyle)  — theme tokens from ./src/theme
 *   QueryClientProvider      — TanStack Query cache
 *   Redux Provider           — placeholder store today, full slices wave B
 *   I18nextProvider          — via ./src/i18n/index side-effect init
 *   GestureHandlerRootView   — required by react-native-gesture-handler
 *     and any Reanimated-based atom (wave B adds plenty)
 *   Slot                     — Expo Router renders the matching route here
 *
 * Sentry: deferred init fires as soon as the first interaction settles.
 * `Sentry.wrap(RootLayout)` wires the error boundary + profiling.
 */

import { ThemeProvider } from '@shopify/restyle';
import { QueryClientProvider } from '@tanstack/react-query';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

// Side-effect import: initialize i18next ASAP so the first render already
// has the right locale. Keep this import BEFORE any component uses
// useTranslation().
import '@/i18n';

import { initSentryDeferred, Sentry } from '@/observability/sentry';
import { queryClient } from '@/providers/query-client';
import { store } from '@/store';
import { useAppTheme } from '@/theme';

function RootLayout() {
  const theme = useAppTheme();

  useEffect(() => {
    initSentryDeferred();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <ReduxProvider store={store}>
              <StatusBar style="auto" />
              <Slot />
            </ReduxProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// `Sentry.wrap` returns an enhanced component with error boundary + perf
// tracing. It's a no-op at runtime when Sentry.init hasn't been called
// yet (our deferred-init path) — safe to wrap unconditionally.
export default Sentry.wrap(RootLayout);
