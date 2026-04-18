'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { IconButton } from '../ui/IconButton';

/**
 * TopBar — sticky application header. Two presentations:
 *
 *  - `variant="brand"`   WeaveNYC wordmark centered. Used only on the top-level
 *                        Home route where we want a recognizable brand beat.
 *
 *  - `variant="page"`    Eyebrow + title, optional back chevron, optional right
 *                        slot. This is the default since most routes are
 *                        content-first and the eyebrow acts as a locator
 *                        breadcrumb (e.g. "Community" above "Join").
 *
 * Back chevron uses `router.back()` (native browser history) when `backHref`
 * is present AND the user has a real history stack to return to. If the
 * route was entered directly (e.g. a magic-link email opened in a fresh
 * tab where `window.history.length <= 1`), calling `router.back()` would
 * pop the user out of the app entirely. In that case we fall back to
 * `router.push(backHref)` so the chevron stays useful as a deep-link
 * "up" affordance (W5 R3/L2). The icon button has a 44×44 tap target
 * (enforced by the IconButton atom) and a localized aria-label.
 */
export type TopBarVariant = 'brand' | 'page';

export type TopBarProps = {
  variant?: TopBarVariant;
  title?: string;
  eyebrow?: string;
  /** When set, renders a back chevron that calls `router.back()`. */
  backHref?: string;
  /** Right-aligned slot for page-level actions (e.g. filter, share). */
  rightSlot?: ReactNode;
};

export function TopBar({
  variant = 'page',
  title,
  eyebrow,
  backHref,
  rightSlot,
}: TopBarProps) {
  const router = useRouter();
  const t = useTranslations();

  if (variant === 'brand') {
    return (
      <header className="topbar topbar--brand shell-safe-top">
        <div className="topbar__brand">WeaveNYC</div>
      </header>
    );
  }

  // W5 R3/L2: deep-link-safe back handler. On a normal intra-app
  // navigation `window.history.length` is >= 2 so `router.back()` pops the
  // previous route. When a magic-link recipient opens `/me/verify?token=…`
  // in a brand-new tab, history.length is 1 and `router.back()` would
  // navigate off our origin. In that case we push the declared `backHref`
  // so the chevron still takes the user somewhere meaningful.
  //
  // `typeof window` guard preserves SSR/static-export safety — this
  // component is "use client" but the check keeps us resilient if the
  // handler ever fires during hydration with a stale tree.
  const handleBack = () => {
    if (
      typeof window !== 'undefined' &&
      window.history.length > 1
    ) {
      router.back();
      return;
    }
    if (backHref) {
      router.push(backHref);
    }
  };

  return (
    <header className="topbar topbar--page shell-safe-top">
      {backHref ? (
        <IconButton
          variant="ghost"
          size="sm"
          shape="circle"
          aria-label={t('shellBackButton')}
          onClick={handleBack}
          className="topbar__back"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </IconButton>
      ) : null}
      <div className="topbar__titles">
        {eyebrow ? <span className="overline topbar__eyebrow">{eyebrow}</span> : null}
        {title ? <h1 className="topbar__title">{title}</h1> : null}
      </div>
      {rightSlot ? <div className="topbar__right">{rightSlot}</div> : null}
    </header>
  );
}
