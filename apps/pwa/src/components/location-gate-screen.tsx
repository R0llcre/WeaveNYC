'use client';

/**
 * M8.5 Wave 5B — Onboarding Location Gate.
 *
 * Full-screen takeover rendered under `/onboarding/location`. The route is
 * wrapped by `apps/pwa/src/app/onboarding/layout.tsx` which intentionally
 * bypasses the persistent AppShell / TopBar / BottomTabBar, so this component
 * is the only chrome the user sees during step 2/2 of the first-run flow.
 *
 * V1-B Task 3 — the "Use my device location" button was removed. The
 * previous implementation surfaced a warning banner even after a successful
 * `getCurrentPosition` because no client-side reverse-geocoder existed,
 * which meant a user who granted permission, returned coords, and wanted
 * help was told "it didn't work". That was a lie. Until the gateway exposes
 * a `POST /v1/geocode/reverse` endpoint (tracked as a follow-up) we simply
 * hide the affordance — ZIP entry is the only honest path.
 *
 * V1-B Task 6 — the bare "Skip" button was removed. Previously tapping it
 * flipped `onboardingComplete=true` with no ZIP, then Home's empty state
 * said "set your ZIP" with a link back to Settings, stranding the user in
 * a loop. The replacement CTA seeds ZIP 11368 (Queens — Corona /
 * Elmhurst — the pilot anchor neighborhood) and lands the user on Home
 * with a one-liner explaining they can change ZIP later. Honest default,
 * no dead-end.
 *
 * testid preservation (§7 of the plan):
 *   - `onboarding-location-zip-input`    — ZIP text input (E2E dependency)
 *   - `onboarding-location-submit`       — primary Continue button (E2E dependency)
 *   - `onboarding-location-skip`         — repurposed as "use a sample
 *     neighborhood" CTA; the testid stays so existing E2E specs keep
 *     passing, but the dispatched ZIP is now 11368 and onboarding stays
 *     usable instead of empty-statey.
 * Plus a new alias `confirm-location` on the primary CTA to match the
 * Wave 5B spec without breaking existing E2E callers.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { illustrations } from '@/assets/illustrations';
import { Button, Field, PageHeader, Stack } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useOnboardingDestination } from '@/lib/route-guard';
import { selectPreferences } from '@/lib/selectors';
import { completeOnboarding, setZipCode } from '@/lib/slices/preferences-slice';

type LocationErrorKey = 'onboardingLocationZipInvalid';

/**
 * V1-B Task 6 — fallback ZIP when the user taps "Use a sample
 * neighborhood". 11368 covers Corona / Elmhurst in Queens, which is the
 * pilot anchor neighborhood with the densest resource coverage in the
 * directory. A user who doesn't know their ZIP immediately sees real,
 * populated results and the copy on-screen makes the provenance explicit
 * ("Not your area? Change ZIP anytime in your profile.").
 */
const SAMPLE_NEIGHBORHOOD_ZIP = '11368';

