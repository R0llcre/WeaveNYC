'use client';

import { useEffect } from 'react';

import { createAnonymousSession } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { selectSession } from '@/lib/selectors';
import { setSession } from '@/lib/slices/auth-slice';

/**
 * useSessionBootstrap — ensure an anonymous session exists whenever a screen
 * that hits a Bearer-token-protected endpoint is mounted.
 *
 * G1 live-testing found that visiting /community/join or /verify without a
 * prior home-screen visit left the auth slice empty, so the first button click
 * hit `/v1/community-access/resolve` / `/v1/auth/otp/start` with no
 * Authorization header and the gateway returned 401/400. The screens all have
 * `disabled={!session?.access_token}` guards, but without a mechanism to
 * actually create the session those guards never release.
 *
 * This hook is fire-and-forget: it does not block rendering. Callers render
 * their normal UI (typically with an inline "Getting ready…" banner while
 * `session` is still null) and the disabled-when-no-session buttons release
 * as soon as the bootstrap completes. Errors are silently swallowed because
 * every caller already surfaces its own error states (React-Query mutation
 * errors, the existing `anonymousSessionError` banner, etc.) and the hook
 * does not own the UI.
 */
export function useSessionBootstrap() {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  useEffect(() => {
    if (session?.access_token) {
      return;
    }

    let cancelled = false;
    void createAnonymousSession()
      .then((result) => {
        if (!cancelled) {
          dispatch(setSession(result));
        }
      })
      .catch(() => {
        // handled by the caller's own error states; do not crash the hook.
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, session?.access_token]);
}
