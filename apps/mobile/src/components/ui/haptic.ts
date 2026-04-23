/**
 * Haptic helpers — thin wrappers over `expo-haptics`.
 * ===================================================
 *
 * Two public helpers:
 *
 *   - `triggerLightHaptic()` — fires a Light impact, but gates on
 *     `AccessibilityInfo.isReduceMotionEnabled()` so users who have
 *     reduce-motion enabled at the OS level never feel a buzz. Used by
 *     `Button` and `Card`.
 *   - `triggerHaptic(ms?)` — PWA-parity duration mapping. The PWA's
 *     `triggerHaptic(ms)` takes a vibration duration (Web Vibration API
 *     contract). Native doesn't expose a duration knob, so the number is
 *     mapped to the closest `UIImpactFeedbackStyle`:
 *
 *       <= 20ms → Selection (subtle tick — default for Pill toggles)
 *       <= 40ms → Light impact
 *       <= 80ms → Medium impact
 *          else → Heavy impact
 *
 *     Used by `Banner`, `Checkbox`, `IconButton`, `Pill`, `Radio`, `Tag`.
 *
 * Errors (no haptic engine, simulator, user disabled in settings) are
 * silently swallowed — haptic failures must never surface as UI errors.
 * Callers must not await these functions; the reduce-motion check is
 * async, but skipping `Promise.await` keeps press handlers synchronous
 * (haptic is purely an enhancement; a 2-frame delay on a tap would be
 * worse than a missed buzz).
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

/**
 * PWA-parity haptic wrapper. Maps a vibration duration (ms) to the
 * closest `UIImpactFeedbackStyle`. See module docblock for the mapping
 * table. Fire-and-forget: never awaited, never throws.
 */
export function triggerHaptic(durationMs = 10): void {
  try {
    if (durationMs <= 20) {
      void Haptics.selectionAsync();
      return;
    }
    if (durationMs <= 40) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (durationMs <= 80) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // No-op. See docblock — haptic failures must never break the UI.
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
