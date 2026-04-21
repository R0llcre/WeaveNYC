'use client';

import { useEffect } from 'react';

import { createAnonymousSession, refreshSession } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';

/**
 * useSessionBootstrap — ensure a usable access_token is loaded whenever a
 * screen that hits a Bearer-token-protected endpoint is mounted.
 *
 * Three-path bootstrap:
 *
 *   1. Session already has `access_token` → no-op.
 *   2. Session has a `refresh_token` but no `access_token` — this happens
 *      when we rehydrated from IndexedDB on startup. Per A1 P1-6 the
 *      access_token is memory-only so persistence strips it; we exchange
 *      the stored refresh_token for a fresh access_token via
 *      POST /v1/auth/refresh. The refresh token itself rotates on this
 *      call, so replay detection is preserved.
 *   3. No session at all → mint a fresh anonymous one.
 *
 * G1 live-testing originally found that visiting /community/join or
 * /verify without a prior home-screen visit left the auth slice empty so
 * the first button click hit a protected endpoint with no Authorization
 * header and the gateway returned 401/400. The screens all have
 * `disabled={!session?.access_token}` guards, but without a mechanism to
 * actually create/refresh the session those guards never release.
 *
 * Fire-and-forget: does not block rendering. Errors are silently
 * swallowed because every caller already surfaces its own error states.
 */
export function useSessionBootstrap() {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  useEffect(() => {
    if (session?.access_token) {
      return;
    }

    let cancelled = false;
    const persistedRefresh = session?.refresh_token;

    const promise = persistedRefresh
      ? refreshSession(persistedRefresh)
      : createAnonymousSession();

    void promise
      .then((result) => {
        if (!cancelled) {
          dispatch(setSession(result));
        }
      })
      .catch(() => {
        // If a persisted refresh token is no longer valid (revoked,
        // rotated out, expired), fall back to creating a fresh
        // anonymous session so the UI is never permanently stuck on
        // "Getting ready…". This mirrors how a logged-out user looks
        // after manual sign-out.
        if (cancelled) return;
        if (!persistedRefresh) return;
        void createAnonymousSession()
          .then((result) => {
            if (!cancelled) {
              dispatch(setSession(result));
            }
          })
          .catch(() => {
            // handled by the caller's own error states
          });
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, session?.access_token, session?.refresh_token]);
}
