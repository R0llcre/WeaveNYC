/**
 * M8.5 W5A — smoke test for the redesigned onboarding language picker.
 *
 * The full onboarding flow (+ return_to / open-redirect defence) is covered by
 * `onboarding.test.tsx`. This file focuses on the W5A redesign contract:
 *   1. The three E2E-critical test ids (`onboarding-language-en|es|zh`) are
 *      present on each card button so `tests/e2e/*.spec.ts` don't break.
 *   2. Each button displays the label in its OWN target language (`English` /
 *      `Español` / `中文`), not a translated form.
 *   3. Selecting a language dispatches `setLanguage` and navigates to the
 *      default destination `/onboarding/location` via `router.replace`.
 *   4. The redesigned screen does NOT wrap its content in the AppShell
 *      (`main.shell`), i.e. the takeover contract holds.
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
  initialPreferencesState,
  preferencesReducer,
} from '@/lib/slices/preferences-slice';
import { LanguagePickerScreen } from './language-picker-screen';

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => '/onboarding/language',
  useSearchParams: () =>
    new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    ),
}));

function buildStore(preloadedState?: Parameters<typeof configureStore>[0]['preloadedState']) {
  return configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
    preloadedState,
  });
}

function renderScreen(
  preloadedState?: Parameters<typeof configureStore>[0]['preloadedState'],
) {
  const store = buildStore(preloadedState);
  const utils = render(
    <Provider store={store}>
      <NextIntlClientProvider
        locale="en"
        messages={messages.en}
        timeZone="America/New_York"
      >
        <LanguagePickerScreen />
      </NextIntlClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

afterEach(() => {
  cleanup();
  replaceMock.mockReset();
  pushMock.mockReset();
});

describe('LanguagePickerScreen · W5A redesign smoke', () => {
  it('renders each language label in its own native script on the card', () => {
    renderScreen();

    const en = screen.getByTestId('onboarding-language-en');
    const es = screen.getByTestId('onboarding-language-es');
    const zh = screen.getByTestId('onboarding-language-zh');

    // Native-script labels must NOT be translated — an English-speaking user
    // sees "Español" / "中文" so they can recognise the script they'll see if
    // they tap.
    expect(en).toHaveTextContent('English');
    expect(es).toHaveTextContent('Español');
    expect(zh).toHaveTextContent('中文');
  });

  it('uses a takeover layout (no AppShell `main.shell`)', () => {
    const { container } = renderScreen();
    // The onboarding main should own the takeover class, NOT `shell`.
    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(main?.className).toContain('onboarding');
    expect(main?.className).not.toContain('shell');
  });

  it('dispatches setLanguage and replaces to /onboarding/location on select', () => {
    const { store } = renderScreen();

    fireEvent.click(screen.getByTestId('onboarding-language-es'));

    expect(store.getState().preferences.language).toBe('es');
    expect(store.getState().preferences.hasUserChosenLanguage).toBe(true);
    expect(replaceMock).toHaveBeenCalledWith('/onboarding/location');
  });

  it('marks the preselected language as active via aria-pressed', () => {
    // W5 R1/m3: users returning to the picker after a language flip should
    // see the current choice highlighted. Two hooks carry the state: the
    // aria-pressed toggle (for AT + `jest-dom` assertions) and the
    // `lang-card--active` class on the wrapping Card (for visual styling).
    renderScreen({
      preferences: {
        ...initialPreferencesState,
        language: 'zh',
        hasUserChosenLanguage: true,
      },
    });

    const en = screen.getByTestId('onboarding-language-en');
    const es = screen.getByTestId('onboarding-language-es');
    const zh = screen.getByTestId('onboarding-language-zh');

    expect(zh.getAttribute('aria-pressed')).toBe('true');
    expect(en.getAttribute('aria-pressed')).toBe('false');
    expect(es.getAttribute('aria-pressed')).toBe('false');
  });
});
