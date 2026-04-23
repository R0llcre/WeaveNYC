/**
 * Banner — inline status / advisory surface.
 * ===========================================
 *
 * RN port of `apps/pwa/src/components/ui/Banner.tsx`. Renders a full-width
 * card that calls out a transient state (reconnecting, verified, failed
 * to load, etc). Copy is constrained to a required `title` plus optional
 * body text.
 *
 * Tone conventions (aligned across PWA + mobile so copy can move freely):
 *
 *   - `info`    — neutral guidance; non-blocking state ("Creating session...").
 *                  Renders `accessibilityRole="summary"` + polite live region
 *                  (RN's closest analogue to the PWA's `role="status"`).
 *   - `success` — positive confirmation ("Verified!").
 *                  Renders `accessibilityRole="summary"` + polite live region.
 *   - `warning` — user can recover ("Verification required").
 *                  Renders `accessibilityRole="alert"` + assertive live
 *                  region so AT announces immediately.
 *   - `danger`  — system-level error ("Network failure", 5xx responses).
 *                  Renders `accessibilityRole="alert"` + assertive live
 *                  region — same as warning, higher visual weight.
 *
 * Dismiss contract (F4-C fix #3 in the PWA, retained here):
 * ----------------------------------------------------------
 * A Banner that accepts `onDismiss` MUST also accept `dismissLabel` — the
 * localised string the screen reader reads for the dismiss button. The
 * discriminated-union prop typing below compile-time-errors any call site
 * that sets `onDismiss` without a label, which prevents English-hardcoded
 * a11y copy from slipping into the app. The runtime dismiss button wires
 * `accessibilityLabel={dismissLabel}`, so VoiceOver announces the correct
 * localised phrase instead of reading the visual "x" glyph.
 *
 * The PWA version composes the action area with a `<Button>`. On mobile we
 * could do the same, but Button isn't in this R2 scope — instead we inline
 * a small Pressable for the action + dismiss affordances. When Button +
 * Banner live in the same barrel in a later wave, the two can reunify.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme, type Theme } from '@/theme';

import { triggerHaptic } from './haptic';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

type BannerBaseProps = {
  /** Semantic tone. Drives surface, a11y role, and announcement urgency. */
  tone: BannerTone;
  /** Required heading. */
  title: string;
  /** Optional body copy underneath the title. */
  children?: ReactNode;
  /** Optional inline action ("Retry", "Reconnect", "Undo"). */
  actionLabel?: string;
  /** Callback fired when the action pill is pressed. */
  onAction?: () => void;
  /** Escape hatch on the outer container style. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Discriminated dismiss props. Set both, or neither — never one.
 * `dismissLabel` is the localised a11y label the screen reader announces
 * for the "x" button (e.g. "Dismiss", "Cerrar", "关闭"). Hardcoding English
 * there would silently break non-English locales, so the compile error on
 * half-pair usage is intentional.
 */
type BannerDismissProps =
  | { onDismiss: () => void; dismissLabel: string }
  | { onDismiss?: undefined; dismissLabel?: undefined };

export type BannerProps = BannerBaseProps & BannerDismissProps;

/**
 * Map a tone to the surface / border / ink token triple. Kept separate so
 * the lookup is one allocation per module load, and so adding a tone in
 * the future touches exactly one place.
 */
// `noUncheckedIndexedAccess` in the monorepo's tsconfig.base.json widens
// every theme lookup to `T | undefined` regardless of the underlying type.
// The token keys below are exhaustively defined in `src/theme/tokens.ts`,
// so coerce each group to a specific `Record<LiteralUnion, T>` whose values
// the compiler treats as always-present. The narrow unions double as
// compile-time guards that this atom can only reach for tokens the theme
// actually declares.
type BannerColors = { [K in
  | 'verifiedSoft'
  | 'verified'
  | 'verifiedStrong'
  | 'urgentSoft'
  | 'urgent'
  | 'urgentStrong'
  | 'dangerSoft'
  | 'danger'
  | 'dangerStrong'
  | 'infoSoft'
  | 'info'
  | 'inkPrimary']: string };
