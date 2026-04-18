import { Suspense } from 'react';

import { MatchResultsScreen } from '@/components/match-results-screen';

type MatchResultsPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export function generateStaticParams() {
  return [
    { postId: 'placeholder' },
    { postId: '88888888-8888-4888-8888-888888888888' },
    { postId: '90000000-0000-4000-8000-000000000001' },
  ];
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
