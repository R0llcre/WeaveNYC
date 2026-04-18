import { Suspense } from 'react';

import { LanguagePickerScreen } from '@/components/language-picker-screen';

export default function LanguageOnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="shell" id="main-content" tabIndex={-1}>
          <div className="page-content">
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
