/**
 * `/me/verify` route — Me-hub entry for the OTP + magic-link flow.
 *
 * Same component as `app/verify.tsx` but renders the "back to Me" chevron
 * via the VerifyScreen's `onBack` prop, because the user reached this
 * screen by tapping a "Verify" affordance on their Me profile and should
 * be able to return without completing.
 *
 * On success we route to `/` (home wizard) rather than back to Me so the
 * post-verification landing matches the root entry — the Me profile
 * re-renders as soon as the session updates anyway.
 */

import { useRouter } from 'expo-router';

import { VerifyScreen } from '@/components/VerifyScreen';

export default function MeVerifyRoute() {
  const router = useRouter();

  return (
    <VerifyScreen
      onBack={() => router.back()}
      onVerified={() => {
        router.replace('/');
      }}
    />
  );
}
