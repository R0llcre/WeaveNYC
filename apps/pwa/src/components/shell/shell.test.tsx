/**
 * Wave 2A — AppShell / TopBar / BottomTabBar coverage.
 *
 * These tests pin the shell's public contract so the 5-tab navigation,
 * `aria-current="page"` semantics, and `hideTabBar` escape hatch don't
 * regress while W3+ agents compose the shell into real routes.
 *
 * The rendering setup mirrors `apps/pwa/src/components/ui/ui.test.tsx` and
 * `apps/pwa/src/components/onboarding.test.tsx`: next/link is mocked to a
 * plain anchor, next/navigation is mocked with a per-test pathname, and the
 * NextIntlClientProvider is wired with the real `en` message bundle so the
 * i18n keys (`shellTabHome`, `shellBackButton`, …) actually resolve.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { cleanup, render, screen } from '@testing-library/react';

import { messages } from '@/lib/i18n';
import { AppShell } from './AppShell';
import { BottomTabBar } from './BottomTabBar';
import { TopBar } from './TopBar';

// --- next/link → plain anchor so Link navigation exposes a real href. ---
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
// `pathnameValue` is mutated per-test so a single module instance can
// simulate different routes (usePathname is read synchronously on render).
// `backMock` records router.back() calls from TopBar's back button.
// `pushMock` records router.push() calls — exercised by the W5 R3/L2
// deep-link fallback where `window.history.length <= 1` should push the
// declared `backHref` instead of leaving the origin.
const backMock = vi.fn();
const pushMock = vi.fn();
let pathnameValue: string = '/';
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: backMock,
    push: pushMock,
    replace: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => pathnameValue,
}));

function renderShell(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages.en} timeZone="America/New_York">
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  backMock.mockReset();
  pushMock.mockReset();
  pathnameValue = '/';
});

describe('shell/AppShell', () => {
  it('renders top bar title and highlights the active tab', () => {
    renderShell(
      <AppShell topBar={{ title: 'Hello' }} activeTab="home">
        <p data-testid="child">child</p>
      </AppShell>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('child');
    // Top bar title text is surfaced in the <h1>.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello');

    // Home tab has aria-current=page, community tab does not.
    const home = screen.getByTestId('tab-home');
    const community = screen.getByTestId('tab-community');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(community).not.toHaveAttribute('aria-current');
    expect(home.className).toContain('is-active');
    expect(community.className).not.toContain('is-active');
  });

  it('hides the tab bar when hideTabBar is true', () => {
    renderShell(
      <AppShell hideTabBar>
        <p>body</p>
      </AppShell>,
    );

    expect(screen.queryByTestId('tab-home')).toBeNull();
    expect(screen.queryByTestId('tab-community')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('omits the top bar when topBar prop is undefined', () => {
    renderShell(
      <AppShell activeTab="inbox">
        <p>body</p>
      </AppShell>,
    );
    // No h1 topbar title should exist.
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    // But the tab bar should still render.
    expect(screen.getByTestId('tab-inbox')).toBeInTheDocument();
  });
});

describe('shell/TopBar', () => {
  it('renders a back button with the localized aria-label when backHref is set', () => {
    // The W5 R3/L2 fix only calls `router.back()` when the user has a
    // real history stack to return to. jsdom starts with history.length
    // === 1, so stub it up to simulate an intra-app navigation where
    // popping state is safe (still on our origin).
    const originalLength = window.history.length;
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      get: () => 2,
    });
    try {
      renderShell(<TopBar title="Detail" backHref="/" />);
      // `messages.en.shellBackButton` is "Back".
      const backBtn = screen.getByRole('button', { name: 'Back' });
      expect(backBtn).toBeInTheDocument();
      backBtn.click();
      expect(backMock).toHaveBeenCalledTimes(1);
      expect(pushMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window.history, 'length', {
        configurable: true,
        get: () => originalLength,
      });
    }
  });

  it('renders the brand wordmark when variant=brand', () => {
    renderShell(<TopBar variant="brand" />);
    expect(screen.getByText('WeaveNYC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('renders eyebrow + title in the page variant', () => {
    renderShell(<TopBar eyebrow="Step 1" title="Welcome" />);
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome');
  });

  it('falls back to router.push(backHref) when the history stack is empty', () => {
    // Simulate a deep-link tab where `window.history.length` is 1 (the
    // current entry). `router.back()` in that case would navigate off the
    // origin; the W5 R3/L2 fix pushes `backHref` instead.
    const originalLength = window.history.length;
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      get: () => 1,
    });

    try {
      renderShell(<TopBar title="Verify" backHref="/me" />);
      const backBtn = screen.getByRole('button', { name: 'Back' });
      backBtn.click();
      expect(backMock).not.toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledTimes(1);
      expect(pushMock).toHaveBeenCalledWith('/me');
    } finally {
      Object.defineProperty(window.history, 'length', {
        configurable: true,
        get: () => originalLength,
      });
    }
  });
});

describe('shell/BottomTabBar', () => {
  it('derives the active tab from usePathname when activeTab is not passed', () => {
    pathnameValue = '/inbox';
    renderShell(<BottomTabBar />);
    const inbox = screen.getByTestId('tab-inbox');
    expect(inbox).toHaveAttribute('aria-current', 'page');
    expect(inbox.className).toContain('is-active');

    // Other tabs stay inactive.
    expect(screen.getByTestId('tab-home')).not.toHaveAttribute('aria-current');
  });

  it('prefix-matches nested routes to their parent tab', () => {
    pathnameValue = '/community/join';
    renderShell(<BottomTabBar />);
    expect(screen.getByTestId('tab-community')).toHaveAttribute('aria-current', 'page');
  });

  it('lets an explicit activeTab prop override the pathname', () => {
    pathnameValue = '/inbox';
    renderShell(<BottomTabBar activeTab="me" />);
    expect(screen.getByTestId('tab-me')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-inbox')).not.toHaveAttribute('aria-current');
  });

  it('renders all 5 tabs with localized labels and href targets', () => {
    renderShell(<BottomTabBar />);
    expect(screen.getByTestId('tab-home')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('tab-community')).toHaveAttribute('href', '/community');
    expect(screen.getByTestId('tab-post')).toHaveAttribute('href', '/post');
    expect(screen.getByTestId('tab-inbox')).toHaveAttribute('href', '/inbox');
    expect(screen.getByTestId('tab-me')).toHaveAttribute('href', '/me');

    // Labels are the `en` bundle strings.
    expect(screen.getByTestId('tab-home')).toHaveTextContent('Home');
    expect(screen.getByTestId('tab-community')).toHaveTextContent('Community');
    expect(screen.getByTestId('tab-post')).toHaveTextContent('Post');
    expect(screen.getByTestId('tab-inbox')).toHaveTextContent('Inbox');
    expect(screen.getByTestId('tab-me')).toHaveTextContent('Me');
  });

  it('leaves every tab inactive on an off-tab route', () => {
    pathnameValue = '/resource/abc-123';
    renderShell(<BottomTabBar />);
    for (const key of ['home', 'community', 'post', 'inbox', 'me']) {
      expect(screen.getByTestId(`tab-${key}`)).not.toHaveAttribute('aria-current');
    }
  });

  // Wave 6A: the active-pill is a `<motion.span layoutId="tab-active">`
  // rendered only inside the active tab. Exactly one pill exists at any
  // time — that's Framer's cue to animate layout between tabs on a route
  // change. The pill carries `.tabbar__active-pill` so a style regression
  // (accidentally restoring the `.is-active { background }` rule) would be
  // caught by the double-paint assertion below.
  it('renders exactly one animated active-pill inside the active tab', () => {
    pathnameValue = '/community';
    const { container } = renderShell(<BottomTabBar />);
    const pills = container.querySelectorAll('.tabbar__active-pill');
    expect(pills.length).toBe(1);
    const pill = pills[0]!;
    // The pill must live inside the community tab, not inside a sibling.
    const communityTab = screen.getByTestId('tab-community');
    expect(communityTab.contains(pill)).toBe(true);
    // And must NOT live inside any other tab.
    for (const key of ['home', 'post', 'inbox', 'me']) {
      expect(screen.getByTestId(`tab-${key}`).querySelector('.tabbar__active-pill')).toBeNull();
    }
  });

  it('removes the active-pill entirely when no tab is active', () => {
    // /resource routes keep the tab bar visible but dim every tab, so no
    // pill should render (otherwise it would float over the previously
    // active tab).
    pathnameValue = '/resource/abc-123';
    const { container } = renderShell(<BottomTabBar />);
    expect(container.querySelectorAll('.tabbar__active-pill').length).toBe(0);
  });
});
