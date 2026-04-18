'use client';

/**
 * M8.5 W2B — onboarding takeover layout.
 *
 * Pages under `/onboarding/**` (language picker, location gate) render
 * full-bleed without the persistent AppShell / bottom tab bar that a
 * sibling agent will add to the root `layout.tsx`. This intermediate
 * layout intercepts the layout chain so the shell is bypassed while
 * keeping Providers (Redux, Query, intl) from the root layout.
 *
 * Keep this file intentionally lightweight: any heavier onboarding chrome
 * belongs inside the individual page components so the takeover remains
 * a thin wrapper.
 */
import type { ReactNode } from 'react';

type OnboardingLayoutProps = {
  children: ReactNode;
};

export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return <div className="onboarding-layout">{children}</div>;
}
