import { Suspense } from 'react';

import { MatchResultsScreen } from '@/components/match-results-screen';
import { RouteLoadingFallback } from '@/components/ui';

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
    <Suspense fallback={<RouteLoadingFallback />}>
      <MatchResultsScreen postId={resolvedParams.postId} />
    </Suspense>
  );
}
