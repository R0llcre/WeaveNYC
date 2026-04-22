/**
 * V2-D — vitest coverage for the crisis-first HomeWizard.
 *
 * Focus:
 *   - The 4 intent cards render with their expected testids + copy.
 *   - Tapping a card dispatches `setLastIntent` and persists the intent to
 *     the preferences slice. (We do NOT navigate via the router; the
 *     page.tsx gate swaps the wizard for the directory on the next paint,
 *     which is exercised by the E2E spec.)
 *   - Preserves the `create-session` + `session-chip` testids that the
 *     pre-V2-D smoke flow depends on, so parallel E2E specs keep passing.
 *
 * The filter pre-application side of the story (intent → initial filter
 * state inside ResourceHome) is covered by `resource-home.test.tsx` and
 * the E2E spec — this file stays scoped to the wizard itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  hydratePreferences,
  preferencesReducer,
} from '@/lib/slices/preferences-slice';
import type { HomeIntent } from '@/lib/types';
import { HomeWizard } from './home-wizard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(''),
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

const createAnonymousMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createAnonymousSession: (...args: unknown[]) =>
      createAnonymousMock(...args),
  };
});

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

function renderWizard(options: { zip?: string } = {}) {
  const { zip = '11735' } = options;
  const store = buildStore();
  store.dispatch(
    hydratePreferences({
      language: 'en',
      zipCode: zip,
      onboardingComplete: zip !== '',
      lowBandwidth: false,
      bookmarks: [],
      defaultPostVisibility: 'community_only',
      locationPrecision: 'zip_only',
      hasUserChosenLanguage: true,
      // lastIntent intentionally left undefined → null via the reducer
      // default → this is the wizard's happy-path entry state.
    }),
  );
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <HomeWizard />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  // The wizard calls `useSessionBootstrap` which in turn attempts to mint
  // an anonymous session. Stub the API call as a pending Promise so the
  // hook doesn't thrash state during the test.
  createAnonymousMock.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  createAnonymousMock.mockReset();
});

describe('HomeWizard (V2-D crisis-first picker)', () => {
  it('renders the wizard title and all 4 intent cards with their testids', () => {
    renderWizard();

    // Wizard landmark + headline.
    expect(screen.getByTestId('home-wizard')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: messages.en.wizardTitle,
      }),
    ).toBeInTheDocument();

    // Each of the 4 NeedCards exposes its stable testid AND renders the
    // user-facing title + subtitle copy.
    const expectedCards: Array<{
      testId: string;
      title: string;
      subtitle: string;
    }> = [
      {
        testId: 'need-food-now',
        title: messages.en.needFoodNow,
        subtitle: messages.en.needFoodNowSubtitle,
      },
      {
        testId: 'need-food-week',
        title: messages.en.needFoodWeek,
        subtitle: messages.en.needFoodWeekSubtitle,
      },
      {
        testId: 'need-doctor',
        title: messages.en.needDoctor,
        subtitle: messages.en.needDoctorSubtitle,
      },
      {
        testId: 'need-sleep',
        title: messages.en.needSleep,
        subtitle: messages.en.needSleepSubtitle,
      },
    ];

    for (const { testId, title, subtitle } of expectedCards) {
      const card = screen.getByTestId(testId);
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent(title);
      expect(card).toHaveTextContent(subtitle);
    }
  });

  it('dispatches setLastIntent on each card tap with the matching intent', () => {
    const cases: Array<{ testId: string; expected: HomeIntent }> = [
      { testId: 'need-food-now', expected: 'food_now' },
      { testId: 'need-food-week', expected: 'food_week' },
      { testId: 'need-doctor', expected: 'doctor' },
      { testId: 'need-sleep', expected: 'sleep' },
    ];

    for (const { testId, expected } of cases) {
      const { store, unmount } = renderWizard();
      // Sanity: the wizard only mounts when lastIntent is null, so no
      // stale intent should leak into this assertion.
      expect(store.getState().preferences.lastIntent).toBeNull();

      fireEvent.click(screen.getByTestId(testId));

      expect(store.getState().preferences.lastIntent).toBe(expected);
      unmount();
    }
  });

  it('preserves the sr-only create-session shim for the legacy smoke flow', () => {
    // Parallel E2E specs (resource-smoke, community-posts) click
    // `create-session` on Home; we keep the shim so those specs don't
    // need to be rewritten when a fresh-install user lands on the wizard
    // first.
    renderWizard();

    const shim = screen.getByTestId('create-session');
    expect(shim).toBeInTheDocument();
    expect(shim.className).toContain('sr-only');
  });
});
