'use client';

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * BottomTabBar — persistent 5-tab navigation.
 *
 * Design decisions:
 *
 *  - Icons are inlined here (not added to the W1C icon registry) because tab
 *    nav glyphs are not reused elsewhere in the product. Keeping them local
 *    avoids bloating the category icon vocabulary.
 *
 *  - All 5 glyphs are hand-drawn 24×24 / stroke 1.75 / currentColor so they
 *    inherit tint from the active/inactive CSS state and read consistently
 *    at small sizes on mid-tier Android.
 *
 *  - `aria-current="page"` is set on the active <Link> so VoiceOver announces
 *    "Home, current page" rather than just "Home link". Inactive tabs omit
 *    the attribute entirely (not `"false"`, per ARIA best practice).
 *
 *  - Active tab is derived from `usePathname()` by default but can be
 *    overridden by the `activeTab` prop — useful for nested routes that
 *    want to stay lit on a specific parent tab (e.g. `/resource/123`
 *    keeping Home highlighted).
 *
 *  - `data-testid="tab-{key}"` is load-bearing for E2E. Do not rename.
 */
export type TabKey = 'home' | 'community' | 'post' | 'inbox' | 'me';

type TabConfig = {
  key: TabKey;
  href: string;
  labelKey: 'shellTabHome' | 'shellTabCommunity' | 'shellTabPost' | 'shellTabInbox' | 'shellTabMe';
  icon: ReactNode;
};

/**
 * Shared SVG attributes — every glyph shares the same stroke grammar so the
 * row reads as a family. `strokeLinecap`/`strokeLinejoin` round out stroke
 * terminations so the icons don't look "chiseled" at 24px.
 */
const svgProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
} as const;

const HomeIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M4 10l8-6 8 6v10a2 2 0 0 1-2 2h-4v-6h-4v6H6a2 2 0 0 1-2-2V10z" />
  </svg>
);

const CommunityIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="10" r="2.5" />
    <path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
    <path d="M15 19c0-2 2-4 4-4s3 2 3 4" />
  </svg>
);

const PostIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

const InboxIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <path d="M4 7l8 6 8-6" />
    <path d="M4 7v10h16V7" />
  </svg>
);

const MeIcon = () => (
  <svg {...svgProps} aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const TABS: readonly TabConfig[] = [
  { key: 'home', href: '/', labelKey: 'shellTabHome', icon: <HomeIcon /> },
  { key: 'community', href: '/community', labelKey: 'shellTabCommunity', icon: <CommunityIcon /> },
  { key: 'post', href: '/post', labelKey: 'shellTabPost', icon: <PostIcon /> },
  { key: 'inbox', href: '/inbox', labelKey: 'shellTabInbox', icon: <InboxIcon /> },
  { key: 'me', href: '/me', labelKey: 'shellTabMe', icon: <MeIcon /> },
];

/**
 * Infer the active tab from the current pathname. Nested routes prefix-match
 * to their parent tab (e.g. `/post/mine` → 'post'). Routes that don't map
 * to any tab (e.g. `/resource/123`, `/onboarding/*`) return undefined, which
 * leaves every tab in its inactive state.
 */
export function deriveActiveTab(pathname: string | null): TabKey | undefined {
  if (!pathname) return undefined;
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/community')) return 'community';
  if (pathname.startsWith('/post')) return 'post';
  if (pathname.startsWith('/inbox')) return 'inbox';
  if (pathname.startsWith('/me')) return 'me';
  return undefined;
}

type BottomTabBarProps = {
  activeTab?: TabKey;
};

export function BottomTabBar({ activeTab }: BottomTabBarProps) {
  const pathname = usePathname();
  const t = useTranslations();
  const derived = deriveActiveTab(pathname);
  const active = activeTab ?? derived;
  const shouldReduce = useReducedMotion();

  // Wave 6D (a11y): pages can render their own secondary <nav> (join /
  // composer step progress). Giving the primary tab bar an accessible name
  // via `aria-label` lets screen readers distinguish the two navigation
  // landmarks instead of announcing "navigation, navigation". The label
  // derives from the same `shellTabbarLabel` i18n key so the experience
  // localises cleanly into ES/ZH.
  //
  // Wave 6A: the "is-active" background pill is rendered as a shared
  // `<motion.span layoutId="tab-active">` so that switching tabs slides the
  // pill from the old tab to the new one rather than teleporting. Only one
  // tab renders the element at any time, which is Framer Motion's cue to
  // animate layout between them. Under `prefers-reduced-motion`, the spring
  // collapses to a zero-duration transition — the pill still paints, but
  // the transition is instant.
  return (
    <nav className="tabbar shell-safe-bottom" aria-label={t('shellTabbarLabel')}>
      <LayoutGroup id="tabbar-active-pill">
        <ul className="tabbar__list">
          {TABS.map((tab) => {
            const isActive = active === tab.key;
            return (
              <li key={tab.key} className="tabbar__cell">
                <Link
                  href={tab.href}
                  className={['tabbar__item', isActive ? 'is-active' : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={`tab-${tab.key}`}
                >
                  {isActive ? (
                    <motion.span
                      layoutId="tab-active"
                      className="tabbar__active-pill"
                      aria-hidden="true"
                      transition={
                        shouldReduce
                          ? { duration: 0 }
                          : {
                              type: 'spring',
                              stiffness: 420,
                              damping: 34,
                              mass: 0.9,
                            }
                      }
                    />
                  ) : null}
                  <span className="tabbar__icon" aria-hidden="true">
                    {tab.icon}
                  </span>
                  <span className="tabbar__label">{t(tab.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
    </nav>
  );
}
