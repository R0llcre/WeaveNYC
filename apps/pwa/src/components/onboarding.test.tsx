/**
 * M8 W2C — vitest coverage for the two onboarding screens introduced in
 * W3D:
 *
 * - /onboarding/language: picks between EN / ES / ZH and dispatches setLanguage
 * - /onboarding/location: validates ZIP, dispatches setZipCode + completeOnboarding
 *
 * The main E2E path for these screens lives in `tests/e2e/settings.spec.ts`
 * and the standalone onboarding spec. This file exists so the two pages are
 * also covered by the faster `pnpm test` gate without needing Playwright.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  applyDetectedLanguage,
  hydratePreferences,
  preferencesReducer,
  setLanguage,
} from '@/lib/slices/preferences-slice';
import { LanguagePickerScreen } from './language-picker-screen';
import { LocationGateScreen } from './location-gate-screen';

// Mock next/navigation so router.push / useSearchParams don't need a full App
// Router context. We capture push so we can assert the post-submit destination.
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
  useSearchParams: () =>
    new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    ),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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

function renderWithProviders(ui: React.ReactElement) {
  const store = buildStore();
  const utils = render(
    <Provider store={store}>
      <NextIntlClientProvider
        locale="en"
        messages={messages.en}
        timeZone="America/New_York"
      >
        {ui}
      </NextIntlClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

describe('LanguagePickerScreen (/onboarding/language)', () => {
  it('renders a pill for each supported language with the expected test ids', () => {
    renderWithProviders(<LanguagePickerScreen />);

    expect(screen.getByTestId('onboarding-language-en')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-language-es')).toBeInTheDocument();
    expect(screen.getByTestId('onboarding-language-zh')).toBeInTheDocument();
  });

  it('persists the selected language in Redux and routes to /onboarding/location by default', () => {
    const { store } = renderWithProviders(<LanguagePickerScreen />);

    fireEvent.click(screen.getByTestId('onboarding-language-es'));

    expect(store.getState().preferences.language).toBe('es');
    expect(pushMock).toHaveBeenCalledWith('/onboarding/location');
  });
});

describe('LocationGateScreen (/onboarding/location)', () => {
  it('rejects a malformed ZIP with an inline error and does not navigate', () => {
    const { store } = renderWithProviders(<LocationGateScreen />);

    const zipInput = screen.getByTestId(
      'onboarding-location-zip-input',
    ) as HTMLInputElement;
    fireEvent.change(zipInput, { target: { value: '112' } });
    fireEvent.click(screen.getByTestId('onboarding-location-submit'));

    expect(store.getState().preferences.zipCode).toBe('');
    expect(store.getState().preferences.onboardingComplete).toBe(false);
    expect(pushMock).not.toHaveBeenCalled();
    // the invalid-ZIP i18n error is surfaced via role=alert per the Field
    // component contract; we just assert at least one alert is visible.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('persists the ZIP, flips onboardingComplete, and routes to return_to on submit', () => {
    const { store } = renderWithProviders(<LocationGateScreen />);

    fireEvent.change(screen.getByTestId('onboarding-location-zip-input'), {
      target: { value: '11385' },
    });
    fireEvent.click(screen.getByTestId('onboarding-location-submit'));

    expect(store.getState().preferences.zipCode).toBe('11385');
    expect(store.getState().preferences.onboardingComplete).toBe(true);
    // default return_to is '/' when no search param is present
    expect(pushMock).toHaveBeenCalledWith('/');
  });

  it('rejects an open-redirect return_to and falls back to /', () => {
    // Simulate an attacker-controlled `return_to` query param pointing off
    // the origin. The safeReturnTo helper must fall back to the safe default
    // so router.push stays on the same origin.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...originalLocation, search: '?return_to=https://attacker.com' },
    });

    const { store } = renderWithProviders(<LocationGateScreen />);
    fireEvent.change(screen.getByTestId('onboarding-location-zip-input'), {
      target: { value: '11385' },
    });
    fireEvent.click(screen.getByTestId('onboarding-location-submit'));

    expect(store.getState().preferences.zipCode).toBe('11385');
    expect(pushMock).toHaveBeenCalledWith('/');
    expect(pushMock).not.toHaveBeenCalledWith('https://attacker.com');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('surfaces the device-unavailable banner when navigator.geolocation is missing', () => {
    const originalGeo = (globalThis as { navigator?: Navigator }).navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {
        ...originalGeo,
        geolocation: undefined,
      },
    });

    renderWithProviders(<LocationGateScreen />);
    fireEvent.click(screen.getByTestId('onboarding-location-use-device'));

    // The screen renders a warning banner when device geolocation is
    // unavailable — `tone="warning"` surfaces as `role="alert"` per the
    // Banner atom's contract. Previously this used `tone="info"` /
    // `role="status"`, but the state is recoverable-but-non-neutral
    // (the user's device action did not succeed), so warning is the
    // correct signal. The exact text varies by i18n locale, so we just
    // assert something with role=alert was rendered.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: originalGeo,
    });
  });
});

describe('preferences-slice — hydration + language detection flags', () => {
  it('hydratePreferences flips hydrationComplete from false to true', () => {
    const store = buildStore();
    expect(store.getState().preferences.hydrationComplete).toBe(false);

    store.dispatch(hydratePreferences({ zipCode: '11385', onboardingComplete: true }));

    expect(store.getState().preferences.hydrationComplete).toBe(true);
    expect(store.getState().preferences.zipCode).toBe('11385');
    expect(store.getState().preferences.onboardingComplete).toBe(true);
  });

  it('setLanguage flips hasUserChosenLanguage, applyDetectedLanguage does not', () => {
    const store = buildStore();
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(false);

    store.dispatch(applyDetectedLanguage('zh'));
    expect(store.getState().preferences.language).toBe('zh');
    // A detected language still leaves the flag false, so a user who later
    // explicitly picks EN on /onboarding/language overrides the detection.
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(false);

    store.dispatch(setLanguage('en'));
    expect(store.getState().preferences.language).toBe('en');
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(true);
  });

  it('language-picker dispatch flips hasUserChosenLanguage', () => {
    const { store } = renderWithProviders(<LanguagePickerScreen />);
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(false);

    fireEvent.click(screen.getByTestId('onboarding-language-zh'));

    expect(store.getState().preferences.language).toBe('zh');
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(true);
  });
});
