/**
 * Wave 4C — vitest coverage for the redesigned ResourceDetailScreen.
 *
 * Focus:
 *   - Preserves the E2E-load-bearing testids: `bookmark-{providerId}` and
 *     the `resource-detail-{field}` family (title, hours, address, phone,
 *     website, languages, notes, call, directions). The eligibility row
 *     was intentionally removed (W4 R3 B3) because `ResourceDetail` has
 *     no distinct `eligibility` field — the old row mirrored `notes`.
 *   - Renders the EmptyState with the error illustration when the query
 *     fails or returns no data (404 path).
 *   - Uses the existing `hoursTitle` + `notesTitle` i18n keys so the
 *     Playwright smoke that searches for "Horario semanal" / "Notas"
 *     keeps matching.
 *   - Dispatches `toggleBookmark` when the bookmark IconButton fires and
 *     flips `aria-pressed` on the single bookmark affordance (W4 R3 L3).
 *   - Asserts the `tel:` + Google-Maps `directions_url` conventions stay
 *     on the Call / Directions Buttons (W4 R3 L3).
 *   - Covers the closed-now status variant (`Tag tone="urgent"`) so the
 *     hero status tag regression-proofs against the M1 "Today" collapse.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  preferencesReducer,
  hydratePreferences,
} from '@/lib/slices/preferences-slice';
import type { ResourceDetail } from '@/lib/types';
import { ResourceDetailScreen } from './resource-detail-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/resources/77777777-7777-4777-8777-777777777777',
  useSearchParams: () => new URLSearchParams(''),
}));

const getResourceMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getResource: (...args: unknown[]) => getResourceMock(...args),
  };
});

function buildDetail(overrides: Partial<ResourceDetail> = {}): ResourceDetail {
  return {
    provider_id: '77777777-7777-4777-8777-777777777777',
    name: "St. Kilian's Social Ministry",
    type: 'pantry',
    address: '140 Elizabeth St., Farmingdale, NY 11735',
    city: 'Farmingdale',
    state: 'NY',
    zip: '11735',
    phone: '5167569656',
    languages: ['en', 'es'],
    source: 'island_harvest',
    source_label: 'Island Harvest Pantry Finder',
    notes: 'Official pantry listing.',
    distance_miles: 0.15,
    is_open_now: true,
    is_open_today: true,
    geo_precision: 'street',
    directions_url:
      'https://maps.apple.com/?q=140%20Elizabeth%20St.%2C%20Farmingdale%2C%20NY%2011735',
    weekly_hours: [
      { day: 'mon', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'tue', windows: [], closed: true },
      { day: 'wed', windows: [{ opens_at: '09:00AM', closes_at: '12:00PM' }], closed: false },
      { day: 'thu', windows: [], closed: true },
      { day: 'fri', windows: [], closed: true },
      { day: 'sat', windows: [], closed: true },
      { day: 'sun', windows: [], closed: true },
    ],
    source_url: 'https://example.org/pantries/77777777',
    ...overrides,
  };
}

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

function renderScreen(options: { locale?: 'en' | 'es'; zip?: string } = {}) {
  const { locale = 'en', zip = '11735' } = options;
  const store = buildStore();
  store.dispatch(
    hydratePreferences({
      language: locale,
      zipCode: zip,
      onboardingComplete: true,
      lowBandwidth: false,
      bookmarks: [],
      defaultPostVisibility: 'community_only',
      locationPrecision: 'zip_only',
      hasUserChosenLanguage: true,
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
          locale={locale}
          messages={messages[locale]}
          timeZone="America/New_York"
        >
          <ResourceDetailScreen providerId="77777777-7777-4777-8777-777777777777" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  getResourceMock.mockResolvedValue(buildDetail());
});

afterEach(() => {
  cleanup();
  getResourceMock.mockReset();
});

describe('ResourceDetailScreen (Wave 4C redesign)', () => {
  it('renders title and primary CTAs once detail resolves', async () => {
    renderScreen();
    // Title lives under its own testid so the hero region is grep-friendly.
    expect(
      await screen.findByTestId('resource-detail-title'),
    ).toHaveTextContent("St. Kilian's Social Ministry");
    // Primary CTAs: Call + Directions — both testid-tagged.
    expect(screen.getByTestId('resource-detail-call')).toHaveAttribute(
      'href',
      'tel:5167569656',
    );
    expect(screen.getByTestId('resource-detail-directions')).toHaveAttribute(
      'href',
      expect.stringContaining('maps.apple.com'),
    );
  });

  it('emits the preserved bookmark-{id} testid and toggles Redux state', async () => {
    const { store } = renderScreen();
    const bookmark = await screen.findByTestId(
      'bookmark-77777777-7777-4777-8777-777777777777',
    );
    fireEvent.click(bookmark);
    await waitFor(() => {
      expect(store.getState().preferences.bookmarks).toContain(
        '77777777-7777-4777-8777-777777777777',
      );
    });
  });

  it('exposes resource-detail-{field} testids for the metadata grid', async () => {
    renderScreen();
    await screen.findByTestId('resource-detail-title');
    // Core fields that the E2E + a11y contract relies on.
    expect(screen.getByTestId('resource-detail-address')).toHaveTextContent(
      /140 Elizabeth St/,
    );
    expect(screen.getByTestId('resource-detail-phone')).toHaveTextContent(
      '5167569656',
    );
    expect(screen.getByTestId('resource-detail-website')).toBeInTheDocument();
    expect(screen.getByTestId('resource-detail-languages')).toHaveTextContent(
      /en, es/,
    );
    // Eligibility row was removed in W4 R3 B3 — the metric list must no
    // longer expose the testid that used to shadow the Notes copy.
    expect(
      screen.queryByTestId('resource-detail-eligibility'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('resource-detail-notes')).toHaveTextContent(
      'Official pantry listing.',
    );
    // Hours + notes sections keep the original headings so the ES E2E smoke
    // still finds "Horario semanal" and "Notas" (the i18n keys are reused).
    expect(
      screen.getByRole('heading', { level: 2, name: messages.en.hoursTitle }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: messages.en.notesTitle }),
    ).toBeInTheDocument();
  });

  it('wires Call to `tel:` and Directions to the detail `directions_url`', async () => {
    // W4 R3 L3 — pin the href conventions so a future refactor can't
    // silently swap a `tel:` link for an sms: handler or strip the
    // maps deep-link that drives the "Directions" Button on the hero.
    renderScreen();
    await screen.findByTestId('resource-detail-title');
    const call = screen.getByTestId('resource-detail-call');
    expect(call).toHaveAttribute('href', 'tel:5167569656');
    const directions = screen.getByTestId('resource-detail-directions');
    expect(directions).toHaveAttribute(
      'href',
      'https://maps.apple.com/?q=140%20Elizabeth%20St.%2C%20Farmingdale%2C%20NY%2011735',
    );
    expect(directions).toHaveAttribute('target', '_blank');
    expect(directions).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the urgent-tone status Tag when the place is closed now', async () => {
    // W4 R3 L3 — regression-proof the closed branch of the status tag
    // so the hero never silently collapses onto the verified/community
    // tones when `is_open_now` and `is_open_today` are both false.
    getResourceMock.mockResolvedValueOnce(
      buildDetail({ is_open_now: false, is_open_today: false }),
    );
    renderScreen();
    const status = await screen.findByTestId('resource-detail-status');
    expect(status).toHaveTextContent(messages.en.resourceCardClosedNow);
    // The Tag atom renders `tone` as a class on the pill element so
    // we can cheaply assert the urgent variant is applied.
    expect(status.className).toMatch(/tag--urgent/);
  });

  it('toggles aria-pressed on the hero bookmark IconButton', async () => {
    // W4 R3 L3 — the hero IconButton is now the sole bookmark control.
    // `aria-pressed` is load-bearing for screen readers, so pin the
    // toggle through a click round-trip.
    renderScreen();
    const bookmark = await screen.findByTestId(
      'bookmark-77777777-7777-4777-8777-777777777777',
    );
    expect(bookmark).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(bookmark);
    await waitFor(() => {
      expect(
        screen.getByTestId('bookmark-77777777-7777-4777-8777-777777777777'),
      ).toHaveAttribute('aria-pressed', 'true');
    });
    // Clicking again restores the unsaved state — confirms it's a true
    // toggle, not a one-way bookmark-on action.
    fireEvent.click(
      screen.getByTestId('bookmark-77777777-7777-4777-8777-777777777777'),
    );
    await waitFor(() => {
      expect(
        screen.getByTestId('bookmark-77777777-7777-4777-8777-777777777777'),
      ).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('renders the ES hours + notes headings so the Playwright smoke keeps matching', async () => {
    renderScreen({ locale: 'es' });
    await screen.findByTestId('resource-detail-title');
    expect(screen.getByText(messages.es.hoursTitle)).toBeInTheDocument();
    expect(screen.getByText(messages.es.notesTitle)).toBeInTheDocument();
  });

  it('renders an EmptyState with the error illustration when the query errors', async () => {
    getResourceMock.mockRejectedValueOnce(new Error('boom'));
    renderScreen();
    // The error path short-circuits and never renders the cover card.
    // Two "Resource not found." strings are rendered — one in the TopBar
    // title and one as the EmptyState heading — so we assert via the
    // heading role to land specifically on the EmptyState surface.
    await waitFor(() => {
      expect(
        screen.getByRole('heading', {
          level: 2,
          name: messages.en.resourceNotFound,
        }),
      ).toBeInTheDocument();
    });
    // "Back to home" CTA should land on '/'.
    const cta = screen.getByRole('link', {
      name: messages.en.backHome,
    }) as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('/');
  });
});
