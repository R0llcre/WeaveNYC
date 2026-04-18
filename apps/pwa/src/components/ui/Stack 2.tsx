'use client';

import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

/**
 * Whitelisted spacing tokens that match the `--space-*` custom properties
 * shipped by W1A. Keeping the set explicit prevents ad-hoc "7" or "9"
 * values from slipping in and drifting off the design system scale.
 */
export type StackSpaceToken = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

export type StackAs = 'div' | 'section' | 'article' | 'main';

export interface StackProps extends Omit<HTMLAttributes<HTMLElement>, 'style'> {
  children: ReactNode;
  /** Vertical gap between children, mapped to `var(--space-{gap})`. */
  gap?: StackSpaceToken;
  /** Rendered DOM element. Defaults to `div`. */
  as?: StackAs;
  className?: string;
  style?: CSSProperties;
}

/**
 * Stack — one-axis vertical layout primitive.
 *
 * Prefer this over bespoke flex containers so every screen reaches for the
 * same vertical rhythm. All spacing derives from the `--space-*` tokens to
 * preserve the design system contract.
 *
 * ```tsx
 * <Stack gap={4}>
 *   <Field label="Email" />
 *   <Field label="Password" />
 *   <Button>Submit</Button>
 * </Stack>
 * ```
 */
export function Stack({
  children,
  gap = 3,
  as = 'div',
  className,
  style,
  ...rest
}: StackProps) {
  const Tag = as as 'div';
  return (
    <Tag
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `var(--space-${gap})`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
