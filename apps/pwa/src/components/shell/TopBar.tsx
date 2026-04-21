'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectPreferencesLanguage } from '@/lib/selectors';
import { setLanguage } from '@/lib/slices/preferences-slice';
import type { SupportedLanguage } from '@/lib/types';

import { IconButton } from '../ui/IconButton';

/**
 * V1-B Task 2 — 3-segment language pill rendered in the brand TopBar.
 *
 * First-paint anxiety: a monolingual user who loads the app on a friend's
 * EN-locale phone has no visible signal that the app speaks ZH/ES. The pill
 * sits in the top chrome on every `brand` variant screen (Home is the
 * primary entry point for a funnel visitor) and makes the switch a single
 * tap. Tapping a segment dispatches `setLanguage`, which flips
 * `hasUserChosenLanguage` to `true` — so the next onboarding visit respects
 * the explicit choice and the picker no longer auto-skips.
 *
 * Sized to stay unobtrusive next to the 朱砂 wordmark (see globals.css
 * `.topbar-lang` rules). 28-30px height, tiny caps glyphs, uses existing
 * `--color-*` tokens for consistency with other pills in the design system.
 */
const LANGUAGE_SEGMENTS: ReadonlyArray<{
  value: SupportedLanguage;
  label: string;
}> = [
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'zh', label: '\u4e2d' }, // 中
];

function TopBarLanguageSwitcher() {
  const dispatch = useAppDispatch();
  const t = useTranslations();
  const currentLanguage = useAppSelector(selectPreferencesLanguage);

  const handleSelect = (language: SupportedLanguage) => {
    if (language === currentLanguage) {
      return;
    }
    // `setLanguage` (not `applyDetectedLanguage`) flips
    // `hasUserChosenLanguage` so subsequent onboarding paths stop
    // auto-skipping the picker and trust the user's explicit choice.
    dispatch(setLanguage(language));
  };

  return (
    <div
      className="topbar-lang"
      role="group"
      aria-label={t('topbarLangSwitcherLabel')}
      data-testid="topbar-lang-switcher"
    >
      {LANGUAGE_SEGMENTS.map(({ value, label }) => {
        const isActive = currentLanguage === value;
        return (
          <button
            key={value}
            type="button"
            className={`topbar-lang__segment${isActive ? ' topbar-lang__segment--active' : ''}`}
            aria-pressed={isActive}
            aria-label={t(`topbarLangSwitch${value.toUpperCase()}` as
              | 'topbarLangSwitchEN'
              | 'topbarLangSwitchES'
              | 'topbarLangSwitchZH')}
            lang={value}
            data-testid={`topbar-lang-${value}`}
            onClick={() => handleSelect(value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

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
        <TopBarLanguageSwitcher />
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
