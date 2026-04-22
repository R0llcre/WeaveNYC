'use client';

import { useCallback } from 'react';

import { logoutSession } from '@/lib/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { saveSession } from '@/lib/persistence';
import { selectSession } from '@/lib/selectors';
import { clearSession } from '@/lib/slices/auth-slice';

/**
 * useSignOut — returns an idempotent callback that revokes the caller's
 * session server-side and drops local state.
 *
 * Before A1 P1-7 this hook was local-only, which meant a stolen refresh
 * token stayed valid on the gateway for up to 7 days after the user hit
 * "Clear this device". The hook now:
 *
 *   1. Best-effort POSTs to /v1/auth/logout to revoke the refresh-token
 *      family on the gateway. `{ revoke_all_devices: false }` scopes to
 *      the caller's family; pass `true` to nuke every family for the
 *      user (used by the Settings "Clear all devices" action).
 *   2. Clears the Redux auth slice so chrome re-renders as a signed-out
 *      shell.
 *   3. Deletes the persisted IndexedDB session row so the bootstrap
 *      effect on the next tab open does not silently rehydrate the old
 *      refresh token.
 *
 * The POST is best-effort because users often sign out while offline
 * ("forgot to log out of the shared family tablet"). Local state MUST
 * clear even if the network call fails.
 *
 * Preferences (language, ZIP, bookmarks) are intentionally preserved —
 * the user is "signing out of the account", not "resetting the device".
 */
export function useSignOut() {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectSession);

  return useCallback(
    async (options: { revokeAllDevices?: boolean } = {}) => {
      const accessToken = session?.access_token;
      if (accessToken) {
        try {
          await logoutSession(accessToken, options);
        } catch {
          // Best-effort: offline, 4xx from stale token, etc.
          // Local state below is the source of truth for the next render.
        }
      }

      dispatch(clearSession());

      try {
        await saveSession(null);
      } catch {
        // persistence helpers already swallow internal errors.
      }
    },
    [dispatch, session?.access_token],
  );
}
