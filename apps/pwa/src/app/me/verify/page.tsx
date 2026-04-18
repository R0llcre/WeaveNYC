import { Suspense } from 'react';

import { VerifyScreen } from '@/components/verify-screen';
import { messages } from '@/lib/i18n';

/**
 * M8.5 W5C — `/me/verify` restyled for the AppShell IA.
 *
 * Route wiring:
 *   - W2B moved this screen from `/verify` to `/me/verify` so identity
 *     verification sits under the Me hub. The legacy `/verify` route is
 *     kept as a client-side redirect shim (see
 *     `apps/pwa/src/app/verify/page.tsx`).
 *   - AppShell (see `components/shell/AppShell.tsx`) owns `<main>`, the
 *     top-bar slot, and the bottom tab bar. The VerifyScreen client
 *     component renders its own `<TopBar backHref="/me">` + page-content
 *     wrapper inside the AppShell's main; it deliberately does NOT
 *     render its own `<main>` or `.shell` chrome.
 *
 * The Suspense fallback renders bare page-content (no second `<main>`)
 * so the brief pre-hydration flash doesn't produce nested landmarks.
 */
export default function MeVerifyPage() {
  // Default to English for the static shell fallback; the VerifyScreen
  // client component re-renders with the user's selected language after
  // hydration.
  const copy = messages.en;

  return (
    <Suspense
      fallback={
        <div className="page-content">
          <section className="card">
            <p>{copy.verifyTitle}…</p>
          </section>
        </div>
      }
    >
      <VerifyScreen />
    </Suspense>
  );
}
