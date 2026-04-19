'use client';

/**
 * M8.5 Wave 5B — Onboarding Location Gate.
 *
 * Full-screen takeover rendered under `/onboarding/location`. The route is
 * wrapped by `apps/pwa/src/app/onboarding/layout.tsx` which intentionally
 * bypasses the persistent AppShell / TopBar / BottomTabBar, so this component
 * is the only chrome the user sees during step 2/2 of the first-run flow.
 *
 * Design goals (§4 Wave 5B of `docs/30_PWA_Redesign_Plan.md`):
 *   1. Hero: distinctive title + subtitle, no in-line form noise.
 *   2. ZIP input path with inline validation + privacy hint.
 *   3. "Use my device location" secondary affordance — kept honest: we do
 *      not yet run client-side reverse geocoding, so a successful
 *      `getCurrentPosition` surfaces an "unavailable" banner rather than a
 *      deceptive "ok" followed by a silent no-op (W3D UX regression the
 *      previous iteration shipped).
 *   4. Primary CTA validates + commits to Redux + navigates to the safe
 *      post-onboarding destination (see `useOnboardingDestination`).
 *   5. Skip path: marks onboarding complete without a ZIP and lands the
 *      user on `/me` where they can add ZIP via settings later. The guard
 *      in `useOnboardingGuard` is keyed on `onboardingComplete`, so
 *      flipping the flag is enough to unblock the rest of the app even if
 *      ZIP stays empty.
 *
 * testid preservation (§7 of the plan):
 *   - `onboarding-location-zip-input`    — ZIP text input (E2E dependency)
 *   - `onboarding-location-submit`       — primary Continue button (E2E dependency)
 *   - `onboarding-location-use-device`   — geolocation secondary button (E2E dependency)
 * Plus a new alias `confirm-location` on the primary CTA to match the
 * Wave 5B spec without breaking existing E2E callers.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { illustrations } from '@/assets/illustrations';
import { Banner, Button, Field, Icon, PageHeader, Stack } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { useOnboardingDestination } from '@/lib/route-guard';
import { selectPreferences } from '@/lib/selectors';
import { completeOnboarding, setZipCode } from '@/lib/slices/preferences-slice';

/**
 * DOM id for the pending banner. Referenced via `aria-describedby` on the
 * "Use my device location" button (W5 R2/M3) so screen readers announce the
 * "asking your device…" status string alongside the button itself while the
 * browser prompt is in flight.
 */
const PENDING_BANNER_ID = 'loc-pending-banner-id';

type LocationErrorKey =
  | 'onboardingLocationZipInvalid'
  | 'onboardingLocationDeviceBlocked'
  | 'onboardingLocationDeviceDenied';

/**
 * Geolocation state machine.
 *
 * - `idle`        — no device call in flight; nothing to announce.
 * - `pending`     — browser prompt is showing or coordinates are resolving.
 * - `error`       — permission denied or browser blocked; user must type a ZIP.
 * - `unavailable` — `navigator.geolocation` missing OR we resolved coords
 *                   but cannot reverse-geocode client-side. Either way the
 *                   ZIP input is the escape hatch.
 */
type GeoState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; messageKey: LocationErrorKey }
  | { kind: 'unavailable' };

