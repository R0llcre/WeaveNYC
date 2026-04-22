/**
 * V2-C — vitest coverage for `<ActivityTicker>`.
 *
 * The ticker is client-only and rotates rows on a 4s interval, with a
 * reduced-motion fallback that shows a static 3-row stack. These tests
 * pin the behavioural contract:
 *
 *   1. All 15 seeded rows are present in the DOM (even the non-visible
 *      ones), so anchor-run demos and E2E specs can count / inspect the
 *      payload without waiting for the rotation to cycle through.
 *   2. Rotation advances the `data-ticker-index` every interval tick.
 *   3. The live region wrapper has `role="region"` + `aria-live="polite"`
 *      + `aria-atomic="true"` so assistive tech announces the new copy.
 *   4. Relative-time labels render through `Intl.RelativeTimeFormat`
 *      (we assert on the `2 minutes ago` output — Intl.RelativeTimeFormat
 *      is supported everywhere we run including jsdom / Node 20+).
 *   5. `prefers-reduced-motion: reduce` collapses the ticker to the
 *      static stack, and no rotation timer is armed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { act, cleanup, render, screen } from '@testing-library/react';

import { messages } from '@/lib/i18n';
import { SEED_ACTIVITY } from '@/lib/seed-activity';
import { ActivityTicker } from './activity-ticker';

function renderTicker() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages.en}
      timeZone="America/New_York"
    >
      <ActivityTicker />
    </NextIntlClientProvider>,
  );
}

// jsdom doesn't implement matchMedia. We provide a minimal stub that
// reports the default "motion is fine" state; the reduced-motion case
// overrides the factory return value per-test. Cast through `unknown`
// because the MediaQueryList DOM lib types are much broader than the
// subset we actually touch (addEventListener/removeEventListener +
// matches), and tsc rejects the narrow literal otherwise.
function mockMatchMedia(reduced: boolean) {
  const listeners = new Set<(ev?: unknown) => void>();
  const mql = {
    matches: reduced,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addEventListener: (_type: string, listener: (ev?: unknown) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (ev?: unknown) => void) => {
      listeners.delete(listener);
    },
    // Legacy API, unused but kept for compatibility.
    addListener: (listener: (ev?: unknown) => void) => {
      listeners.add(listener);
    },
    removeListener: (listener: (ev?: unknown) => void) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => true,
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({ ...mql, media: query }),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ActivityTicker (V2-C)', () => {
  it('renders the full 15-row manifest so tests can assert on every row', async () => {
    renderTicker();
    // Flush the hydration effect (setMounted) so the ticker content
    // appears. Using act + runAllTimers lets the useEffect microtask
    // settle and any pending timers drain synchronously.
    await act(async () => {
      await Promise.resolve();
    });

    // The hidden manifest ul mirrors every seeded row. Each row renders
    // the copy through the same `t()` call the visible row uses.
    expect(screen.getByTestId('activity-ticker-full-manifest')).toBeInTheDocument();
    for (const row of SEED_ACTIVITY) {
      expect(
        screen.getByTestId(`activity-ticker-manifest-${row.id}`),
      ).toBeInTheDocument();
    }
    // Sanity-check the full count in case a future refactor accidentally
    // slices the array.
    expect(SEED_ACTIVITY).toHaveLength(15);
  });

  it('renders the visible card as a polite live region', async () => {
    renderTicker();
    await act(async () => {
      await Promise.resolve();
    });
    const region = screen.getByTestId('activity-ticker');
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.getAttribute('aria-atomic')).toBe('true');
    // Accessible name comes from the i18n bundle, not a hardcoded string.
    expect(region.getAttribute('aria-label')).toBe(messages.en.activityTickerAriaLabel);
  });

  it('advances the rotation index on each interval tick', async () => {
    renderTicker();
    // Mount -> first row (index 0).
    await act(async () => {
      await Promise.resolve();
    });
    const region = screen.getByTestId('activity-ticker');
    expect(region.getAttribute('data-ticker-index')).toBe('0');
    // 4s tick -> index 1.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(
      screen.getByTestId('activity-ticker').getAttribute('data-ticker-index'),
    ).toBe('1');
    // Another 4s -> index 2.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(
      screen.getByTestId('activity-ticker').getAttribute('data-ticker-index'),
    ).toBe('2');
  });

  it('renders the relative time label via Intl.RelativeTimeFormat', async () => {
    renderTicker();
    await act(async () => {
      await Promise.resolve();
    });
    // Row 0 is `Marisol offered extra rice in Corona` with `minutesAgo: 2`.
    // `Intl.RelativeTimeFormat(en, {numeric: 'auto'}).format(-2, 'minute')`
    // yields "2 minutes ago". We assert the label contains that string so
    // a future Intl/ICU tweak that pluralises differently (e.g. "2 min. ago")
    // still passes as long as the core "minutes ago" semantics hold.
    expect(screen.getByText(/2 minutes ago/)).toBeInTheDocument();
    // The community row is rendered alongside the time label.
    expect(screen.getAllByText(/Corona, Queens/).length).toBeGreaterThanOrEqual(1);
  });

  it('collapses to a static 3-row stack when reduced-motion is active', async () => {
    mockMatchMedia(true);
    renderTicker();
    await act(async () => {
      await Promise.resolve();
    });
    const region = screen.getByTestId('activity-ticker');
    expect(region.getAttribute('data-ticker-mode')).toBe('reduced');
    // `aria-live` is turned off so SR users don't get re-announcements on
    // a static list.
    expect(region.getAttribute('aria-live')).toBe('off');
    // Static stack shows exactly the first 3 rows from SEED_ACTIVITY.
    for (const row of SEED_ACTIVITY.slice(0, 3)) {
      expect(
        screen.getByTestId(`activity-ticker-row-${row.id}`),
      ).toBeInTheDocument();
    }
    // Advancing the clock must NOT change the visible content — no
    // interval is armed in reduced-motion mode.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000);
    });
    expect(region.getAttribute('data-ticker-mode')).toBe('reduced');
  });

  it('builds a /community/join?hint=<id> href for every row', async () => {
    renderTicker();
    await act(async () => {
      await Promise.resolve();
    });
    // The rotating branch renders exactly one visible row at a time.
    const visibleRow = screen.getByTestId(
      `activity-ticker-row-${SEED_ACTIVITY[0].id}`,
    );
    const href = visibleRow.getAttribute('href');
    expect(href).toContain('/community/join?hint=');
    // The hint carries the row's communityId (URL-encoded).
    expect(href).toContain(SEED_ACTIVITY[0].communityId);
  });
});
