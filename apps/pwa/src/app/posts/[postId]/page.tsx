import { PostDetailScreen } from '@/components/post-detail-screen';

type PostDetailPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const resolvedParams = await params;
  return <PostDetailScreen postId={resolvedParams.postId} />;
}
