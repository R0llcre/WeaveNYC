'use client';

import { forwardRef } from 'react';

import { icons, type IconName } from '../../assets/icons/registry';

export type IconSize = 'sm' | 'md' | 'lg';
export type IconTone =
  | 'accent'
  | 'ink'
  | 'muted'
  | 'community'
  | 'urgent'
  | 'verified'
  | 'danger';

const SIZE_PX: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

const TONE_VAR: Record<IconTone, string> = {
  // `currentColor` is the default for inline SVGs, so tones just set an
  // explicit `color:` on the wrapping span via a CSS variable reference.
  // All colours come from W1A tokens — no hardcoded hex.
  accent: 'var(--color-accent)',
  ink: 'var(--color-ink-primary)',
  muted: 'var(--color-ink-muted)',
  community: 'var(--color-community, var(--color-accent))',
  urgent: 'var(--color-urgent, var(--color-warning))',
  verified: 'var(--color-verified, var(--color-success))',
  danger: 'var(--color-danger)',
};

/**
 * Strip a registered SVG's embedded a11y attributes before injecting, so the
 * wrapper span stays the sole owner of `role`/`aria-hidden`/`aria-label`.
 * The regex is scoped to attribute-looking tokens on the root `<svg>` element
 * and leaves `currentColor` / viewBox untouched.
 */
function stripInnerSvgA11y(markup: string): string {
  return markup
    .replace(/\s+role="[^"]*"/g, '')
    .replace(/\s+aria-hidden="[^"]*"/g, '');
}

export interface IconProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /**
   * Registered icon key. Renders the raw SVG from
   * `assets/icons/registry.ts` via `dangerouslySetInnerHTML`. When both
   * `name` and `children` are provided, `children` wins.
   */
  name?: IconName;
  size?: IconSize;
  tone?: IconTone;
  /**
   * Inline SVG node. Consumers pass raw SVG so the atom stays zero-coupled
   * to any specific icon set. Colour inherits from `currentColor` (set via
   * the `tone` prop), so SVGs should use `fill="currentColor"` or
   * `stroke="currentColor"` to theme correctly. Takes precedence over
   * `name` when both are provided.
   */
  children?: React.ReactNode;
  /** Accessible label. When omitted, the icon is treated as decorative (`aria-hidden`). */
  label?: string;
}

/**
 * Icon — inline SVG wrapper.
 *
 * The atom resolves registered icons by `name` from the W1C registry, and
 * also accepts raw SVG children for bespoke glyphs. Colour is set via CSS
 * variable, size via the `size` token, and a11y via the `label` prop.
 *
 * ```tsx
 * <Icon size="md" tone="community" name="food" label="Food pantry" />
 * <Icon size="md" tone="ink">
 *   <svg viewBox="0 0 24 24">...</svg>
 * </Icon>
 * ```
 */
export const Icon = forwardRef<HTMLSpanElement, IconProps>(function Icon(
  { name, size = 'md', tone = 'ink', children, label, className, style, ...rest },
  ref,
) {
  const px = SIZE_PX[size];
  const classes = ['icon', `icon--${size}`, `icon--${tone}`, className ?? '']
    .filter(Boolean)
    .join(' ');
  const decorative = !label;
  const useRegistry = !children && name !== undefined && icons[name] !== undefined;
  const innerHtml = useRegistry ? { __html: stripInnerSvgA11y(icons[name as IconName]) } : undefined;

  return (
    <span
      {...rest}
      ref={ref}
      className={classes}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      data-icon-name={name}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: px,
        height: px,
        color: TONE_VAR[tone],
        ...style,
      }}
      {...(innerHtml ? { dangerouslySetInnerHTML: innerHtml } : {})}
    >
      {innerHtml ? undefined : children}
    </span>
  );
});