type BannerSpace = { [K in 'xs' | 's' | 'sm' | 'm']: number };
type BannerRadii = { [K in 'md']: number };
type BannerFonts = { [K in 'bodySemiBold']: string };
type BannerWeights = { [K in 'semibold' | 'bold']: '600' | '700' };
type BannerVariants = {
  h4: { fontSize: number; lineHeight: number };
  bodySmall: { fontSize: number; lineHeight: number };
  label: { fontSize: number; lineHeight: number };
};

function toneTokens(
  theme: Theme,
  tone: BannerTone,
): { surface: string; border: string; label: string } {
  const c = theme.colors as unknown as BannerColors;
  switch (tone) {
    case 'success':
      return { surface: c.verifiedSoft, border: c.verified, label: c.verifiedStrong };
    case 'warning':
      return { surface: c.urgentSoft, border: c.urgent, label: c.urgentStrong };
    case 'danger':
      return { surface: c.dangerSoft, border: c.danger, label: c.dangerStrong };
    case 'info':
    default:
      return { surface: c.infoSoft, border: c.info, label: c.info };
  }
}

/**
 * Inline advisory surface. See module docblock for tone / dismiss / action
 * contracts.
 */
export function Banner({
  tone,
  title,
  children,
  onDismiss,
  dismissLabel,
  actionLabel,
  onAction,
  style,
  testID,
}: BannerProps) {
  const theme = useAppTheme();
  const { surface, border, label } = toneTokens(theme, tone);
  const c = theme.colors as unknown as BannerColors;
  const space = theme.spacing as unknown as BannerSpace;
  const radii = theme.borderRadii as unknown as BannerRadii;
  const fonts = theme.fontFamilies as unknown as BannerFonts;
  const weights = theme.fontWeights as unknown as BannerWeights;
  const variants = theme.textVariants as unknown as BannerVariants;

  const isAlert = tone === 'warning' || tone === 'danger';

  return (
    <View
      testID={testID}
      accessibilityRole={isAlert ? 'alert' : 'summary'}
      accessibilityLiveRegion={isAlert ? 'assertive' : 'polite'}
      style={[
        styles.base,
        {
          backgroundColor: surface,
          borderColor: border,
          borderRadius: radii.md,
          padding: space.m,
          gap: space.s,
        },
        style,
      ]}
    >
      <View style={styles.body}>
        <Text
          style={{
            color: label,
            fontSize: variants.h4.fontSize,
            lineHeight: variants.h4.lineHeight,
            fontFamily: fonts.bodySemiBold,
            fontWeight: weights.semibold,
          }}
        >
          {title}
        </Text>
        {children ? (
          <Text
            style={{
              color: c.inkPrimary,
              fontSize: variants.bodySmall.fontSize,
              lineHeight: variants.bodySmall.lineHeight,
              marginTop: space.xs,
            }}
          >
            {children}
          </Text>
        ) : null}
      </View>

      {actionLabel || onDismiss ? (
        <View style={[styles.actions, { gap: space.s }]}>
          {actionLabel ? (
            <Pressable
              onPress={() => {
                triggerHaptic(20);
                onAction?.();
              }}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              hitSlop={8}
              style={({ pressed }) => [
                styles.action,
                {
                  borderColor: border,
                  borderRadius: radii.md,
                  paddingVertical: space.xs,
                  paddingHorizontal: space.sm,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: label,
                  fontSize: variants.label.fontSize,
                  fontFamily: fonts.bodySemiBold,
                  fontWeight: weights.semibold,
                }}
              >
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}

          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              // `dismissLabel` is required by the prop-level discriminated
              // union whenever `onDismiss` is set, so this is always a
              // non-empty string at runtime.
              accessibilityLabel={dismissLabel}
              hitSlop={8}
              style={styles.dismiss}
            >
              <Text
                style={{
                  color: label,
                  fontSize: 18,
                  fontWeight: weights.bold,
                }}
              >
                {'\u00d7'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    flexDirection: 'column',
  },
  body: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  action: {
    borderWidth: 1,
  },
  dismiss: {
    padding: 4,
  },
});
