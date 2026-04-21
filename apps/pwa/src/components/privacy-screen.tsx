'use client';

/**
 * V1-B Task 4 — `/privacy/` placeholder.
 *
 * Intentionally single-paragraph. Three commitments named plainly:
 *   - no legal name / SSN / immigration status collection
 *   - location stays on device unless the user searches
 *   - 30-day delete undo window
 *
 * Routed to by the shell footer link (every screen) and the anchor-model
 * trust step's "Tell me more" CTA. The anchor trust bullets on Home and
 * in the onboarding trust step keep the user-facing trust copy short; this
 * page is the "read more" anchor — fuller policy docs follow in M9.
 */

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { Stack } from '@/components/ui';
import { TopBar } from '@/components/shell';

export function PrivacyScreen() {
  const t = useTranslations();

  useEffect(() => {
    document.title = `${t('pageTitlePrivacy')} \u2014 WeaveNYC`;
  }, [t]);

  return (
    <>
      <TopBar
        variant="page"
        eyebrow={t('privacyEyebrow')}
        title={t('privacyTitle')}
        backHref="/"
      />
      <div className="page-content">
        <Stack gap={4} as="section">
          <p className="privacy__lede">{t('privacyLede')}</p>
        </Stack>
      </div>
    </>
  );
}
