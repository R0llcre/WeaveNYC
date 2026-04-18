'use client';

/**
 * Legacy `/verify` route — now a pure client-side redirect shim to
 * `/me/verify` (the canonical verification entry under the 5-tab IA).
 *
 * We preserve in-flight query params (e.g. magic-link `challenge_id`,
 * `token`, `return_to`) so already-shipped email links and OTP links
 * continue to resolve. The `return_to` param is passed through
 * `safeReturnTo` to block open-redirect attacks — unsafe values are
 * dropped rather than forwarded.
 *
 * Kept under its own Suspense boundary because `useSearchParams()`
 * must be wrapped in Suspense for static export (CSR bailout).
 *
 * E2E regression: tests/e2e/resource-smoke.spec.ts →
 *   "legacy /verify redirects to /me/verify with query params".
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { safeReturnTo } from '@/lib/safe-return-to';

function VerifyRedirectInner() {
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const params = new URLSearchParams(search.toString());
    const rawReturnTo = params.get('return_to');
    if (rawReturnTo) {
      const safe = safeReturnTo(rawReturnTo, '') || null;
      if (safe) {
        params.set('return_to', safe);
      } else {
        params.delete('return_to');
      }
    }
    const qs = params.toString();
    router.replace(qs ? `/me/verify?${qs}` : '/me/verify');
  }, [router, search]);
  return null;
}

export default function VerifyRedirectPage() {
  return (
    <Suspense fallback={null}>
      <VerifyRedirectInner />
    </Suspense>
  );
}
