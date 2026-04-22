'use client';

/**
 * V2-D — Home gate. Renders `<HomeWizard />` when the user has not yet
 * picked a crisis-first intent (`preferences.lastIntent === null`), and
 * the pre-filtered `<ResourceHome />` (the directory view) once an intent
 * is set. The gate deliberately lives in the route-level page component
 * so that both screens share the same `/` URL; a dedicated `/wizard`
 * route would create a two-URL home experience and a back-button trap
 * (the browser would back out to the directory → wizard cycle).
 *
 * Hydration note: the onboarding route guard upstream already ensures
 * the user has finished the funnel before reaching `/`, so showing the
 * wizard during hydration is both harmless and better than a blank
 * screen — the directory re-renders on the very next paint if the
 * stored intent is non-null.
 */

import { HomeWizard } from '@/components/home-wizard';
import { ResourceHome } from '@/components/resource-home';
import { useAppSelector } from '@/lib/hooks';
import { selectPreferences } from '@/lib/selectors';

export default function HomePage() {
  const preferences = useAppSelector(selectPreferences);

  if (preferences.lastIntent === null) {
    return <HomeWizard />;
  }

  return <ResourceHome />;
}
