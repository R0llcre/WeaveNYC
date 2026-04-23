/**
 * triggerHaptic — Light-impact haptic helper for atom presses.
 * =============================================================
 *
 * Narrow wrapper around `expo-haptics`' `impactAsync(Light)`. The PWA's
 * `triggerHaptic(ms)` takes a duration (Web Vibration API's contract); on
 * native there is no duration knob — iOS maps to a `UIImpactFeedbackStyle`
 * and Android fires a fixed vibration pattern. We commit to a single
 * intensity (Light) for atom-level feedback because:
 *
 *   - Medium/Heavy impacts are reserved for state transitions owned by
 *     bigger surfaces (modals, success toasts), not per-tap CTAs.
 *   - Running the full PWA duration→impact mapping table on native
 *     introduces a decision every consumer would re-litigate; one tone
 *     per atom is cheaper to remember.
 *
 * Reduce-motion skip
 * ------------------
 * `AccessibilityInfo.isReduceMotionEnabled()` is the RN signal for the
 * OS-level "reduce motion" toggle. We fire-and-forget the haptic only
 * when that returns `false`. Callers must not await this function — the
 * reduce-motion check is async, but skipping the Promise.await keeps the
 * press handler synchronous (haptic is purely an enhancement; a 2-frame
 * delay on a tap would be worse than a missed buzz).
 *
 * Errors (no haptic engine, simulator, user disabled in settings) are
 * silently swallowed — haptic failures must never surface as UI errors.
 */

import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';

/**
 * Fire a Light impact haptic unless the user has reduce-motion enabled.
 * Fire-and-forget: never awaited, never throws.
 */
export function triggerLightHaptic(): void {
  // Read the reduce-motion flag async; if enabled, short-circuit. On any
  // error (older Android, feature unsupported, or a test shim that's
  // missing `AccessibilityInfo` entirely) treat as "not enabled" and
  // proceed — better to buzz when unsure than to silently drop feedback.
  //
  // The outer `try` defends against the case where `AccessibilityInfo`
  // itself is missing (e.g. a minimal jest RN stub). Under Node tests
  // the whole call becomes a silent no-op.
  try {
    const probe = AccessibilityInfo?.isReduceMotionEnabled?.();
    if (!probe || typeof probe.then !== 'function') {
      fireImpact();
      return;
    }
    probe
      .then((reduce) => {
        if (!reduce) fireImpact();
      })
      .catch(() => {
        // Even the reduce-motion lookup itself can reject on some shims.
        // Fall back to firing the haptic — better to over-buzz than skip.
        fireImpact();
      });
  } catch {
    // `AccessibilityInfo` is undefined, or reading it threw. Treat as
    // no-op — haptic is an enhancement, never a correctness requirement.
  }
}

function fireImpact(): void {
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // No haptic engine (simulator, stripped-down Android, Node test).
    // Swallow — haptic failures must never surface as UI errors.
  }
}
