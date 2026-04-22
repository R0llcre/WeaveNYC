/**
 * Wave 3A — vitest coverage for the redesigned ResourceHome screen.
 *
 * Focus:
 *   - Preserves the E2E-load-bearing testids: `create-session`, `see-nearby`,
 *     `session-chip`, and the pass-through `resource-detail-{id}` /
 *     `bookmark-{id}` emitted by the ResourceCard atom. V1-A UX surgery
 *     demoted `create-session` and `session-chip` to sr-only shims so the
 *     tests confirm they're still *in the DOM* (not that they're visible).
 *   - Renders the EmptyState when no ZIP is set (no resource query fired).
 *   - Renders the ResourceCard list + count row when resources load.
 *   - Dispatches `toggleBookmark` when the bookmark IconButton fires.
 *   - Splits real API errors from empty results so a 500 no longer
 *     masquerades as "Nothing nearby".
 *
 * Full end-to-end flow (onboarding → home → detail → verify) is covered by
 * tests/e2e/resource-smoke.spec.ts. This file is the fast Vitest gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  preferencesReducer,
  hydratePreferences,
} from '@/lib/slices/preferences-slice';
import type { AuthSession, ResourcesResponse } from '@/lib/types';
import { ResourceHome } from './resource-home';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, back: vi.fn() }),
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

const searchResourcesMock = vi.fn();
const createAnonymousMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    searchResources: (...args: unknown[]) => searchResourcesMock(...args),
    createAnonymousSession: (...args: unknown[]) => createAnonymousMock(...args),
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

function seedSession(): AuthSession {
  return {
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '11111111-1111-4111-8111-111111111111',
      level: 'anonymous',
    },
    issued_via: 'anonymous',
  };
}

function renderHome(
  options: {
    zip?: string;
    withSession?: boolean;
    lastIntent?: import('@/lib/types').HomeIntent | null;
  } = {},
) {
  const { zip = '', withSession = true, lastIntent = null } = options;
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
      lastIntent,
    }),
  );
  if (withSession) {
    store.dispatch(setSession(seedSession()));
  }
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
          <ResourceHome />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

function buildResource(overrides: Partial<ResourcesResponse['items'][number]> = {}) {
  return {
    provider_id: '77777777-7777-4777-8777-777777777777',
    name: 'St. Kilian Food Pantry',
    type: 'pantry' as const,
    address: '123 Main St',
    city: 'Farmingdale',
    state: 'NY',
    zip: '11735',
    phone: '555-0100',
    languages: ['en'],
    source: 'NYC',
    source_label: 'NYC Open Data',
    notes: null,
    distance_miles: 0.4,
    is_open_now: true,
    is_open_today: true,
    geo_precision: 'rooftop' as const,
    directions_url: 'https://maps.example.com/?q=123+Main',
    ...overrides,
  };
}

beforeEach(() => {
  createAnonymousMock.mockImplementation(() => new Promise(() => {}));
  searchResourcesMock.mockResolvedValue({
    items: [],
    next_cursor: null,
    source_mode: 'api',
  } satisfies ResourcesResponse);
});

afterEach(() => {
  cleanup();
  searchResourcesMock.mockReset();
  createAnonymousMock.mockReset();
  pushMock.mockReset();
});

describe('ResourceHome (Wave 3A redesign)', () => {
  it('exposes the stable E2E testids on the hero and filter row', () => {
    renderHome({ zip: '11735' });

    // V1-A UX fix — `create-session` is now an sr-only refetch shim (the
    // visible "Ready to go" button was a no-op). The testid still resolves
    // because the element is in the DOM; the `sr-only` class hides it from
    // sighted users without removing it from the accessibility tree for
    // assertive queries like getByTestId.
    const createSession = screen.getByTestId('create-session');
    expect(createSession).toBeInTheDocument();
    expect(createSession.className).toContain('sr-only');
    // `session-chip` — sr-only span that still carries the full user_id
    // so tests/e2e/resource-smoke.spec.ts (`toContainText(user_id)`) stays
    // green without rendering a UUID in the visible hero.
    const sessionChip = screen.getByTestId('session-chip');
    expect(sessionChip).toHaveTextContent('11111111-1111-4111-8111-111111111111');
    expect(sessionChip.className).toContain('sr-only');
    // `see-nearby` — attached to the "All" filter pill.
    expect(screen.getByTestId('see-nearby')).toBeInTheDocument();
  });

  it('renders a dedicated error EmptyState when the resources query fails', async () => {
    // V1-A UX fix — a real 500 on `/v1/resources/search` used to land on
    // the `items.length === 0` branch and show "Nothing nearby", blaming
    // the user's ZIP. Now the isError branch renders tone="error" with a
    // retry CTA and the resolved error-i18n title.
    searchResourcesMock.mockRejectedValue(
      new Error('/v1/resources/search failed: HTTP 500 {"error":"server_error"}'),
    );

    renderHome({ zip: '11735' });

    expect(
      await screen.findByText(messages.en.errorServer),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.en.homeErrorSubtitle)).toBeInTheDocument();
    expect(screen.getByTestId('home-empty-retry')).toBeInTheDocument();
    // Should NOT show the no-results copy — that's the bug we just fixed.
    expect(
      screen.queryByText(/We couldn't find services near/i),
    ).not.toBeInTheDocument();
  });

  it('renders the EmptyState + /me/settings CTA when the ZIP is missing', () => {
    renderHome({ zip: '' });

    // W3 review fix — no-ZIP case now uses homeNoZip* copy distinct from no-results.
    expect(screen.getByText(messages.en.homeNoZipTitle)).toBeInTheDocument();
    const cta = screen.getByTestId('home-empty-set-zip') as HTMLAnchorElement;
    // Trailing slash required by the PWA's static-export config (see
    // W8 UX audit, P0 trailing-slash 404 regressions).
    expect(cta.getAttribute('href')).toBe('/me/settings/');
    // With no ZIP we must not fire the resources query.
    expect(searchResourcesMock).not.toHaveBeenCalled();
  });

  it('renders the ResourceCard list and count row once results load', async () => {
    searchResourcesMock.mockResolvedValue({
      items: [buildResource()],
      next_cursor: null,
      source_mode: 'api',
    } satisfies ResourcesResponse);

    renderHome({ zip: '11735' });

    expect(await screen.findByText(/St. Kilian Food Pantry/)).toBeInTheDocument();
    // Count row uses the `homeResultsCount` i18n key ("{count} nearby").
    expect(screen.getByText(/1 nearby/)).toBeInTheDocument();
    // ResourceCard atom emits the stable detail + bookmark testids.
    expect(
      screen.getByTestId('resource-detail-77777777-7777-4777-8777-777777777777'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('bookmark-77777777-7777-4777-8777-777777777777'),
    ).toBeInTheDocument();
  });

  it('dispatches toggleBookmark when the card bookmark button is clicked', async () => {
    searchResourcesMock.mockResolvedValue({
      items: [buildResource()],
      next_cursor: null,
      source_mode: 'api',
    } satisfies ResourcesResponse);

    const { store } = renderHome({ zip: '11735' });
    await screen.findByText(/St. Kilian Food Pantry/);

    fireEvent.click(
      screen.getByTestId('bookmark-77777777-7777-4777-8777-777777777777'),
    );

    await waitFor(() => {
      expect(store.getState().preferences.bookmarks).toContain(
        '77777777-7777-4777-8777-777777777777',
      );
    });
  });

  it('changes the active filter pill and re-fires the resource query', async () => {
    renderHome({ zip: '11735' });

    // Initial mount fires the query once with type "all".
    await waitFor(() => {
      expect(searchResourcesMock).toHaveBeenCalled();
    });
    const firstCall = searchResourcesMock.mock.calls[0][0];
    expect(firstCall.type).toBe('all');

    fireEvent.click(screen.getByTestId('home-filter-food'));

    await waitFor(() => {
      const latest = searchResourcesMock.mock.calls.at(-1)?.[0];
      expect(latest?.type).toBe('pantry');
    });
  });

  // V1-D situational chips — multi-select. Each chip toggles an openNow /
  // today flag on the query input; both can be active simultaneously.
  it('toggles Open now / Today situational chips into the query input', async () => {
    renderHome({ zip: '11735' });
    await waitFor(() => {
      expect(searchResourcesMock).toHaveBeenCalled();
    });
    // First mount: no situational filters set, openNow/today are undefined.
    const firstCall = searchResourcesMock.mock.calls[0][0];
    expect(firstCall.openNow).toBeUndefined();
    expect(firstCall.today).toBeUndefined();

    fireEvent.click(screen.getByTestId('home-filter-open-now'));
    await waitFor(() => {
      const latest = searchResourcesMock.mock.calls.at(-1)?.[0];
      expect(latest?.openNow).toBe(true);
      expect(latest?.today).toBeUndefined();
    });

    // Multi-select: Today can be added on top of Open now.
    fireEvent.click(screen.getByTestId('home-filter-today'));
    await waitFor(() => {
      const latest = searchResourcesMock.mock.calls.at(-1)?.[0];
      expect(latest?.openNow).toBe(true);
      expect(latest?.today).toBe(true);
    });

    // Tapping again removes the chip (toggle semantics).
    fireEvent.click(screen.getByTestId('home-filter-open-now'));
    await waitFor(() => {
      const latest = searchResourcesMock.mock.calls.at(-1)?.[0];
      expect(latest?.openNow).toBeUndefined();
      expect(latest?.today).toBe(true);
    });
  });

  // V1-D sparse-results fallback — when the list has 1-2 items, the UI
  // appends a secondary EmptyState card so the thin result set reads as
  // "expand your search" instead of "nothing here".
  it('renders the sparse-results fallback when the list has 1-2 items', async () => {
    searchResourcesMock.mockResolvedValue({
      items: [buildResource()],
      next_cursor: null,
      source_mode: 'api',
    } satisfies ResourcesResponse);

    renderHome({ zip: '11368' });

    expect(await screen.findByTestId('home-sparse-fallback')).toBeInTheDocument();
    expect(screen.getByTestId('home-sparse-nearby')).toBeInTheDocument();
    // The primary result card still renders above the fallback.
    expect(screen.getByText(/St. Kilian Food Pantry/)).toBeInTheDocument();
  });

  it('does not render the sparse-results fallback when 3+ items are present', async () => {
    searchResourcesMock.mockResolvedValue({
      items: [
        buildResource({ provider_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        buildResource({ provider_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }),
        buildResource({ provider_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
      ],
      next_cursor: null,
      source_mode: 'api',
    } satisfies ResourcesResponse);

    renderHome({ zip: '11368' });

    await screen.findByText(/3 nearby/);
    expect(screen.queryByTestId('home-sparse-fallback')).not.toBeInTheDocument();
  });

  // V2-D — when the user arrived here from the Home wizard, the initial
  // filter + situational state is pre-seeded from the intent. The intent
  // → filter mapping is documented on `initialFilterStateForIntent` in
  // resource-home.tsx and reproduced on the `HomeIntent` type.
  describe('V2-D wizard intent pre-filtering', () => {
    it('pre-applies type=all + openNow=true for food_now intent', async () => {
      renderHome({ zip: '11735', lastIntent: 'food_now' });
      await waitFor(() => {
        expect(searchResourcesMock).toHaveBeenCalled();
      });
      const firstCall = searchResourcesMock.mock.calls[0][0];
      expect(firstCall.type).toBe('all');
      expect(firstCall.openNow).toBe(true);
      expect(firstCall.today).toBeUndefined();
      // The Open now chip renders in its active state so the user can see
      // why the list is filtered.
      expect(screen.getByTestId('home-filter-open-now')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('pre-applies type=pantry + today=true for food_week intent', async () => {
      renderHome({ zip: '11735', lastIntent: 'food_week' });
      await waitFor(() => {
        expect(searchResourcesMock).toHaveBeenCalled();
      });
      const firstCall = searchResourcesMock.mock.calls[0][0];
      expect(firstCall.type).toBe('pantry');
      expect(firstCall.today).toBe(true);
      expect(firstCall.openNow).toBeUndefined();
    });

    it('pre-applies type=benefits for doctor intent', async () => {
      renderHome({ zip: '11735', lastIntent: 'doctor' });
      await waitFor(() => {
        expect(searchResourcesMock).toHaveBeenCalled();
      });
      const firstCall = searchResourcesMock.mock.calls[0][0];
      expect(firstCall.type).toBe('benefits');
      expect(firstCall.openNow).toBeUndefined();
      expect(firstCall.today).toBeUndefined();
    });

    it('pre-applies type=other for sleep intent', async () => {
      renderHome({ zip: '11735', lastIntent: 'sleep' });
      await waitFor(() => {
        expect(searchResourcesMock).toHaveBeenCalled();
      });
      const firstCall = searchResourcesMock.mock.calls[0][0];
      expect(firstCall.type).toBe('other');
    });

    it('renders the Change intent ghost button only when lastIntent is set', () => {
      // No intent → no button.
      const { unmount } = renderHome({ zip: '11735', lastIntent: null });
      expect(
        screen.queryByTestId('home-change-intent'),
      ).not.toBeInTheDocument();
      unmount();

      // With intent → the button is visible.
      renderHome({ zip: '11735', lastIntent: 'food_now' });
      expect(screen.getByTestId('home-change-intent')).toBeInTheDocument();
    });

    it('clears lastIntent when the Change intent button is tapped', () => {
      const { store } = renderHome({ zip: '11735', lastIntent: 'food_now' });
      expect(store.getState().preferences.lastIntent).toBe('food_now');

      fireEvent.click(screen.getByTestId('home-change-intent'));

      expect(store.getState().preferences.lastIntent).toBeNull();
    });
  });

  // V2-C — neighbor banner + activity ticker must render for anonymous
  // visitors (the primary use case — Home is their first exposure to the
  // social layer). We assert on the banner copy plus the ticker's stable
  // testid. The anonymous-banner path is the default: the fixture session
  // uses `level: 'anonymous'`, so `isReturningNeighbor` is false and the
  // non-returning copy wins.
  it('renders the neighbor banner and activity ticker for anonymous users', async () => {
    renderHome({ zip: '11735' });
    // Banner uses the anon-variant title since the fixture session is
    // anonymous (`level === 'anonymous'`).
    expect(
      await screen.findByTestId('home-neighbor-banner'),
    ).toHaveTextContent(messages.en.homeNeighborBannerTitle);
    // The ticker mounts client-side after the hydration effect. Use
    // findByTestId to wait for the mount.
    expect(await screen.findByTestId('activity-ticker')).toBeInTheDocument();
  });

  // V2-C — when the session carries a non-anonymous level (verified /
  // anchor), the banner swaps to the "welcome back" variant. This pins
  // the returning-neighbor copy path.
  it('renders the returning-neighbor banner for non-anonymous users', async () => {
    const store = buildStore();
    store.dispatch(
      hydratePreferences({
        language: 'en',
        zipCode: '11735',
        onboardingComplete: true,
        lowBandwidth: false,
        bookmarks: [],
        defaultPostVisibility: 'community_only',
        locationPrecision: 'zip_only',
        hasUserChosenLanguage: true,
      }),
    );
    store.dispatch(
      setSession({
        access_token: 'verified-access',
        refresh_token: 'verified-refresh',
        user: {
          user_id: '11111111-1111-4111-8111-111111111111',
          level: 'verified',
        },
        issued_via: 'otp',
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider
            locale="en"
            messages={messages.en}
            timeZone="America/New_York"
          >
            <ResourceHome />
          </NextIntlClientProvider>
        </QueryClientProvider>
      </Provider>,
    );
    expect(
      await screen.findByTestId('home-neighbor-banner'),
    ).toHaveTextContent(messages.en.homeNeighborBannerTitleReturning);
  });
});
