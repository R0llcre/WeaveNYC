import { Suspense } from 'react';

import { LocationGateScreen } from '@/components/location-gate-screen';
import { RouteLoadingFallback } from '@/components/ui';


export default function LocationOnboardingPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback shellMode="shell" />}>
      <LocationGateScreen />
    </Suspense>
  );
}
