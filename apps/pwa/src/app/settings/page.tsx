import { Suspense } from 'react';

import { SettingsScreen } from '@/components/settings-screen';

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="shell__inner">
            <section className="card">
              <p>Loading settings…</p>
            </section>
          </div>
        </main>
      }
    >
      <SettingsScreen />
    </Suspense>
  );
}
