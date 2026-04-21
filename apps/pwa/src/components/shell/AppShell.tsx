'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { BottomTabBar, type TabKey } from './BottomTabBar';
import { PageTransition } from './PageTransition';
import { TopBar, type TopBarProps } from './TopBar';

/**
 * AppShell — persistent wrapper for every non-onboarding page.
 *
 * Composition:
 *   - optional <TopBar>          (sticky header; omit for fullscreen flows)
 *   - <main id="main-content">   (skip-link target, flexes to fill)
 *   - optional <BottomTabBar>    (5-tab nav; hide for onboarding/modal)
 *
 * Static-export compatible: all interactive behavior (useRouter, usePathname)
 * lives in the child client components. AppShell itself is a lightweight
 * layout wrapper so it mounts once per session and does not remount on
 * tab changes — that's what makes routing feel like an app instead of a
 * page refresh.
 */
export type AppShellProps = {
  children: ReactNode;
  /** Which tab is current. `undefined` means no highlight (e.g. detail routes). */
  activeTab?: TabKey;
  /** Top bar configuration. `undefined` = no top bar (fullscreen/immersive). */
  topBar?: TopBarProps;
  /** Hide the bottom tab bar for onboarding or modal flows. */
  hideTabBar?: boolean;
  className?: string;
};

export function AppShell({
  children,
  activeTab,
  topBar,
  hideTabBar,
  className,
}: AppShellProps) {
  const t = useTranslations();
  const classes = ['shell', className].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      {topBar ? <TopBar {...topBar} /> : null}
      <main
        id="main-content"
        className={[
          'shell__content',
          hideTabBar ? 'shell__content--no-tabbar' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/*
         * Wave 6A: wrap `<main>` children in a pathname-keyed motion wrapper
         * so route changes fade + slide rather than snap. The onboarding
         * takeover flow bypasses AppShell entirely (via ShellFrame), so this
         * only affects in-app 5-tab navigation — matching the spec that
         * onboarding stays chrome-free. See PageTransition.tsx for motion
         * specs and reduced-motion handling.
         */}
        <PageTransition>{children}</PageTransition>
        {/*
         * V1-B Task 4 — persistent "How we protect you" footer link.
         * Visible on every shell-backed screen so trust framing is never
         * more than one tap away. Routes to a static placeholder
         * (`/privacy/`) owned by the PWA; fuller copy lands in M9.
         *
         * Sits below the motion wrapper so the fade doesn't flicker the
         * footer on tab changes (PageTransition animates its own
         * children only). Anchored at the bottom of main content, above
         * the BottomTabBar.
         */}
        <footer className="shell__footer" aria-label={t('shellFooterLabel')}>
          <a
            href="/privacy/"
            className="shell__footer-link"
            data-testid="shell-privacy-link"
          >
            {t('shellFooterPrivacy')}
          </a>
        </footer>
      </main>
      {!hideTabBar ? <BottomTabBar activeTab={activeTab} /> : null}
    </div>
  );
}
