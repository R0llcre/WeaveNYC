/**
 * M8.5 W2C — ShellFrame coverage.
 *
 * ShellFrame is the root-layout client island that conditionally wraps
 * children in `<AppShell>` based on the active pathname. The three tests
 * below pin its public contract so onboarding pages stay takeover-only
 * (no tab bar, no shell chrome) while every other route keeps the
 * persistent 5-tab bottom navigation:
 *
 *   1. `/`                       → rendered inside `<AppShell>`
 *   2. `/onboarding/language`    → rendered bare, NO `.shell` wrapper
 *   3. `/me`                     → rendered inside `<AppShell>` (tab routes)
 *
 * The rendering setup mirrors `shell.test.tsx`: next/link is mocked to a
 * plain anchor, `usePathname` is stubbed per-test via a shared
 * `pathnameValue` ref, and i18n is wired with the real `en` bundle so the
 * BottomTabBar labels resolve.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { cleanup, render, screen } from '@testing-library/react';

import { messages } from '@/lib/i18n';
import { authReducer } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import { ShellFrame } from './ShellFrame';

// ShellFrame now mounts `useOutboxDrain`, which touches IndexedDB via
// `@/lib/db` and the persistence helpers. In the node/jsdom harness
// IndexedDB is absent, so we stub the Dexie getter to return null —
// matching the runtime branch that short-circuits on missing IDB.
vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db')>('@/lib/db');
  return {
    ...actual,
    getPwaDb: () => null,
  };
});

// --- next/link → plain anchor (tab bar renders <Link> items). ---------------
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

// --- next/navigation ---
// Mutable `pathnameValue` lets a single module instance simulate any route.
// `usePathname` is read synchronously during render so updating this before
// the call to `render()` is sufficient.
let pathnameValue: string = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => pathnameValue,
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

function renderFrame(ui: React.ReactElement) {
  // ShellFrame mounts `useOutboxDrain` which reads the Redux session and
  // uses the React-Query client. Wrap each render in both providers so
  // the hook's dependencies resolve cleanly under jsdom.
  const store = buildStore();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={messages.en} timeZone="America/New_York">
          {ui}
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

afterEach(() => {
  cleanup();
  pathnameValue = '/';
});

describe('shell/ShellFrame', () => {
  it('wraps children in <AppShell> on the root route', () => {
    pathnameValue = '/';
    const { container } = renderFrame(
      <ShellFrame>
        <p data-testid="child">home-body</p>
      </ShellFrame>,
    );

    // AppShell renders a `.shell` wrapper + BottomTabBar; assert both.
    expect(container.querySelector('.shell')).not.toBeNull();
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('home-body');
  });

  it('renders children bare on an /onboarding/** route (no AppShell chrome)', () => {
    pathnameValue = '/onboarding/language';
    const { container } = renderFrame(
      <ShellFrame>
        <p data-testid="child">onboarding-body</p>
      </ShellFrame>,
    );

    // No `.shell` wrapper means the takeover layout owns chrome end-to-end.
    expect(container.querySelector('.shell')).toBeNull();
    // And therefore none of the five tabs render either.
    expect(screen.queryByTestId('tab-home')).toBeNull();
    expect(screen.queryByTestId('tab-me')).toBeNull();
    // The page body still renders.
    expect(screen.getByTestId('child')).toHaveTextContent('onboarding-body');
  });

  it('wraps children in <AppShell> on the /me tab route', () => {
    pathnameValue = '/me';
    const { container } = renderFrame(
      <ShellFrame>
        <p data-testid="child">me-body</p>
      </ShellFrame>,
    );

    expect(container.querySelector('.shell')).not.toBeNull();
    // `/me` lights the "me" tab via deriveActiveTab.
    const meTab = screen.getByTestId('tab-me');
    expect(meTab).toBeInTheDocument();
    expect(meTab).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('child')).toHaveTextContent('me-body');
  });

  it('keeps the tab bar visible (no tab highlighted) on off-tab detail routes', () => {
    pathnameValue = '/resource/abc-123';
    const { container } = renderFrame(
      <ShellFrame>
        <p data-testid="child">detail-body</p>
      </ShellFrame>,
    );

    // Shell renders — detail routes still show the tab bar.
    expect(container.querySelector('.shell')).not.toBeNull();
    expect(screen.getByTestId('tab-home')).toBeInTheDocument();
    // …but no tab is highlighted because /resource doesn't map to one.
    for (const key of ['home', 'community', 'post', 'inbox', 'me']) {
      expect(screen.getByTestId(`tab-${key}`)).not.toHaveAttribute('aria-current');
    }
  });
});
