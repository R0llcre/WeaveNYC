import { Suspense } from 'react';

import { CommunityJoinScreen } from '@/components/community-join-screen';
import { RouteLoadingFallback } from '@/components/ui';

// V2-C — CommunityJoinScreen now reads `?hint=<communityId>` to pre-seed
// the invite input when the user arrived from the Home activity ticker.
// `useSearchParams()` is a CSR bailout under static export, so the
// screen must sit inside a Suspense boundary here.
export default function CommunityJoinPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback shellMode="shell" />}>
      <CommunityJoinScreen />
    </Suspense>
  );
}
