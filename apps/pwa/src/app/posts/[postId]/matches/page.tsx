import { Suspense } from 'react';

import { MatchResultsScreen } from '@/components/match-results-screen';

type MatchResultsPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export function generateStaticParams() {
  return [{ postId: 'placeholder' }];
}

export const dynamicParams = false;

export default async function MatchResultsPage({ params }: MatchResultsPageProps) {
  const resolvedParams = await params;
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
      <MatchResultsScreen postId={resolvedParams.postId} />
    </Suspense>
  );
}
