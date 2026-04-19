'use client';

/**
 * Client-side route guards for the W2 PWA redesign.
 *
 * Why client-side: `next.config.ts` sets `output: 'export'`, which emits a
 * static bundle with no middleware and no server actions. Every redirect
 * must therefore run in the browser, after Redux has hydrated from
 * IndexedDB. The guard hooks below are designed to be called from page
 * components (or a top-level layout client island) — they are no-ops until
 * `preferences.hydrationComplete` flips true, which prevents the classic
 * "flash of redirect" when a returning user opens a deep link.
 *
 * Scope:
 *   - `useOnboardingGuard`  — first-time visitors to a guarded page are
 *     pushed to `/onboarding/language` or `/onboarding/location`, with a
 *     `return_to` query param capturing the original URL so we can land
 *     them back after the flow completes.
 *   - `useOnboardingDestination` — helper used by the two onboarding
 *     screens to compute the post-submit landing URL. Wraps `safeReturnTo`
 *     so attacker-controlled `?return_to=https://evil` is rejected.
 *   - `useVerifiedGuard` — stub for future verified-only routes
 *     (`/me/danger`). Reads `selectIsVerified`; redirects unverified
 *     sessions to `/me/verify/?return_to=<current>`. Kept intentionally
 *     minimal for W2 so the verify screen owns its own UX in W4.
 */

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useAppSelector } from '@/lib/hooks';
import { safeReturnTo } from '@/lib/safe-return-to';
import { selectIsVerified, selectPreferences } from '@/lib/selectors';

/**
 * Build an absolute same-origin path + query suitable for use as a
 * `return_to` query value. The value is URL-encoded here so callers can
 * drop it directly into a template string without double-encoding.
 */
function buildReturnToParam(pathname: string, search: URLSearchParams): string {
  const query = search.toString();
  const absolute = query ? `${pathname}?${query}` : pathname;
  return encodeURIComponent(absolute);
}

/**
 * Redirect first-time visitors into the onboarding funnel.
 *
 * Call from page components (or the root layout client island) that should
 * enforce onboarding completion. Safe to call from every page — the hook
 * no-ops on `/onboarding/*` routes and until Redux has hydrated from
 * IndexedDB, so it won't create a redirect loop.
 *
 * Behaviour:
 *   - `!hydrationComplete`        → wait (no redirect)
 *   - pathname starts with `/onboarding/` → no redirect (user is already in the flow)
 *   - pathname starts with `/me/verify`   → no redirect (magic-link token burn)
 *   - `onboardingComplete === true`        → no redirect
 *   - missing language            → `/onboarding/language?return_to=<here>`
 *   - has language, no zip        → `/onboarding/location?return_to=<here>`
 */
export function useOnboardingGuard(): void {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const preferences = useAppSelector(selectPreferences);

  const { hydrationComplete, onboardingComplete, hasUserChosenLanguage } = preferences;

  useEffect(() => {
    if (!hydrationComplete) {
      return;
    }

    // Onboarding routes enforce themselves; skipping them here prevents a
    // redirect loop when the user is already at /onboarding/language etc.
    if (pathname.startsWith('/onboarding')) {
      return;
    }

    // Magic-link verify URLs (`/me/verify?challenge_id=…&token=…`) consume a
    // single-use token the moment the VerifyScreen hits the API. Bouncing an
    // un-onboarded user into `/onboarding/language` before the screen gets a
    // chance to run burns the token and strands the user with an expired
    // link. Skip the guard here; `/me/verify` owns its own pre-auth UX and
    // the onboarding flow will re-engage on any subsequent navigation.
    if (pathname.startsWith('/me/verify')) {
      return;
    }

    // Legacy `/verify` redirect shim forwards to `/me/verify` (app/verify/page.tsx).
    // Skip the onboarding guard so the shim's useEffect fires and query params
    // (`challenge_id`, `token`, sanitized `return_to`) propagate instead of the
    // user landing on onboarding with an orphaned magic link.
    if (pathname === '/verify') {
      return;
    }

    if (onboardingComplete) {
      return;
    }

    // If the user hasn't explicitly picked a language yet, send them to
    // step 1. Note: `preferences.language` defaults to 'en' from the
    // initial state / browser detection, so it's NOT a reliable "has
    // picked" signal — `hasUserChosenLanguage` is the authoritative flag
    // flipped by `setLanguage` on the picker screen.
    const nextStep = !hasUserChosenLanguage
      ? '/onboarding/language/'
      : '/onboarding/location/';

    const returnTo = buildReturnToParam(pathname, search);
    router.replace(`${nextStep}?return_to=${returnTo}`);
  }, [
    hydrationComplete,
    onboardingComplete,
    hasUserChosenLanguage,
    pathname,
    search,
    router,
  ]);
}

/**
 * Read + sanitise the `return_to` query param for an onboarding step.
 *
 * Returns the validated same-origin path to navigate to once the step
 * completes. When no `return_to` is present, or when the value fails the
 * `safeReturnTo` whitelist, falls back to `/`.
 *
 * Designed to be used inside `LanguagePickerScreen` and `LocationGateScreen`.
 * The screens continue to own "what do I do on submit" — this hook only
 * centralises "where do I go next".
 */
export function useOnboardingDestination(fallback: string = '/'): string {
  const search = useSearchParams();
  return safeReturnTo(search.get('return_to'), fallback);
}

/**
 * Guard for routes that require a verified session (`/me/danger` etc.).
 *
 * W2D scope is intentionally narrow: the verify screen itself (`/me/verify`)
 * owns the full OTP/magic-link UX in W4. This hook exists so callers can
 * wire the guard today, without the verify screen having to know which
 * page originally triggered the redirect.
 *
 * Behaviour:
 *   - verified session       → no-op
 *   - unverified / anonymous → replace with
 *     `/me/verify/?return_to=<current path + search>`
 */
export function useVerifiedGuard(): void {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const preferences = useAppSelector(selectPreferences);
  const isVerified = useAppSelector(selectIsVerified);

  const { hydrationComplete } = preferences;

  useEffect(() => {
    if (!hydrationComplete) {
      return;
    }

    // Don't loop on the verify screen itself.
    if (pathname.startsWith('/me/verify')) {
      return;
    }

    if (isVerified) {
      return;
    }

    const returnTo = buildReturnToParam(pathname, search);
    router.replace(`/me/verify/?return_to=${returnTo}`);
  }, [hydrationComplete, isVerified, pathname, search, router]);
}
