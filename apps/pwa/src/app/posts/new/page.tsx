import { Suspense } from 'react';

import { PostComposerScreen } from '@/components/post-composer-screen';
import { RouteLoadingFallback } from '@/components/ui';

export default function PostComposerPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <PostComposerScreen />
    </Suspense>
  );
}
