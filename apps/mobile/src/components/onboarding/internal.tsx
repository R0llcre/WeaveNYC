/**
 * Onboarding shared primitives — internal to the `/onboarding/*` stack.
 *
 * These live next to the route files (not under `src/components`) because
 * they are specifically the onboarding flow's internal layout helpers —
 * no other screen needs them. Leaving them here keeps the public UI
 * barrel narrow (no `OnboardingPressableRow` leakage into
 * `@/components/ui`) and the mobile atom vocabulary focused on
 * cross-screen reusable primitives.
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  type AccessibilityRole,
  type AccessibilityState,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export interface OnboardingPressableRowProps {
  children: ReactNode;
  onPress: () => void;
  testID?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLabel?: string;
}

/**
 * Full-width pressable wrapper. Provides a subtle pressed-state opacity
 * shift so the row animates under finger without needing a variant prop
 * on `Card`. The inner child (usually a `<Card>`) owns the visual
 * surface — this component only contributes the touch + accessibility
 * semantics.
 */
export function OnboardingPressableRow({
  children,
  onPress,
  testID,
  accessibilityRole = 'button',
  accessibilityState,
  accessibilityLabel,
}: OnboardingPressableRowProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({
        pressed,
      }: PressableStateCallbackType): StyleProp<ViewStyle> => ({
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
