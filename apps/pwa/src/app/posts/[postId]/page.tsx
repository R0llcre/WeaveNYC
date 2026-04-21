import { Suspense } from 'react';

import { PostDetailScreen } from '@/components/post-detail-screen';
import { RouteLoadingFallback } from '@/components/ui';

type PostDetailPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

// Dynamic post IDs are resolved client-side; we emit a single placeholder
// shell at build time so `output: 'export'` succeeds. Real URLs are served
// via Cloudflare Pages SPA fallback (see `apps/pwa/public/_redirects`).
export function generateStaticParams() {
  return [{ postId: 'placeholder' }];
}

export const dynamicParams = false;

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <PostDetailScreen postId={resolvedParams.postId} />
    </Suspense>
  );
}
