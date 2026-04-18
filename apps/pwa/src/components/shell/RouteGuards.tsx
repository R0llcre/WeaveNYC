'use client';

/**
 * RouteGuards — render-side-effect-only island for the app-wide client
 * route guards that W2D exposed.
 *
 * Why a component (not a bare hook call in the layout):
 *   - `useOnboardingGuard` reads `useSearchParams()` internally, which is a
 *     Next.js 16 client API that must sit under a `<Suspense>` boundary when
 *     the app is statically exported (`output: 'export'` in `next.config.ts`).
 *     Keeping the hook invocation in its own leaf component means we can
 *     wrap *just this island* in Suspense without forcing Suspense around
 *     the whole application tree.
 *   - Layouts in the App Router are Server Components by default. This file
 *     is `'use client'` so we can safely call the guard hook; the parent
 *     layout stays on the server boundary and owns metadata + the static
 *     shell.
 *
 * The component intentionally renders `null`; it is pure behaviour (redirect
 * first-time visitors into the onboarding funnel) and has no UI of its own.
 * It is safe to include on every route because `useOnboardingGuard` no-ops
 * on `/onboarding/*` and until Redux has hydrated from IndexedDB.
 */

import { useOnboardingGuard } from '@/lib/route-guard';

export function RouteGuards(): null {
  useOnboardingGuard();
  return null;
}
