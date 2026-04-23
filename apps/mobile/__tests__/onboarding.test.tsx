/**
 * Onboarding flow — smoke tests for S6.
 *
 * Three cases (one per step) assert the user-visible state transition:
 *
 *   1. Language tap advances to `/onboarding/trust` and persists the
 *      chosen code to the preferences slice.
 *   2. Trust CTA advances to `/onboarding/location`.
 *   3. Location submit persists the ZIP, flips `onboardingComplete`,
 *      and routes to Home (`/`).
 *
 * The mobile jest harness runs in a Node environment with a lightweight
 * `react-native` + `expo-router` stub (see `__tests__/__mocks__`). We
 * render via `react-test-renderer` and invoke the `onPress` handler on
 * the host node carrying the stable `testID` — the same pattern the
 * atom suites use. `fireEvent.press` from RNTL isn't wired in this
 * wave so direct handler invocation is the idiomatic path.
 */

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import TestRenderer from 'react-test-renderer';
import { configureStore } from '@reduxjs/toolkit';
import { Provider as ReduxProvider } from 'react-redux';

import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import { AppThemeProvider } from '@/theme';

// Screen modules under test. Imported lazily below inside each `it`
// block so the jest.mock for expo-router is applied before the screen
// resolves the router spy at module evaluation.
import OnboardingLanguageScreen from '../app/onboarding/language';
import OnboardingTrustScreen from '../app/onboarding/trust';
import OnboardingLocationScreen from '../app/onboarding/location';

// Pull the mocked `router` object from the same module the screens
// import from. `jest.requireMock('expo-router').router` returns a
// different object than `import { router } from 'expo-router'` because
// the jest module resolver caches the `.default` vs named exports
// separately; matching the import pattern keeps the two spy
// references in lockstep.
import { router as routerSpy } from 'expo-router';

// i18n stub — the onboarding screens call `useTranslation('onboarding')`
// and `loadNamespace('onboarding')`. Rather than boot the real
// i18next instance (requires eager loading of three JSON bundles in
// the test Node env), we stub the hook to return the key as-is so the
// tests stay focussed on navigation + state.
jest.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

jest.mock('@/i18n', () => ({
  loadNamespace: jest.fn(() => Promise.resolve()),
  setLocale: jest.fn((locale: string) => Promise.resolve(locale)),
}));

function buildStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
  });
}

function renderScreen(ui: React.ReactElement, store = buildStore()) {
  const tree = TestRenderer.create(
    <ReduxProvider store={store}>
      <AppThemeProvider override="light">{ui}</AppThemeProvider>
    </ReduxProvider>,
  );
  return { tree, store };
}

// Minimal ReactTestInstance shape — avoids the `TestRenderer.ReactTestInstance`
// type import (the `react-test-renderer` package ships no types under
// the current monorepo pnpm layout; atom tests already work around this
// by treating the renderer as untyped).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TestInstance = any;

function findPressableByTestID(
  root: TestInstance,
  testID: string,
): TestInstance {
  const matches = root.findAllByProps({ testID });
  const host = matches.find(
    (m: TestInstance) =>
      typeof m.type === 'string' &&
      typeof (m.props as { onPress?: unknown }).onPress === 'function',
  );
  if (!host) {
    throw new Error(
      `No pressable host node found for testID "${testID}" (candidates: ${matches.length})`,
    );
  }
  return host;
}

// Cast to a minimal jest.Mock shape — the expo-router stub exports
// `jest.fn()` for each method. TS can't infer that through the real
// `Router` typings, so we narrow at the test boundary.
const push = routerSpy.push as unknown as jest.Mock;
const replace = routerSpy.replace as unknown as jest.Mock;
const back = routerSpy.back as unknown as jest.Mock;
const canGoBack = routerSpy.canGoBack as unknown as jest.Mock;

afterEach(() => {
  push.mockClear();
  replace.mockClear();
  back.mockClear();
  canGoBack.mockClear();
});

describe('OnboardingLanguageScreen', () => {
  it('advances to /onboarding/trust on language tap and persists the code', async () => {
    const { tree, store } = renderScreen(<OnboardingLanguageScreen />);

    const esRow = findPressableByTestID(tree.root, 'onboarding-language-es');

    // `handleSelect` is async (awaits the `setLocale` i18n swap). Wrap
    // the press in `act` so React + Redux flush the first synchronous
    // dispatch, then drain the microtask queue to let the awaited
    // promise settle so `router.push` fires before we assert.
    await TestRenderer.act(async () => {
      (esRow.props as { onPress: () => void }).onPress();
      // Two microtask ticks — the handler awaits `setLocale()` then
      // immediately calls `router.push`.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.getState().preferences.language).toBe('es');
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(true);
    expect(push).toHaveBeenCalledWith('/onboarding/trust');
  });
});

describe('OnboardingTrustScreen', () => {
  it('advances to /onboarding/location on the primary CTA', () => {
    const { tree } = renderScreen(<OnboardingTrustScreen />);

    const cta = findPressableByTestID(
      tree.root,
      'onboarding-trust-continue',
    );
    TestRenderer.act(() => {
      (cta.props as { onPress: () => void }).onPress();
    });

    expect(push).toHaveBeenCalledWith('/onboarding/location');
  });
});

describe('OnboardingLocationScreen', () => {
  it('submitting a valid ZIP completes onboarding and routes to home', () => {
    const { tree, store } = renderScreen(<OnboardingLocationScreen />);

    // Find the TextInput (Field renders a sibling <TextInput> to the
    // label) and set its value via `onChangeText`.
    const input = tree.root.findByType('TextInput' as never);
    TestRenderer.act(() => {
      (input.props as { onChangeText: (s: string) => void }).onChangeText(
        '11385',
      );
    });

    const submit = findPressableByTestID(
      tree.root,
      'onboarding-location-submit',
    );
    TestRenderer.act(() => {
      (submit.props as { onPress: () => void }).onPress();
    });

    expect(store.getState().preferences.zipCode).toBe('11385');
    expect(store.getState().preferences.onboardingComplete).toBe(true);
    expect(replace).toHaveBeenCalledWith('/');
  });
});
