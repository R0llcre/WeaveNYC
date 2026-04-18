'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/**
 * Whitelisted spacing tokens that match the `--space-*` custom properties
 * shipped by W1A. Kept in sync with `Stack` so vertical and horizontal
 * rhythm share a common vocabulary.
 */
export type InlineSpaceToken = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
export type InlineAlign = 'start' | 'center' | 'end' | 'baseline';
export type InlineJustify = 'start' | 'center' | 'end' | 'between' | 'around';
export type InlineAs = 'div' | 'span' | 'nav' | 'ul';

const JUSTIFY_MAP: Record<InlineJustify, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  between: 'space-between',
  around: 'space-around',
};

export interface InlineProps extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
  children: ReactNode;
  /** Horizontal gap between children, mapped to `var(--space-{gap})`. */
  gap?: InlineSpaceToken;
  /** Cross-axis alignment. Defaults to `center`. */
  align?: InlineAlign;
  /** Main-axis distribution. Defaults to `start`. */
  justify?: InlineJustify;
  /** Allow children to wrap to a new line when overflowing. */
  wrap?: boolean;
  /** Rendered DOM element. Defaults to `div`. */
  as?: InlineAs;
  className?: string;
  style?: CSSProperties;
}

/**
 * Inline — one-axis horizontal layout primitive.
 *
 * Use whenever you'd otherwise write `display: flex; flex-direction: row`.
 * Spacing derives from `--space-*` tokens so horizontal rhythm stays tied
 * to the design system.
 *
 * ```tsx
 * <Inline gap={2} align="center" justify="between">
 *   <span>Sunset Pantry</span>
 *   <Pill>0.4 mi</Pill>
 * </Inline>
 * ```
 */
export function Inline({
  children,
  gap = 3,
  align = 'center',
  justify = 'start',
  wrap = false,
  as = 'div',
  className,
  style,
  ...rest
}: InlineProps) {
  const Tag = as as 'div' | 'span' | 'nav' | 'ul';
  const alignItems =
    align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : align;
  return (
    <Tag
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems,
        justifyContent: JUSTIFY_MAP[justify],
        gap: `var(--space-${gap})`,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
