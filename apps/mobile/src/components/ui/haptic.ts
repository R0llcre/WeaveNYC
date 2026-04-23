/**
 * triggerHaptic — thin wrapper over `expo-haptics`' impact API.
 * =============================================================
 *
 * The PWA's `triggerHaptic(ms)` takes a vibration duration in milliseconds
 * (the Web Vibration API's native contract). Native platforms don't expose
 * a duration knob — iOS maps to `UIImpactFeedbackStyle` and Android
 * translates to a fixed-pattern vibration. We keep the *signature*
 * identical for cross-platform parity but map the numeric argument to the
 * closest impact style so atoms share a single import surface.
 *
 * Mapping (chosen to match the PWA's perceived intensity):
 *   <= 20ms → Selection (a11y "subtle tick" — the default for Pill toggles)
 *   <= 40ms → Light impact
 *   <= 80ms → Medium impact
 *      else → Heavy impact
 *
 * Errors are swallowed: on devices without a haptic engine (simulator,
 * older Android, user disabled in settings) the promise rejects, but we
 * never surface that to the UI because haptic is strictly an enhancement.
 */

import * as Haptics from 'expo-haptics';

export function triggerHaptic(durationMs = 10): void {
  // Fire-and-forget. Any runtime error (unsupported device, permission
  // denied on Android 12+) is non-fatal — haptic is an enhancement.
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
