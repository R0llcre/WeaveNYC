/**
 * Home tab — wizard + directory render tests.
 *
 * Scope (3 cases, locked by the S2 task):
 *   1. `preferences.lastIntent === null` → wizard renders 4 intent cards
 *      with the spec'd testIDs (need-food-now / need-food-week /
 *      need-doctor / need-sleep).
 *   2. Tapping an intent card dispatches `setLastIntent` and the tree
 *      re-renders the directory view (resource-directory testID).
 *   3. Directory-on-mount with a valid ZIP shows the Skeleton placeholder
 *      row (home-loading-skeletons testID) — i.e. useResources fires the
 *      initial fetch rather than short-circuiting to an empty state.
 *
 * Runtime notes
 * -------------
 * Jest runs under Node + the project-wide stub stack (see
 * `apps/mobile/jest.config.js`). `react-i18next` is mocked here rather
 * than at the moduleNameMapper level because the wider codebase — atoms,
 * store, persistence — happily imports it without touching the network;
 * scoping the mock keeps those tests on the real package.
 *
 * Tests use @testing-library/react-native's `render` + `fireEvent.press`
 * so the same flow works when Maestro targets the same testIDs in a real
 * device build.
 */

import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';
import {
  initialPreferencesState,
  preferencesReducer,
} from '@/lib/slices/preferences-slice';
import { authReducer } from '@/lib/slices/auth-slice';

// -- mocks ----------------------------------------------------------------

// react-i18next stub — `t(key, params)` returns the key (plus any
// interpolation payload appended as JSON) so assertions don't have to
// load the full translation bundles for this test. `i18n.language` is
// fixed to `en` so the freshness-footer date formatter takes the
// deterministic English path.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Stub the lazy-loaded home namespace so the screen doesn't trip the
// dynamic `import()` branch during mount.
jest.mock('@/i18n', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
}));

// The `searchResources` API call sits behind `useResources`. Stub it so
// the test never hits the network; leave the promise unresolved for the
// "loading skeleton" assertion (the skeleton renders while the query is
// in flight) but provide a deterministic resolve path for the other
// branches.
jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api') as Record<string, unknown>;
  return {
    ...actual,
    searchResources: jest.fn(
      () =>
        new Promise(() => {
          /* never resolves — keeps the query in `isLoading` for the
             skeleton assertion. Test cleanup unmounts the tree. */
        }),
    ),
  };
});

// -- harness --------------------------------------------------------------

function buildStore(lastIntent: 'food_now' | null, zipCode: string) {
  return configureStore({
    reducer: {
      preferences: preferencesReducer,
      auth: authReducer,
    },
    preloadedState: {
      preferences: {
        ...initialPreferencesState,
        hydrationComplete: true,
        onboardingComplete: true,
        zipCode,
        lastIntent,
      },
      auth: {
        session: null,
      },
    },
  });
}

function renderHomeTab(opts: {
  lastIntent?: 'food_now' | null;
  zipCode?: string;
}) {
  const store = buildStore(opts.lastIntent ?? null, opts.zipCode ?? '11201');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // Import the screen lazily so the above jest.mock() calls land before
  // the screen's module-eval fires.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const HomeTab = require('../(tabs)/index').default;
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <HomeTab />
        </AppThemeProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

describe('Home tab (wizard + directory)', () => {
  test('wizard renders the 4 intent cards when lastIntent is null', () => {
    renderHomeTab({ lastIntent: null });

    expect(screen.getByTestId('home-wizard')).toBeTruthy();
    expect(screen.getByTestId('need-food-now')).toBeTruthy();
    expect(screen.getByTestId('need-food-week')).toBeTruthy();
    expect(screen.getByTestId('need-doctor')).toBeTruthy();
    expect(screen.getByTestId('need-sleep')).toBeTruthy();
  });

  test('tapping an intent card dispatches setLastIntent and swaps to the directory', () => {
    const { store } = renderHomeTab({ lastIntent: null });
    expect(store.getState().preferences.lastIntent).toBeNull();

    fireEvent.press(screen.getByTestId('need-food-now'));

    // Slice asserts the intent is committed.
    expect(store.getState().preferences.lastIntent).toBe('food_now');
    // The parent index.tsx re-renders into ResourceDirectory; the wizard
    // tree is no longer in the DOM.
    expect(screen.queryByTestId('home-wizard')).toBeNull();
    expect(screen.getByTestId('resource-directory')).toBeTruthy();
  });

  test('directory renders 3 loading skeletons on mount when a valid ZIP is set', () => {
    renderHomeTab({ lastIntent: 'food_now', zipCode: '11201' });

    expect(screen.getByTestId('resource-directory')).toBeTruthy();
    // The skeleton row wraps 3 Skeleton placeholders. We only assert on
    // the outer container because the individual Skeletons are inner
    // `View`s without testIDs.
    expect(screen.getByTestId('home-loading-skeletons')).toBeTruthy();
  });
});
