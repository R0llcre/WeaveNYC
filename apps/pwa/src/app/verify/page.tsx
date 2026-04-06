import { headers } from 'next/headers';
import { Suspense } from 'react';

import { VerifyScreen } from '@/components/verify-screen';
import { coerceSupportedLanguage, messages } from '@/lib/i18n';

export default async function VerifyPage() {
  const requestHeaders = await headers();
  const initialLanguage = coerceSupportedLanguage(requestHeaders.get('accept-language'));
  const copy = messages[initialLanguage];

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
