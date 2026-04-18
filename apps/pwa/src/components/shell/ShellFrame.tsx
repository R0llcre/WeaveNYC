'use client';

/**
 * ShellFrame — conditional AppShell wrapper used by the root layout.
 *
 * Problem we're solving: the App Router nests `layout.tsx` files. Onboarding
 * ships its own takeover layout at `app/onboarding/layout.tsx` that renders a
 * full-bleed `<div className="onboarding-layout">` without any tab bar. If
 * the root `layout.tsx` unconditionally wraps `children` in `<AppShell>`, the
 * onboarding pages end up *inside* the shell (tab bar + top bar visible),
 * which defeats the takeover.
 *
 * ShellFrame reads the current pathname on the client and:
 *   - returns children bare when the route starts with `/onboarding`, so
 *     `OnboardingLayout` owns the chrome end-to-end.
 *   - otherwise wraps children in `<AppShell>` so every other route gets the
 *     persistent 5-tab bottom navigation (Home / Community / Post / Inbox /
 *     Me). `AppShell` itself derives the active tab from `usePathname()`
 *     via `BottomTabBar`, which means nested detail routes (e.g. `/post/[id]`,
 *     `/resource/[id]`) show the tab bar with no tab highlighted — matching
 *     the W2 navigation spec.
 *
 * Top-bar configuration lives on the individual page components, not here.
 * The layout-level shell only provides the persistent bottom tab bar; pages
 * that want a page-specific header render their own `<TopBar>` inline at
 * the top of their content. This avoids having to thread per-route top-bar
 * config through layout context, at the cost of each page being responsible
 * for its own eyebrow/title/back affordance.
 *
 * Must live in its own client component so the host `layout.tsx` can stay a
 * Server Component (and keep its `metadata` + `viewport` exports intact).
 * `usePathname()` is a client hook and would force the entire layout onto
 * the client otherwise, pulling metadata exports with it.
 */

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from './AppShell';

/**
 * Any route whose pathname starts with this prefix bypasses the persistent
 * AppShell (no top bar, no bottom tab bar). The prefix includes the trailing
 * slash check so a future `/onboarding-complete` route would NOT be treated
 * as a takeover by accident.
 */
const ONBOARDING_PREFIX = '/onboarding';

/**
 * `true` when the current route is part of the onboarding takeover flow
 * and the root layout should render bare children.
 */
function isOnboardingRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === ONBOARDING_PREFIX || pathname.startsWith(`${ONBOARDING_PREFIX}/`);
}

export type ShellFrameProps = {
  children: ReactNode;
};

export function ShellFrame({ children }: ShellFrameProps) {
  const pathname = usePathname();

  if (isOnboardingRoute(pathname)) {
    return <>{children}</>;
  }

  // No `topBar` passed on purpose — pages own their own top-bar copy (see
  // module docstring). `activeTab` is omitted so `BottomTabBar` falls back
  // to `deriveActiveTab(pathname)`, which correctly lights the tab that
  // owns the current route (and stays dim on detail routes).
  return <AppShell>{children}</AppShell>;
}
