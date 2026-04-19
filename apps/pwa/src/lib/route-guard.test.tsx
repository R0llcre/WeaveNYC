/**
 * Unit coverage for the W2D route guard hooks.
 *
 * These tests render a minimal harness component that calls each hook and
 * asserts the side effects (router.replace / returned destination) against a
 * stub store. `next/navigation` is fully mocked so the hooks don't need a
 * real App Router context. The Redux store is a fresh `configureStore` call
 * per test — never the production singleton — so state between cases can't
 * leak.
 *
 * Coverage matrix (useOnboardingGuard):
 *   1. hydrated + !complete + !language        → /onboarding/language
 *   2. hydrated + !complete + language chosen  → /onboarding/location
 *   3. hydrated + onboardingComplete           → no redirect
 *   4. !hydrated                               → no redirect (waits)
 *   5. pathname already under /onboarding      → no redirect (no loop)
 *   6. return_to in query is preserved + encoded
 *
 * Coverage matrix (useOnboardingDestination):
 *   7. missing return_to     → fallback
 *   8. safe return_to        → returned as-is
 *   9. unsafe `https://evil` → fallback (safeReturnTo delegation)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  hydratePreferences,
  preferencesReducer,
  setLanguage,
} from '@/lib/slices/preferences-slice';
import type { PreferencesState } from '@/lib/types';

// Mutable handles the mock below reads on every render so each test can
// configure the router / pathname / search independently.
const replaceMock = vi.fn();
const pushMock = vi.fn();
const backMock = vi.fn();
let currentPathname = '/';
let currentSearch = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock, back: backMock }),
  usePathname: () => currentPathname,
  useSearchParams: () => currentSearch,
}));

// The hooks under test must be imported AFTER vi.mock so the mock is in
// place when `next/navigation` is resolved.
import {
  useOnboardingDestination,
  useOnboardingGuard,
} from './route-guard';

function buildStore(preferences?: Partial<PreferencesState>) {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
  });
  if (preferences) {
    store.dispatch(hydratePreferences(preferences));
  }
  return store;
}

function OnboardingGuardHarness() {
  useOnboardingGuard();
  return null;
}

function DestinationHarness({
  onResolve,
  fallback,
}: {
  onResolve: (destination: string) => void;
  fallback?: string;
}) {
  const destination = useOnboardingDestination(fallback);
  onResolve(destination);
  return null;
}

function renderWithStore(ui: React.ReactElement, store: ReturnType<typeof buildStore>) {
  return render(<Provider store={store}>{ui}</Provider>);
}

beforeEach(() => {
  currentPathname = '/';
  currentSearch = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  replaceMock.mockReset();
  pushMock.mockReset();
  backMock.mockReset();
});

describe('useOnboardingGuard', () => {
  it('redirects to /onboarding/language when hydrated but no language chosen', () => {
    currentPathname = '/';
    const store = buildStore({
      hasUserChosenLanguage: false,
      onboardingComplete: false,
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      `/onboarding/language/?return_to=${encodeURIComponent('/')}`,
    );
  });

  it('redirects to /onboarding/location when language is chosen but ZIP is not saved', () => {
    currentPathname = '/community';
    const store = buildStore({
      hasUserChosenLanguage: true,
      language: 'zh',
      onboardingComplete: false,
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      `/onboarding/location/?return_to=${encodeURIComponent('/community')}`,
    );
  });

  it('does not redirect when onboarding is already complete', () => {
    currentPathname = '/';
    const store = buildStore({
      hasUserChosenLanguage: true,
      onboardingComplete: true,
      zipCode: '11385',
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('waits (no redirect) until Redux has hydrated', () => {
    currentPathname = '/';
    // Skip hydratePreferences dispatch so hydrationComplete stays false.
    const store = buildStore();
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does not redirect when the user is already on an onboarding route', () => {
    currentPathname = '/onboarding/language';
    const store = buildStore({
      hasUserChosenLanguage: false,
      onboardingComplete: false,
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  // Magic-link URLs land on /me/verify with a single-use token in the query
  // string. If the guard bounces an unverified, un-onboarded user to
  // /onboarding/language before VerifyScreen consumes the token, the link
  // is burned. Pin the exemption so that bug can't come back.
  it('does not redirect on /me/verify even when onboarding is incomplete', () => {
    currentPathname = '/me/verify';
    currentSearch = new URLSearchParams(
      'challenge_id=abc&token=magic_link_token_123',
    );
    const store = buildStore({
      hasUserChosenLanguage: false,
      onboardingComplete: false,
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('preserves and URL-encodes the current pathname + query as return_to', () => {
    currentPathname = '/posts/abc';
    currentSearch = new URLSearchParams('q=open');
    const store = buildStore({
      hasUserChosenLanguage: false,
      onboardingComplete: false,
    });
    renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).toHaveBeenCalledWith(
      `/onboarding/language/?return_to=${encodeURIComponent('/posts/abc?q=open')}`,
    );
  });

  it('re-evaluates once language is dispatched (rerun effect)', () => {
    currentPathname = '/inbox';
    const store = buildStore({
      hasUserChosenLanguage: false,
      onboardingComplete: false,
    });
    const { rerender } = renderWithStore(<OnboardingGuardHarness />, store);

    expect(replaceMock).toHaveBeenCalledWith(
      `/onboarding/language/?return_to=${encodeURIComponent('/inbox')}`,
    );

    replaceMock.mockClear();
    store.dispatch(setLanguage('es'));
    rerender(
      <Provider store={store}>
        <OnboardingGuardHarness />
      </Provider>,
    );

    expect(replaceMock).toHaveBeenCalledWith(
      `/onboarding/location/?return_to=${encodeURIComponent('/inbox')}`,
    );
  });
});

describe('useOnboardingDestination', () => {
  it('returns the fallback when no return_to is present', () => {
    currentSearch = new URLSearchParams();
    let resolved = '';
    const store = buildStore();
    renderWithStore(
      <DestinationHarness
        fallback="/onboarding/location"
        onResolve={(value) => {
          resolved = value;
        }}
      />,
      store,
    );
    expect(resolved).toBe('/onboarding/location');
  });

  it('defaults the fallback to `/` when no argument is provided', () => {
    currentSearch = new URLSearchParams();
    let resolved = '';
    const store = buildStore();
    renderWithStore(
      <DestinationHarness
        onResolve={(value) => {
          resolved = value;
        }}
      />,
      store,
    );
    expect(resolved).toBe('/');
  });

  it('returns a safe same-origin return_to unchanged', () => {
    currentSearch = new URLSearchParams('return_to=/posts/abc');
    let resolved = '';
    const store = buildStore();
    renderWithStore(
      <DestinationHarness
        onResolve={(value) => {
          resolved = value;
        }}
      />,
      store,
    );
    expect(resolved).toBe('/posts/abc');
  });

  it('rejects an off-origin return_to and falls back to `/`', () => {
    // `URLSearchParams` decodes the raw string, so we can pass the unsafe
    // URL directly — no extra encoding needed.
    currentSearch = new URLSearchParams('return_to=https://evil.com/');
    let resolved = '';
    const store = buildStore();
    renderWithStore(
      <DestinationHarness
        onResolve={(value) => {
          resolved = value;
        }}
      />,
      store,
    );
    expect(resolved).toBe('/');
  });

  it('rejects a protocol-relative return_to and falls back to `/`', () => {
    currentSearch = new URLSearchParams('return_to=//attacker.com/path');
    let resolved = '';
    const store = buildStore();
    renderWithStore(
      <DestinationHarness
        onResolve={(value) => {
          resolved = value;
        }}
      />,
      store,
    );
    expect(resolved).toBe('/');
  });
});
