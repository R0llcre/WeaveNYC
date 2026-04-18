import { Suspense } from 'react';

import { SettingsScreen } from '@/components/settings-screen';

/**
 * M8.5 W2B — `/me/settings` moved from `/settings` as part of the 5-tab IA.
 * The legacy `/settings` route is kept as a client-side redirect for
 * backwards compatibility (see apps/pwa/src/app/settings/page.tsx).
 */
export default function MeSettingsPage() {
  return (
    <Suspense
      fallback={
        // AppShell (via ShellFrame) owns the <main id="main-content"> landmark;
        // Suspense fallback only provides inner page-content to avoid duplicate
        // main elements during hydration.
        <div className="page-content">
          <section className="card" aria-label="Loading">
            <p>Loading settings…</p>
          </section>
        </div>
      }
    >
      <SettingsScreen />
    </Suspense>
  );
}
