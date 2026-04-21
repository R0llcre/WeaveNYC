import { Suspense } from 'react';

import { TrustOnboardingScreen } from '@/components/trust-onboarding-screen';
import { RouteLoadingFallback } from '@/components/ui';

/**
 * V1-B Task 5 — anchor-model onboarding explainer.
 *
 * Wired into the onboarding funnel between `/onboarding/language` and
 * `/onboarding/location`. The differentiator the rest of the app is
 * architected around — neighbor vouching, verified anchors — is never
 * explained on the current onboarding path, so a first-time user has no
 * way to understand why they're being asked to trust the app with
 * location data. Three icon + 8-word bullets put the promise up front.
 *
 * The page itself is a thin Suspense wrapper around the client screen so
 * the onboarding takeover layout (`apps/pwa/src/app/onboarding/layout.tsx`)
 * continues to own the chrome-free presentation.
 */
export default function TrustOnboardingPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback shellMode="shell" />}>
      <TrustOnboardingScreen />
    </Suspense>
  );
}
