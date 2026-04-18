'use client';

import { forwardRef } from 'react';

export type SkeletonVariant = 'text' | 'rect' | 'circle';

export interface SkeletonProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: SkeletonVariant;
  width?: number | string;
  height?: number | string;
  /**
   * Accessible loading label. When provided the element reports itself as a
   * progressbar; otherwise it's hidden from assistive tech (treated as
   * decorative chrome). Consumers should usually set this on the outermost
   * skeleton of a loading region and leave inner lines decorative.
   */
  label?: string;
}

/**
 * Skeleton — low-fidelity placeholder for loading states.
 *
 * Animation uses a CSS pulse keyframe defined alongside the atom class in
 * `globals.css` (W1A wave). The atom reference tokens, never hex, and
 * degrades gracefully under `prefers-reduced-motion`.
 */
export const Skeleton = forwardRef<HTMLSpanElement, SkeletonProps>(function Skeleton(
  { variant = 'text', width, height, label, className, style, ...rest },
  ref,
) {
  const classes = ['skeleton', `skeleton--${variant}`, className ?? ''].filter(Boolean).join(' ');
  const resolvedWidth =
    width ?? (variant === 'text' ? '100%' : variant === 'circle' ? 40 : '100%');
  const resolvedHeight =
    height ?? (variant === 'text' ? '1em' : variant === 'circle' ? 40 : 16);
  const radius = variant === 'circle' ? '50%' : variant === 'text' ? '6px' : 'var(--radius-md, 14px)';

  return (
    <span
      {...rest}
      ref={ref}
      className={classes}
      role={label ? 'progressbar' : undefined}
      aria-busy={label ? true : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      aria-valuetext={label}
      style={{
        display: 'inline-block',
        width: resolvedWidth,
        height: resolvedHeight,
        borderRadius: radius,
        background:
          'linear-gradient(90deg, rgba(24,33,45,0.06) 0%, rgba(24,33,45,0.12) 40%, rgba(24,33,45,0.06) 80%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-pulse 1.4s ease-in-out infinite',
        ...style,
      }}
    />
  );
});
