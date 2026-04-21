import { Suspense } from 'react';

import { LanguagePickerScreen } from '@/components/language-picker-screen';
import { RouteLoadingFallback } from '@/components/ui';


export default function LanguageOnboardingPage() {
  return (
    <Suspense fallback={<RouteLoadingFallback shellMode="shell" />}>
      <LanguagePickerScreen />
    </Suspense>
  );
}
