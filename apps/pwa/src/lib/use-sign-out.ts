'use client';

import { useCallback } from 'react';

import { useAppDispatch } from '@/lib/hooks';
import { saveSession } from '@/lib/persistence';
import { clearSession } from '@/lib/slices/auth-slice';

/**
 * useSignOut — returns an idempotent callback that drops the local session.
 *
 * Sign-out on WeaveNYC is intentionally local-only for the pilot: we do not
 * hit a revoke endpoint because the gateway still treats the anonymous
 * session as disposable. Two side effects are required so the next visit
 * really starts fresh:
 *
 *   1. Clear the in-memory Redux auth slice so chrome re-renders as a
 *      signed-out shell.
 *   2. Delete the persisted IndexedDB session row so the bootstrap effect
 *      on the next tab open does not silently rehydrate the old token.
 *
 * Preferences (language, ZIP, bookmarks) are intentionally preserved — the
 * user is "signing out of the account", not "resetting the device".
 *
 * Extracted so the Me hub and the legacy Settings screen can share one
 * implementation; keeping it as a hook means either surface can also
 * compose follow-up navigation (e.g. router.push('/')) on the caller side
 * without the hook owning next/navigation.
 */
export function useSignOut() {
  const dispatch = useAppDispatch();

  return useCallback(async () => {
    dispatch(clearSession());
    // Best-effort: persistence helpers already swallow internal errors, so
    // this promise never rejects in practice. We still await it so the
    // caller can chain navigation after the row is truly gone.
    try {
      await saveSession(null);
    } catch {
      // no-op: the Redux dispatch above is the source of truth for the
      // next render; persistence is a follow-up hardening step.
    }
  }, [dispatch]);
}
