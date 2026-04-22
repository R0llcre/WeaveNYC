'use client';

/**
 * V1-B Task 5 — Trust-model onboarding explainer.
 *
 * Lives at `/onboarding/trust/` as step 1.5 of the funnel:
 *   /onboarding/language  →  /onboarding/trust  →  /onboarding/location
 *
 * Why a dedicated step: the three trust guarantees above are the
 * commitments most likely to drive (or kill) a first-time visitor's
 * confidence to continue. A first-time visitor opening the app has no way
 * to learn that:
 *   1. we never ask for legal ID / SSN / status
 *   2. results are proximity-local
 *   3. their data never leaves the device (V2-E: was "neighbors vouch for
 *      neighbors" — the anchor-model is real in the backend but the PWA
 *      shows zero anchor signal, so the claim wasn't backed by the UX).
 * without digging through later screens or leaving the app to read the
 * landing page. Three icon + 8-word bullets put the framing up front.
 *
 * Skip conditions:
 *   - If the user has already dismissed the Home trust banner (Task 4
 *     flag `preferences.trustBannerDismissed`), they've seen the same
 *     copy before — we forward to `/onboarding/location/` immediately so
 *     re-onboarding isn't a three-screen gauntlet.
 *
 * Routing:
 *   - Primary CTA `Got it — find help` advances to `/onboarding/location/`.
 *   - Secondary CTA `Tell me more` opens `/privacy/` in the same window
 *     (Task 4 page) — we deliberately don't open a new tab because PWAs
 *     installed on iOS Safari treat window.open as a browser takeover.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { illustrations } from '@/assets/illustrations';
import { Button, Stack } from '@/components/ui';
import { useAppSelector } from '@/lib/hooks';
import { useOnboardingDestination } from '@/lib/route-guard';
import { selectPreferences } from '@/lib/selectors';

type TrustBullet = {
  icon: string;
  titleKey: 'trustBullet1Title' | 'trustBullet2Title' | 'trustBullet3Title';
  testId: string;
};

/**
 * The three bullets are intentionally static — localisation happens via
 * `useTranslations`, and the icons are emoji (kept free of vendor-specific
 * glyph assumptions) because the PWA does not yet bundle a scalable icon
 * set for these concepts. Each bullet hits ≤8 words per the spec so the
 * user scans the commitment in one beat.
 */
// V2-E: icon for bullet 3 flipped from "handshake" (anchor / community
// vouching) to "mobile phone" since the new copy is about on-device data.
// The testid `trust-bullet-anchors` stays — it's a stable hook the
// onboarding.test.tsx checks by name, renaming it is churn without value.
const TRUST_BULLETS: ReadonlyArray<TrustBullet> = [
  { icon: '\u{1F6E1}', titleKey: 'trustBullet1Title', testId: 'trust-bullet-id' },
  { icon: '\u{1F4CD}', titleKey: 'trustBullet2Title', testId: 'trust-bullet-nearby' },
  { icon: '\u{1F4F1}', titleKey: 'trustBullet3Title', testId: 'trust-bullet-anchors' },
];

export function TrustOnboardingScreen() {
  const t = useTranslations();
  const router = useRouter();
  const preferences = useAppSelector(selectPreferences);
  // `useOnboardingDestination` sanitises any attacker-controlled
  // `?return_to=…` through `safeReturnTo`. The natural forward step is
  // the ZIP gate, but a deep-linked return_to wins (so a user who
  // originally hit `/resources/abc` still lands back there).
  const destination = useOnboardingDestination('/onboarding/location/');

  useEffect(() => {
    document.title = `${t('pageTitleOnboardingTrust')} \u2014 WeaveNYC`;
  }, [t]);

  // Skip the step for users who've already dismissed the trust banner on
  // Home (same copy, already acknowledged). Gated on `hydrationComplete`
  // so we don't fast-forward before Redux has read the persisted flag.
  useEffect(() => {
    if (!preferences.hydrationComplete) {
      return;
    }
    if (preferences.trustBannerDismissed) {
      router.replace(destination);
    }
  }, [destination, preferences.hydrationComplete, preferences.trustBannerDismissed, router]);

  const handleContinue = () => {
    router.replace(destination);
  };

  return (
    <main
      className="onboarding onboarding--trust"
      id="main-content"
      tabIndex={-1}
    >
      <div
        className="onboarding__pattern"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: illustrations['weave-hero'] }}
      />

      <Stack gap={6} as="section" className="onboarding__content page-content">
        <header className="onboarding__header">
          <Stack gap={2}>
            <span className="onboarding__eyebrow overline">
              {t('onboardingStepTrust')}
            </span>
            <h1 className="onboarding__title">{t('obTrustTitle')}</h1>
            <p className="onboarding__subtitle">{t('obTrustSubtitle')}</p>
          </Stack>
        </header>

        <ul className="onboarding__options onboarding__trust-list">
          {TRUST_BULLETS.map((bullet) => (
            <li
              key={bullet.testId}
              className="onboarding__trust-item"
              data-testid={bullet.testId}
            >
              <span className="onboarding__trust-icon" aria-hidden="true">
                {bullet.icon}
              </span>
              <span className="onboarding__trust-title">
                {t(bullet.titleKey)}
              </span>
            </li>
          ))}
        </ul>

        <div className="action-row">
          <Button
            data-testid="onboarding-trust-continue"
            type="button"
            variant="primary"
            size="lg"
            onClick={handleContinue}
            haptic
          >
            {t('obTrustCta')}
          </Button>
          <Button
            as="a"
            href="/privacy/"
            variant="ghost"
            size="lg"
            data-testid="onboarding-trust-learn-more"
          >
            {t('obTrustLearnMore')}
          </Button>
        </div>
      </Stack>
    </main>
  );
}
