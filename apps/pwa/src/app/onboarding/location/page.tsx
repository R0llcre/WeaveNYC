import { Suspense } from 'react';

import { LocationGateScreen } from '@/components/location-gate-screen';

export default function LocationOnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="shell" id="main-content" tabIndex={-1}>
          <div className="shell__inner">
            <section className="card">
              <p>Loading…</p>
            </section>
          </div>
        </main>
      }
    >
      <LocationGateScreen />
    </Suspense>
  );
}