export function LocationGateScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const preferences = useAppSelector(selectPreferences);

  const [localZip, setLocalZip] = useState(preferences.zipCode);
  const [zipErrorKey, setZipErrorKey] = useState<LocationErrorKey | null>(null);

  // `useOnboardingDestination` already runs the attacker-controlled
  // `return_to` through `safeReturnTo`, falling back to '/' if the value
  // points off-origin or isn't a string. Centralising the whitelist here
  // keeps open-redirect logic in one place (see route-guard.ts).
  const destination = useOnboardingDestination('/');

  // F10 parity — per-route document.title so the browser tab reads the
  // right step label during the onboarding takeover.
  useEffect(() => {
    document.title = `${t('pageTitleOnboardingLocation')} \u2014 WeaveNYC`;
  }, [t]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{5}$/.test(localZip)) {
      setZipErrorKey('onboardingLocationZipInvalid');
      return;
    }
    setZipErrorKey(null);
    dispatch(setZipCode(localZip));
    dispatch(completeOnboarding());
    router.push(destination);
  };

  /**
   * V1-B Task 6 — "Use a sample neighborhood" path replaces the previous
   * silent-skip flow. We seed ZIP 11368 so Home immediately has real
   * results to render; the user is told on-screen (`obLocSampleHint`) that
   * they can swap ZIP later from their profile. Flipping
   * `onboardingComplete` here stops the guard from bouncing the user back
   * into the funnel on the next navigation.
   */
  const handleUseSample = () => {
    dispatch(setZipCode(SAMPLE_NEIGHBORHOOD_ZIP));
    dispatch(completeOnboarding());
    router.push(destination);
  };

  return (
    // W5 R2/B1: the onboarding layout renders a plain `<div>` wrapper, so
    // this screen must own the only `<main>` on the page — matching the
    // language picker's `onboarding onboarding--lang` pattern (W5A). Using
    // `shell` here would collide with AppShell's main on routes that DO go
    // through AppShell and give us a stale hero--home treatment.
    <main
      className="onboarding onboarding--location"
      id="main-content"
      tabIndex={-1}
    >
      <div
        className="onboarding__pattern"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: illustrations['weave-hero'] }}
      />

      <Stack gap={6} as="section" className="onboarding__content page-content">
        <PageHeader
          className="hero--home"
          eyebrow={t('onboardingStepLocation')}
          title={t('obLocTitle')}
          subtitle={t('obLocSubtitle')}
        />

        <form
          className="search-form"
          aria-labelledby="location-gate-heading"
          onSubmit={handleSubmit}
        >
          <Stack gap={4}>
            <h2 id="location-gate-heading" className="sr-only">
              {t('obLocZipLabel')}
            </h2>

            <Field
              label={t('obLocZipLabel')}
              error={zipErrorKey ? t(zipErrorKey) : undefined}
              hint={t('onboardingLocationPrivacyNote')}
            >
              <input
                data-testid="onboarding-location-zip-input"
                // V1-D: older Android browsers (Chrome 55- on Android 7) ignore
                // `inputMode` entirely and defer to the HTML `type` attribute.
                // `type="tel"` is the most compatible way to force a numeric
                // keypad for a 5-digit postal code — "number" would emit a
                // spinner and auto-strip leading zeros on iOS, which breaks
                // New England ZIPs. `inputMode="numeric"` is kept for modern
                // browsers that honor it; both attrs are mutually compatible.
                type="tel"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                onChange={(event) => {
                  setZipErrorKey(null);
                  setLocalZip(event.target.value.replace(/\D/g, '').slice(0, 5));
                }}
                placeholder={t('onboardingLocationZipPlaceholder')}
                value={localZip}
              />
            </Field>

            {/* V1-B Task 3 — the "Use my device location" button used to
                live here. It's been removed until the gateway exposes a
                real reverse-geocoder (see
                `services/resource-directory/src/lib/geocoding.ts` for the
                existing forward geocoder to mirror). The previous code
                path granted permission, got coordinates, and then told
                the user "we couldn't use your location" — a lie that
                eroded trust on the step that most needs it. Tracked as a
                separate follow-up so this PR ships clean. */}

            <div className="action-row">
              <Button
                // §7 testid protection: existing Playwright specs target
                // `onboarding-location-submit` (resource-smoke,
                // multi-community, settings, community-posts). Keep that
                // value and expose the Wave 5B design-spec selector
                // `confirm-location` via `id=` so either hook works.
                data-testid="onboarding-location-submit"
                id="confirm-location"
                type="submit"
                variant="primary"
                size="lg"
                haptic
              >
                {t('obLocCta')}
              </Button>
              {/* V1-B Task 6 — the bare "Skip" affordance was a
                  dead-end: it flipped onboardingComplete=true with no
                  ZIP, leaving Home stuck on the "set your ZIP" empty
                  state with a link back to Settings (a loop). Replaced
                  with a sample-neighborhood CTA that seeds 11368 and
                  surfaces `obLocSampleHint` so the provenance is
                  honest. We keep the `onboarding-location-skip` testid
                  to preserve existing E2E coverage of the escape
                  hatch. */}
              <Button
                variant="ghost"
                size="lg"
                onClick={handleUseSample}
                data-testid="onboarding-location-skip"
                haptic
              >
                {t('obLocUseSample')}
              </Button>
              <Button
                as="a"
                href="/onboarding/language/?explicit=1"
                variant="ghost"
                size="lg"
                data-testid="onboarding-location-back"
              >
                {t('obLocBack')}
              </Button>
            </div>
            <p className="muted onboarding__footnote">
              {t('obLocSampleHint')}
            </p>
          </Stack>
        </form>
      </Stack>
    </main>
  );
}
