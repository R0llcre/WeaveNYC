/**
 * Onboarding stack layout — S6.
 *
 * Full-screen takeover during the first-run funnel. The tab bar is
 * intentionally absent: the user has exactly one decision per step
 * (language → trust → location) and a visible bottom nav would imply
 * branching options that don't exist yet. The stack headers are
 * disabled for the same reason — each screen draws its own top bar
 * (a ZIP title / eyebrow + an optional back-arrow) so the layout stays
 * the only chrome between the user and the copy.
 *
 * Back-nav policy:
 *   - Language (step 1) has no back button. There's nothing meaningful
 *     behind it on a first-run funnel — tapping back would either exit
 *     the app (iOS) or land on the OS launcher (Android).
 *   - Trust (step 1.5) and Location (step 2) render their own back
 *     affordance via the screen body, not through this layout. That
 *     keeps the back glyph consistent with the hero typography and lets
 *     each screen localize the label via `useTranslation('onboarding')`.
 */

import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        // Hide the navigation header — each screen owns its chrome so
        // back-nav, eyebrow, and title live in the same typographic
        // system as the rest of the onboarding copy.
        headerShown: false,
        // Disable gesture-based back-swipe on iOS. A user who swipes
        // forward from language → trust and then back-swipes would
        // land on a pre-picked language card; we rely on the explicit
        // "Change language" button on location.tsx for that trip
        // instead.
        gestureEnabled: false,
      }}
    />
  );
}
