'use client';

/**
 * M8.5 W5A — Onboarding · Language takeover screen.
 *
 * Design goals (see docs/30_PWA_Redesign_Plan.md §4 Wave 5A):
 *   - Full-bleed takeover (no AppShell / tab bar / top bar). The parent
 *     `apps/pwa/src/app/onboarding/layout.tsx` already short-circuits the
 *     global shell; this component owns the hero + card layout.
 *   - One decision per screen: pick a UI language. Three big cards, each
 *     labelled IN ITS OWN TARGET LANGUAGE (English / Español / 中文) so the
 *     user recognises the script they'll see after tapping — a well-known
 *     pattern used by most multilingual onboarding flows.
 *   - The title + subtitle + micro-descriptions ARE translated via
 *     `useTranslations()` so the screen renders in whichever UI language
 *     was previously detected (or 'en' on first paint). Only the three
 *     language button labels stay in their native script.
 *
 * State / contract preserved for callers:
 *   - Route path `/onboarding/language` is unchanged.
 *   - `data-testid` values `onboarding-language-en|es|zh` survive — E2E
 *     specs in tests/e2e (`resource-smoke`, `settings`, `community-posts`,
 *     `multi-community`) depend on them.
 *   - On select: dispatches `setLanguage` (which also flips
 *     `hasUserChosenLanguage` so the onboarding guard advances to
 *     step 2), then `router.replace(destination)` where destination is
 *     the validated `useOnboardingDestination('/onboarding/location')`
 *     value. `safeReturnTo` behaviour is delegated to that hook, so an
 *     attacker-controlled `?return_to=https://evil.com` still falls back
 *     to the safe same-origin default.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Card, Inline, Stack } from '@/components/ui';
import { illustrations } from '@/assets/illustrations';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useOnboardingDestination } from '@/lib/route-guard';
import { selectPreferencesLanguage } from '@/lib/selectors';
import { setLanguage } from '@/lib/slices/preferences-slice';
import type { SupportedLanguage } from '@/lib/types';
import { useHaptic } from '@/lib/use-haptic';

/**
 * Each option carries:
 *   - `value`: the Redux language code that `setLanguage` dispatches.
 *   - `nativeLabel`: rendered verbatim on the button. Intentionally NOT
 *     run through `useTranslations` because the whole point of a language
 *     picker is that each label appears in the language it represents.
 *   - `descriptionKey`: the i18n key for the micro description under the
 *     native label ("Continue in English" etc.). This string IS translated
 *     into the CURRENT UI language so a Spanish-speaking user reading the
 *     picker in Spanish sees "Continuar en inglés" under the English card.
 */
type LanguageOption = {
  value: SupportedLanguage;
  nativeLabel: string;
  descriptionKey:
    | 'onboardingLanguageContinueEn'
    | 'onboardingLanguageContinueEs'
    | 'onboardingLanguageContinueZh';
};

const LANGUAGE_OPTIONS: ReadonlyArray<LanguageOption> = [
  { value: 'en', nativeLabel: 'English', descriptionKey: 'onboardingLanguageContinueEn' },
  { value: 'es', nativeLabel: 'Español', descriptionKey: 'onboardingLanguageContinueEs' },
  { value: 'zh', nativeLabel: '中文', descriptionKey: 'onboardingLanguageContinueZh' },
];

export function LanguagePickerScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const currentLanguage = useAppSelector(selectPreferencesLanguage);
  // `useOnboardingDestination` wraps `safeReturnTo` so an attacker-controlled
  // `?return_to=https://evil.com` still resolves to the same-origin fallback.
  const destination = useOnboardingDestination('/onboarding/location');
  // Wave 6C — language selection is the user's very first tap in the app.
  // A subtle buzz turns the moment from "I clicked some HTML" into "the
  // app acknowledged me".
  const haptic = useHaptic();

  // F10: per-route document.title; retained from the previous implementation
  // so the tab label updates even though onboarding skips the AppShell.
  useEffect(() => {
    document.title = `${t('pageTitleOnboardingLanguage')} \u2014 WeaveNYC`;
  }, [t]);

  const handleSelect = (language: SupportedLanguage) => {
    haptic(10);
    dispatch(setLanguage(language));
    // Use `replace` rather than `push` so the language picker does not stack
    // in browser history — users landing on step 2 shouldn't be able to
    // back-swipe into an orphaned picker after the choice is persisted.
    router.replace(destination);
  };

  return (
    <main
      className="onboarding onboarding--lang"
      id="main-content"
      tabIndex={-1}
    >
      {/* weave-pattern SVG as a subtle background — purely decorative, so it
          sits behind the content and is marked aria-hidden. The tile repeats
          at 48x48 and fades the ink to 25% opacity inside the SVG itself. */}
      <div
        className="onboarding__pattern"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: illustrations['weave-hero'] }}
      />

      <Stack gap={6} as="section" className="onboarding__content page-content">
        <header className="onboarding__header">
          <Stack gap={2}>
            <span className="onboarding__eyebrow overline">{t('onboardingStepLanguage')}</span>
            <h1 className="onboarding__title">{t('obLangTitle')}</h1>
            <p className="onboarding__subtitle">{t('obLangSubtitle')}</p>
          </Stack>
        </header>

        <ul className="onboarding__options">
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = currentLanguage === option.value;
            return (
              <li key={option.value} className="onboarding__option">
                <Card
                  as="div"
                  variant="raised"
                  className={`lang-card${isActive ? ' lang-card--active' : ''}`}
                >
                  <button
                    type="button"
                    data-testid={`onboarding-language-${option.value}`}
                    aria-pressed={isActive}
                    aria-describedby={`lang-${option.value}-desc`}
                    className="lang-card__button"
                    onClick={() => handleSelect(option.value)}
                  >
                    <Inline gap={4} align="center" justify="between">
                      <Stack gap={1}>
                        <span
                          className="lang-card__label"
                          lang={option.value}
                        >
                          {option.nativeLabel}
                        </span>
                        <span
                          id={`lang-${option.value}-desc`}
                          className="lang-card__desc"
                        >
                          {t(option.descriptionKey)}
                        </span>
                      </Stack>
                      <span aria-hidden="true" className="lang-card__chevron">
                        {'\u2192'}
                      </span>
                    </Inline>
                  </button>
                </Card>
              </li>
            );
          })}
        </ul>

        <p className="onboarding__footnote">{t('settingsLanguageHint')}</p>
      </Stack>
    </main>
  );
}
