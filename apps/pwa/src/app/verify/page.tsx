import { Suspense } from 'react';

import { VerifyScreen } from '@/components/verify-screen';
import { messages } from '@/lib/i18n';

export default function VerifyPage() {
  // Default to English for the static shell fallback; the VerifyScreen
  // client component re-renders with the user's selected language after
  // hydration.
  const copy = messages.en;

  return (
    <Suspense
      fallback={
        <main className="shell">
          <div className="shell__inner">
            <section className="card">
              <p>{copy.verifyTitle}…</p>
            </section>
          </div>
        </main>
      }
    >
      <VerifyScreen />
    </Suspense>
  );
}
