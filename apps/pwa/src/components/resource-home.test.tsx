/**
 * Wave 3A — vitest coverage for the redesigned ResourceHome screen.
 *
 * Focus:
 *   - Preserves the E2E-load-bearing testids: `create-session`, `see-nearby`,
 *     and the pass-through `resource-detail-{id}` / `bookmark-{id}` emitted
 *     by the ResourceCard atom.
 *   - Renders the EmptyState when no ZIP is set (no resource query fired).
 *   - Renders the ResourceCard list + count row when resources load.
 *   - Dispatches `toggleBookmark` when the bookmark IconButton fires.
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

function renderHome(options: { zip?: string; withSession?: boolean } = {}) {
  const { zip = '', withSession = true } = options;
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

    // `create-session` — hero CTA kept for smoke-test coverage.
    expect(screen.getByTestId('create-session')).toBeInTheDocument();
    // `see-nearby` — attached to the "All" filter pill.
    expect(screen.getByTestId('see-nearby')).toBeInTheDocument();
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
});
