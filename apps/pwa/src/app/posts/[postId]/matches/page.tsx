import { MatchResultsScreen } from '@/components/match-results-screen';

type MatchResultsPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function MatchResultsPage({ params }: MatchResultsPageProps) {
  const resolvedParams = await params;
  return <MatchResultsScreen postId={resolvedParams.postId} />;
}
