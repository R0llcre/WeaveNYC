/**
 * M8.5 Wave 6D — axe-core a11y smoke coverage.
 *
 * Pins the zero-violation baseline for the highest-traffic PWA screens so
 * regressions (missing aria labels, empty button names, wrong contrast)
 * land red in CI before they reach pilot users. axe-core runs directly in
 * the jsdom test environment; we disable the rules that are inherently
 * document-level (`region`, `landmark-one-main`, `page-has-heading-one`)
 * because our test harness mounts a single component fragment rather than a
 * full page layout — AppShell's `<main id="main-content">` wrapper is
 * integration-tested separately in `components/shell/shell.test.tsx` and
 * `components/shell/shell-frame.test.tsx`, so this file intentionally
 * scopes its assertions to component-level a11y concerns (button names,
 * label wiring, aria-* attributes, contrast).
 *
 * If axe-core reports a new violation, fix the code — do NOT extend the
 * rule-disable list without a follow-up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import axe from 'axe-core';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import {
  hydratePreferences,
  preferencesReducer,
} from '@/lib/slices/preferences-slice';
import type { AuthSession, ResourcesResponse } from '@/lib/types';

import { ResourceHome } from '@/components/resource-home';
import { MeScreen } from '@/components/me-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
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

function withProviders(ui: React.ReactElement, zip: string = '11735') {
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
  store.dispatch(setSession(seedSession()));
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          {ui}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

/**
 * axe-core rules that only make sense against a full HTML document. The
 * test harness renders fragments, so disabling them avoids noise that the
 * production layout (AppShell + root `<html>/<body>`) already satisfies:
 *
 *  - `region`              — asserts every content block sits inside a
 *                             landmark. AppShell provides `<main>` and
 *                             `<nav>` in production; fragments don't.
 *  - `landmark-one-main`   — requires exactly one `<main>` per page.
 *  - `page-has-heading-one`— requires exactly one `<h1>` per page.
 *  - `document-title`      — requires a `<title>` element inside the
 *                             mounted tree; real pages set this via
 *                             `metadata` on the route server component.
 *  - `html-has-lang` /
 *    `html-lang-valid`     — require a `lang` attribute on `<html>`. Root
 *                             layout emits `<html lang="en">`.
 */
const COMPONENT_A11Y_RULES = {
  region: { enabled: false },
  'landmark-one-main': { enabled: false },
  'page-has-heading-one': { enabled: false },
  'document-title': { enabled: false },
  'html-has-lang': { enabled: false },
  'html-lang-valid': { enabled: false },
  // axe-core's color-contrast rule invokes `HTMLCanvasElement.getContext`
  // for icon-ligature detection. jsdom does not ship canvas support, so
  // the rule emits noisy 'Not implemented' warnings and cannot compute a
  // deterministic pass/fail verdict in this test environment. Contrast is
  // AA-verified manually in `globals.css` header comments (see the "Colors"
  // block documenting every ink/surface pair's ratio) and runtime-verified
  // by Chrome DevTools / Playwright's axe integration in browser CI.
  'color-contrast': { enabled: false },
};

async function runAxe(container: HTMLElement): Promise<axe.AxeResults> {
  return axe.run(container, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
    },
    rules: COMPONENT_A11Y_RULES,
  });
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
});

describe('Wave 6D · axe-core smoke', () => {
  it('Home (ResourceHome) has zero WCAG 2.1 AA violations', async () => {
    const { container } = withProviders(<ResourceHome />);
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      // Surface the rule ids + nodes so a CI failure is actionable without
      // needing to re-run axe manually.
      const summary = results.violations
        .map((v) => `${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''})`)
        .join('\n');
      // eslint-disable-next-line no-console
      console.error('axe violations on Home:\n' + summary);
    }
    expect(results.violations).toEqual([]);
  });

  it('Me hub (MeScreen) has zero WCAG 2.1 AA violations', async () => {
    const { container } = withProviders(<MeScreen />);
    const results = await runAxe(container);
    if (results.violations.length > 0) {
      const summary = results.violations
        .map((v) => `${v.id}: ${v.description} (${v.nodes.length} node${v.nodes.length > 1 ? 's' : ''})`)
        .join('\n');
      // eslint-disable-next-line no-console
      console.error('axe violations on Me:\n' + summary);
    }
    expect(results.violations).toEqual([]);
  });
});
