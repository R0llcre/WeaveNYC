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
import {
  dismissTrustBanner,
} from '@/lib/slices/preferences-slice';
import { LanguagePickerScreen } from './language-picker-screen';
import { LocationGateScreen } from './location-gate-screen';
import { TrustOnboardingScreen } from './trust-onboarding-screen';

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

  it('persists the selected language in Redux and routes to /onboarding/trust by default (V1-B Task 5)', () => {
    const { store } = renderWithProviders(<LanguagePickerScreen />);

    fireEvent.click(screen.getByTestId('onboarding-language-es'));

    expect(store.getState().preferences.language).toBe('es');
    // V1-B Task 5 — the anchor-model trust step sits between language and
    // location in the funnel order. `pushMock` is the combined push/replace
    // spy defined at the top of this file.
    expect(pushMock).toHaveBeenCalledWith('/onboarding/trust/');
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

  it('does not render the "use my device location" affordance (V1-B Task 3 — Path B)', () => {
    // V1-B Task 3: the fake geolocation button lied on success (no
    // reverse-geocoder existed), so the whole affordance was removed
    // until the gateway exposes a real `POST /v1/geocode/reverse`
    // endpoint. The testid `onboarding-location-use-device` must no
    // longer be present.
    renderWithProviders(<LocationGateScreen />);
    expect(
      screen.queryByTestId('onboarding-location-use-device'),
    ).toBeNull();
  });

  it('replaces the skip dead-end with a sample-neighborhood CTA that seeds ZIP 11368 (V1-B Task 6)', () => {
    const { store } = renderWithProviders(<LocationGateScreen />);

    // The `onboarding-location-skip` testid is preserved for existing
    // E2E specs but the button now seeds 11368 and marks onboarding
    // complete with a usable ZIP rather than stranding the user.
    fireEvent.click(screen.getByTestId('onboarding-location-skip'));

    expect(store.getState().preferences.zipCode).toBe('11368');
    expect(store.getState().preferences.onboardingComplete).toBe(true);
  });
});

describe('TrustOnboardingScreen (V1-B Task 5)', () => {
  it('renders the three anchor-model bullets and the continue CTA', () => {
    renderWithProviders(<TrustOnboardingScreen />);
    expect(screen.getByTestId('trust-bullet-id')).toBeInTheDocument();
    expect(screen.getByTestId('trust-bullet-nearby')).toBeInTheDocument();
    expect(screen.getByTestId('trust-bullet-anchors')).toBeInTheDocument();
    expect(
      screen.getByTestId('onboarding-trust-continue'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('onboarding-trust-learn-more'),
    ).toHaveAttribute('href', '/privacy/');
  });

  it('advances to /onboarding/location on continue', () => {
    renderWithProviders(<TrustOnboardingScreen />);
    fireEvent.click(screen.getByTestId('onboarding-trust-continue'));
    // pushMock also captures router.replace — see the shared mock above.
    expect(pushMock).toHaveBeenCalledWith('/onboarding/location/');
  });
});

describe('preferences-slice — V1-B trustBannerDismissed', () => {
  it('dismissTrustBanner flips the persisted flag', () => {
    const store = buildStore();
    expect(store.getState().preferences.trustBannerDismissed).toBe(false);
    store.dispatch(dismissTrustBanner());
    expect(store.getState().preferences.trustBannerDismissed).toBe(true);
    // Idempotent — a second dispatch is a no-op.
    store.dispatch(dismissTrustBanner());
    expect(store.getState().preferences.trustBannerDismissed).toBe(true);
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
