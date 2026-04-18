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
        <div className="page-content">
          <section className="card">
            <p>Loading…</p>
          </section>
        </div>
      }
    >
      <MatchResultsScreen postId={resolvedParams.postId} />
    </Suspense>
  );
}
