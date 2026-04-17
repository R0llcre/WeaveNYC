import { Suspense } from 'react';

import { LanguagePickerScreen } from '@/components/language-picker-screen';

export default function LanguageOnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="shell__inner">
            <section className="card">
              <p>Loading…</p>
            </section>
          </div>
        </main>
      }
    >
      <LanguagePickerScreen />
    </Suspense>
  );
}