export function LocationGateScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const preferences = useAppSelector(selectPreferences);

  const [localZip, setLocalZip] = useState(preferences.zipCode);
  const [zipErrorKey, setZipErrorKey] = useState<LocationErrorKey | null>(null);
  const [geoState, setGeoState] = useState<GeoState>({ kind: 'idle' });

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
    setGeoState({ kind: 'idle' });
    dispatch(setZipCode(localZip));
    dispatch(completeOnboarding());
    router.push(destination);
  };

  const handleUseLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState({ kind: 'unavailable' });
      return;
    }

    setGeoState({ kind: 'pending' });
    navigator.geolocation.getCurrentPosition(
      () => {
        // We don't run client-side reverse geocoding yet (no `/geocode/zip`
        // endpoint exists in the gateway — verified via grep). Surface an
        // "unavailable" banner and fall back to manual ZIP entry instead
        // of silently succeeding.
        setGeoState({ kind: 'unavailable' });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoState({
            kind: 'error',
            messageKey: 'onboardingLocationDeviceDenied',
          });
          return;
        }
        setGeoState({
          kind: 'error',
          messageKey: 'onboardingLocationDeviceBlocked',
        });
      },
      { maximumAge: 60_000, timeout: 8_000 },
    );
  };

  /**
   * Skip path — user declines to set a ZIP now. We still need to flip
   * `onboardingComplete` so the guard stops redirecting back here on every
   * navigation; `/me` is the landing target because settings lives there
   * under the Wave 2B routing refactor, giving the user one tap to add a
   * ZIP later.
   *
   * We deliberately do NOT use `useOnboardingDestination` here — the user
   * chose to skip the primary flow, so bouncing them back into a deep
   * link they never requested would be confusing.
   */
  const handleSkip = () => {
    dispatch(completeOnboarding());
    router.push('/me/');
  };

  // Pending banner gets a stable DOM id so the "use my device" button can
  // point at it via `aria-describedby` while the browser prompt resolves.
  const pendingBanner =
    geoState.kind === 'pending' ? (
      <div id={PENDING_BANNER_ID}>
        <Banner tone="info" title={t('onboardingLocationDevicePending')} />
      </div>
    ) : null;

  // W5 R2/M1: previously rendered `onboardingLocationZipLabel` as the body,
  // which read "ZIP code" under the denial title and was a non-sequitur.
  // `onboardingLocationRecoverHint` is the dedicated recovery copy shared
  // by both the error and unavailable banners below.
  const errorBanner =
    geoState.kind === 'error' ? (
      <Banner tone="warning" title={t(geoState.messageKey)}>
        {t('onboardingLocationRecoverHint')}
      </Banner>
    ) : null;

  const unavailableBanner =
    geoState.kind === 'unavailable' ? (
      // Device location did not resolve to a ZIP on the client. `warning`
      // (not `danger`) because the user can still recover by typing a ZIP;
      // not `info` because an affordance the user actively invoked failed.
      <Banner tone="warning" title={t('onboardingLocationDeviceBlocked')}>
        {t('onboardingLocationRecoverHint')}
      </Banner>
    ) : null;

  const isPending = geoState.kind === 'pending';

  return (
    // W5 R2/B1: the onboarding layout renders a plain `<div>` wrapper, so
    // this screen must own the only `<main>` on the page — matching the
    // language picker's `onboarding onboarding--lang` pattern (W5A). Using
    // `shell` here would collide with AppShell's main on routes that DO go
    // through AppShell and give us a stale hero--home treatment. The class
    // pair (`onboarding onboarding--location`) also gives the CSS file a
    // hook to scope per-step art changes without affecting the lang step.
    <main
      className="onboarding onboarding--location"
      id="main-content"
      tabIndex={-1}
    >
      {/* Subtle weave-pattern background, purely decorative. Same treatment
          as the language picker so the two onboarding steps share an
          atmospheric thread. aria-hidden because the pattern has no
          semantic content. */}
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

            {/* M2: privacy note is surfaced ONLY as the Field hint. The
                previous implementation duplicated it as a trailing
                <p class="muted"> below the form, which meant screen
                readers announced the same string twice — reported by
                R2 and dropped here. */}
            <Field
              label={t('obLocZipLabel')}
              error={zipErrorKey ? t(zipErrorKey) : undefined}
              hint={t('onboardingLocationPrivacyNote')}
            >
              <input
                data-testid="onboarding-location-zip-input"
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

            <Button
              data-testid="onboarding-location-use-device"
              variant="ghost"
              size="md"
              leadingIcon={<Icon name="transport" size="sm" />}
              onClick={handleUseLocation}
              // M3: `loading` both disables the button and sets
              // `aria-busy=true` via the Button atom's internal wiring,
              // so we don't need to pass aria-busy ourselves — which
              // would be overridden by the atom's own spread order
              // (see Button.tsx line ~161).
              loading={isPending}
              aria-describedby={isPending ? PENDING_BANNER_ID : undefined}
            >
              {t('obLocUseLocation')}
            </Button>

            {pendingBanner}
            {errorBanner}
            {unavailableBanner}

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
                // Wave 6C — confirm is a commitment step; a subtle buzz
                // gives the tap weight on mobile.
                haptic
              >
                {t('obLocCta')}
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={handleSkip}
                data-testid="onboarding-location-skip"
                // Wave 6C — skip is also a commitment (it finalises
                // onboarding), so it warrants the same tactile cue as
                // confirm.
                haptic
              >
                {t('obLocSkip')}
              </Button>
            </div>
          </Stack>
        </form>
      </Stack>
    </main>
  );
}
