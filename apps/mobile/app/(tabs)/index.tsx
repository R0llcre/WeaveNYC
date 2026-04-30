/**
 * Home tab — routes between the crisis-first wizard and the pre-filtered
 * resource directory.
 *
 * Logic:
 *   - `preferences.lastIntent === null` → render `<HomeWizard />`.
 *   - `preferences.lastIntent !== null` → render `<ResourceDirectory />`,
 *     pre-filtered to the intent the user picked.
 *
 * This mirrors the PWA split: the wizard dispatches `setLastIntent` on
 * tap, which causes this component to re-render the directory variant
 * without any router nav. The "Change what I'm looking for" button
 * inside the directory dispatches `clearLastIntent` which flips the
 * other way — so the wizard ↔ directory toggle is fully driven by the
 * preferences slice.
 *
 * The home namespace is loaded lazily (see `src/i18n/index.ts`) because
 * only the home tab needs those strings; we trigger the load on mount
 * so the Stack / Tag / Pill / Button labels are resolved before the
 * first render against the directory. The wizard already falls back to
 * key names while loading, which is fine for the brief < 1-frame gap.
 */

import { useEffect } from 'react';

import { useAppSelector } from '@/lib/hooks';
import { selectPreferences } from '@/lib/selectors';
import { loadNamespace } from '@/i18n';

import { HomeWizard } from '@/components/home/HomeWizard';
import { ResourceDirectory } from '@/components/home/ResourceDirectory';

export default function HomeTab() {
  const preferences = useAppSelector(selectPreferences);

  // Eager-load the `home` + `errors` bundles on the first mount of this
  // tab. `loadNamespace` is a no-op on subsequent calls (it tracks its
  // own loaded set), so the cost is a one-shot promise per cold boot.
  useEffect(() => {
    void loadNamespace('home');
  }, []);

  if (preferences.lastIntent === null) {
    return <HomeWizard />;
  }

  return <ResourceDirectory />;
}
