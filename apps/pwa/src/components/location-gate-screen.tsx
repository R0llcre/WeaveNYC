'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Banner, Button, Card, Field, PageHeader } from '@/components/ui';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { safeReturnTo } from '@/lib/safe-return-to';
import { selectPreferences } from '@/lib/selectors';
import { completeOnboarding, setZipCode } from '@/lib/slices/preferences-slice';

type LocationErrorKey =
  | 'onboardingLocationZipInvalid'
  | 'onboardingLocationDeviceBlocked'
  | 'onboardingLocationDeviceDenied';

type GeoState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; messageKey: LocationErrorKey }
  | { kind: 'unavailable' };

export function LocationGateScreen() {
  const t = useTranslations();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const [localZip, setLocalZip] = useState(preferences.zipCode);
  const [zipErrorKey, setZipErrorKey] = useState<LocationErrorKey | null>(null);
  const [geoState, setGeoState] = useState<GeoState>({ kind: 'idle' });

  // F10: per-route document.title
  useEffect(() => {
    document.title = `${t('pageTitleOnboardingLocation')} \u2014 WeaveNYC`;
  }, [t]);

  // `return_to` is attacker-controlled. Validate it against a same-origin
  // whitelist so `?return_to=https://evil.com` can't bounce the user off
  // the origin after onboarding.
  const returnTo = safeReturnTo(params.get('return_to'), '/');

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
    router.push(returnTo);
  };

  const handleUseLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState({ kind: 'unavailable' });
      return;
    }

    setGeoState({ kind: 'pending' });
    navigator.geolocation.getCurrentPosition(
      () => {
        // We do not resolve coordinates -> ZIP on the client yet; surface a
        // clear "coming soon" hint via an info banner so users know the
        // feature is recognized but unavailable, and fall back to the ZIP
        // input. No deceptive success followed by an error (which was the
        // W3D-flagged UX bug in the previous iteration).
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

  return (
    <main className="shell" id="main-content" tabIndex={-1}>
      <div className="shell__inner">
        <PageHeader
          className="hero--home"
          eyebrow={t('onboardingStepLocation')}
          title={t('onboardingLocationTitle')}
          subtitle={t('onboardingLocationHint')}
        />

        <Card aria-labelledby="location-gate-heading">
          <h2 id="location-gate-heading">{t('onboardingLocationZipLabel')}</h2>
          <form className="search-form" onSubmit={handleSubmit}>
            <Field
              label={t('onboardingLocationZipLabel')}
              error={zipErrorKey ? t(zipErrorKey) : undefined}
              hint={t('onboardingLocationPrivacyNote')}
            >
              <input
                data-testid="onboarding-location-zip-input"
                inputMode="numeric"
                maxLength={5}
                onChange={(event) => {
                  setZipErrorKey(null);
                  setLocalZip(event.target.value.replace(/\D/g, '').slice(0, 5));
                }}
                placeholder={t('onboardingLocationZipPlaceholder')}
                value={localZip}
              />
            </Field>

            {geoState.kind === 'pending' ? (
              <Banner tone="info" title={t('onboardingLocationDevicePending')} />
            ) : null}

            {geoState.kind === 'error' ? (
              <Banner tone="warning" title={t(geoState.messageKey)} />
            ) : null}

            {geoState.kind === 'unavailable' ? (
              // "Device location is unavailable" is a recoverable state —
              // the user can still type a ZIP manually, so `warning` rather
              // than `danger`; but it is not neutral `info` either, because
              // the auto-locate affordance the user just tried to use did
              // not work.
              <Banner tone="warning" title={t('onboardingLocationDeviceBlocked')}>
                {t('onboardingLocationDevicePending')}
              </Banner>
            ) : null}

            <div className="action-row">
              <Button
                data-testid="onboarding-location-submit"
                type="submit"
                variant="primary"
                size="lg"
              >
                {t('onboardingLocationSubmit')}
              </Button>
              <Button
                data-testid="onboarding-location-use-device"
                variant="secondary"
                size="lg"
                onClick={handleUseLocation}
                disabled={geoState.kind === 'pending'}
              >
                {t('onboardingLocationUseDevice')}
              </Button>
            </div>
          </form>
          <p className="muted">
            {t('onboardingLocationPrivacyNote')}{' '}
            <Link href="/settings">{t('onboardingGoToSettings')}</Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
