import { Suspense } from 'react';

import { PostDetailScreen } from '@/components/post-detail-screen';

type PostDetailPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

// Dynamic post IDs are resolved client-side; we emit a single placeholder
// shell at build time so `output: 'export'` succeeds. Real URLs are served
// via Cloudflare Pages SPA fallback (see `apps/pwa/public/_redirects`).
export function generateStaticParams() {
  return [
    { postId: 'placeholder' },
    { postId: '88888888-8888-4888-8888-888888888888' },
    { postId: '90000000-0000-4000-8000-000000000001' },
    { postId: '90000000-0000-4000-8000-000000000002' },
    { postId: '90000000-0000-4000-8000-000000000003' },
  ];
}

export const dynamicParams = false;

export default async function PostDetailPage({ params }: PostDetailPageProps) {
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
      <PostDetailScreen postId={resolvedParams.postId} />
    </Suspense>
  );
}
