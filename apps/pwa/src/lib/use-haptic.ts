'use client';

/**
 * Wave 6C — subtle haptic feedback utility.
 *
 * `triggerHaptic` fires a very short Vibration API buzz on a user gesture.
 * Works on Android Chrome / Firefox and on iOS Safari 18+ (behind a user
 * activation gesture). Older iOS and desktop browsers silently no-op so the
 * caller never has to feature-detect.
 *
 * Contract
 * --------
 * 1. Only fire when the Vibration API exists. `'vibrate' in navigator` is
 *    true on Android and recent iOS; undefined on desktop Safari/Firefox.
 * 2. Respect `prefers-reduced-motion: reduce` — the whole point of that OS
 *    toggle is "no vestibular or tactile surprises", which haptics violate.
 * 3. Wrap the call in try/catch. iOS has historically thrown
 *    `NotAllowedError` when called without a user gesture; we swallow so a
 *    mis-wired caller can't crash the render tree.
 * 4. SSR-safe: a quick `typeof window` guard keeps the module import-safe
 *    from Next.js static export boundaries. `'use client'` already pins
 *    this to the browser bundle, but the guard makes the function cheap to
 *    call inside shared utility paths that may be evaluated during tests
 *    running under the node environment.
 *
 * The hook form `useHaptic()` is a trivial alias so screens can keep the
 * `const haptic = useHaptic()` idiom even though the underlying function
 * has no state of its own.
 */
export function triggerHaptic(pattern: number | number[] = 10): void {
  if (typeof window === 'undefined') return;
  if (typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;
  // Respect OS motion preference. matchMedia exists in both jsdom and real
  // browsers; guard anyway for the rare vitest run that stubs it out.
  if (typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }
    } catch {
      // Some older browsers throw on invalid media queries; fall through
      // and still attempt the vibrate — reduced-motion is opt-in so a
      // false negative here is acceptable.
    }
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // iOS Safari can throw `NotAllowedError` if we're outside a user
    // gesture (e.g. an automated unit-test click without a trusted event).
    // Swallow so pressing a button never breaks the page.
  }
}

/** Convenience hook — returns the function directly. */
export function useHaptic() {
  return triggerHaptic;
}
