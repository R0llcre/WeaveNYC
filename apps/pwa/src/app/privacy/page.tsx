import { Suspense } from 'react';

import { PrivacyScreen } from '@/components/privacy-screen';
import { RouteLoadingFallback } from '@/components/ui';

/**
 * V1-B Task 4 — `/privacy/` placeholder. The TopBar footer link
 * (`shell-privacy-link`) and the anchor-model onboarding step's "Tell me
 * more" CTA both route here. The copy is intentionally a short paragraph
 * that restates the trust commitments surfaced elsewhere (banner on Home,
 * bullets on `/onboarding/trust`); fuller docs follow in M9.
 */
export default function PrivacyPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <PrivacyScreen />
    </Suspense>
  );
}
