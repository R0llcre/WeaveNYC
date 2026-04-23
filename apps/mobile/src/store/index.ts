/**
 * Redux store for mobile — re-export shim.
 *
 * SCOPE (M2): this module has been promoted from the M1 placeholder to a
 * thin re-export of the real store at `@/lib/store`, which composes the
 * four slices ported verbatim from the PWA (auth, community, postDraft,
 * preferences).
 *
 * Why keep the alias split? Chrome code (providers, `app/_layout.tsx`)
 * references `@/store`, while the ported lib code (hooks.ts,
 * selectors.ts, the session-bootstrap + sign-out hooks) references
 * `@/lib/store`. Re-exporting instead of duplicating keeps both paths
 * pointed at a single `configureStore` call — otherwise a mounted
 * `<Provider>` and a `useSelector` inside a lib hook would talk to two
 * different stores and every mutation dispatched via one would appear
 * invisible to the other.
 *
 * The M1 placeholder slice (`markReady`) is gone — the smoke test was
 * updated in lockstep to assert the four real slice keys instead. See
 * `__tests__/smoke.test.ts`.
 */

export { store } from '@/lib/store';
export type { RootState, AppDispatch } from '@/lib/store';
