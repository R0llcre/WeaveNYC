/**
 * `/verify` route — root entry for the OTP + magic-link verify flow.
 *
 * Used when the app opens a verify URL directly (universal link tap) or
 * any screen navigates to `/verify` without the Me-hub context. After a
 * successful verify, we `router.replace('/')` to land on the home wizard
 * so the verified user lands on a usable tab rather than a sibling-to-home
 * auth screen.
 *
 * The Me-hub variant (`app/me/verify.tsx`) wraps the same screen with a
 * back button that returns to `/me`; this route hides that chevron.
 */

import { useRouter } from 'expo-router';

import { VerifyScreen } from '@/components/VerifyScreen';

export default function VerifyRoute() {
  const router = useRouter();

  return (
    <VerifyScreen
      onVerified={() => {
        // 800ms delay kept on the PWA side is handled in the VerifyScreen
        // via the success toast; router.replace fires immediately so the
        // RN navigation stack cleans up the verify screen behind the
        // toast transition.
        router.replace('/');
      }}
    />
  );
}
