import { Suspense } from 'react';

import { PostComposerScreen } from '@/components/post-composer-screen';

export default function PostComposerPage() {
  return (
    <Suspense
      fallback={
        <div className="page-content">
          <section className="card">
            <p>Loading…</p>
          </section>
        </div>
      }
    >
      <PostComposerScreen />
    </Suspense>
  );
}
