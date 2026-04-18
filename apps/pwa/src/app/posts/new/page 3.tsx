import { Suspense } from 'react';

import { PostComposerScreen } from '@/components/post-composer-screen';

export default function PostComposerPage() {
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
      <PostComposerScreen />
    </Suspense>
  );
}
