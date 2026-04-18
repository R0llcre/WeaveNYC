'use client';

/**
 * Legacy `/settings` route — now a pure client-side redirect shim to
 * `/me/settings` (the canonical settings entry under the 5-tab IA).
 *
 * Query params are preserved on the redirect so deep links coming in
 * from older notifications or bookmarks keep working; `return_to` is
 * passed through `safeReturnTo` to block open-redirect attacks.
 *
 * Kept under its own Suspense boundary because `useSearchParams()`
 * must be wrapped in Suspense for static export (CSR bailout).
 */

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { safeReturnTo } from '@/lib/safe-return-to';

function SettingsRedirectInner() {
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
    router.replace(qs ? `/me/settings?${qs}` : '/me/settings');
  }, [router, search]);
  return null;
}

export default function SettingsRedirectPage() {
  return (
    <Suspense fallback={null}>
      <SettingsRedirectInner />
    </Suspense>
  );
}
