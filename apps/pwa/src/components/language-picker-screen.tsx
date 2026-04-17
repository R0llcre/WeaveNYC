'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Button, Card, PageHeader } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { safeReturnTo } from '@/lib/safe-return-to';
import { selectPreferences } from '@/lib/selectors';
import { setLanguage } from '@/lib/slices/preferences-slice';
import type { SupportedLanguage } from '@/lib/types';

type LanguageOption = {
  value: SupportedLanguage;
  translationKey:
    | 'onboardingLanguageContinueEn'
    | 'onboardingLanguageContinueEs'
    | 'onboardingLanguageContinueZh';
};

const languageOptions: LanguageOption[] = [
  { value: 'en', translationKey: 'onboardingLanguageContinueEn' },
  { value: 'es', translationKey: 'onboardingLanguageContinueEs' },
  { value: 'zh', translationKey: 'onboardingLanguageContinueZh' },
];

export function LanguagePickerScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const preferences = useAppSelector(selectPreferences);

  // `return_to` is attacker-controlled. Validate it against a same-origin
  // whitelist so `?return_to=https://evil.com` can't bounce the user off
  // the origin after onboarding.
  const returnTo = safeReturnTo(params.get('return_to'), '/onboarding/location');

  const handleSelect = (language: SupportedLanguage) => {
    dispatch(setLanguage(language));
    router.push(returnTo);
  };

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleOnboardingLanguage')} \u2014 WeaveNYC`;
  }, [t]);

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          className="hero--home"
          eyebrow={t('onboardingStepLanguage')}
          title={t('onboardingLanguageTitle')}
          subtitle={t('onboardingLanguageHint')}
        />

        <Card aria-labelledby="language-picker-heading">
          <h2 id="language-picker-heading">{t('settingsLanguageTitle')}</h2>
          <div className="language-row language-row--stacked">
            {languageOptions.map((option) => (
              <Button
                key={option.value}
                data-testid={`onboarding-language-${option.value}`}
                variant={preferences.language === option.value ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => handleSelect(option.value)}
              >
                {t(option.translationKey)}
              </Button>
            ))}
          </div>
          <p className="muted">{t('settingsLanguageHint')}</p>
        </Card>

        <Card>
          <p className="muted">
            {t('onboardingLanguageAlreadyDone')}{' '}
            <Link href="/">{t('backHome')}</Link>
            {' · '}
            <Link href="/settings">{t('onboardingGoToSettings')}</Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
