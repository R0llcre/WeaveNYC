import { Suspense } from 'react';

import { PostComposerScreen } from '@/components/post-composer-screen';

export default function PostComposerPage() {
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
      <PostComposerScreen />
    </Suspense>
  );
}
