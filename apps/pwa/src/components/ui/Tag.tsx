'use client';

import { forwardRef } from 'react';

export type TagTone =
  | 'community'
  | 'urgent'
  | 'verified'
  | 'neutral'
  | 'accent'
  | 'warning'
  | 'danger'
  | 'muted';

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: TagTone;
  /**
   * Optional leading glyph (usually an `<Icon />`). Rendered with
   * aria-hidden so screen readers only pick up the text label.
   */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Tag — compact, read-only categorical label.
 *
 * Distinct from `<Pill>` (which is an interactive toggle with aria-pressed).
 * A Tag never has press semantics and never changes app state. Use it for
 * resource categories, post status, verification badges, etc.
 *
 * ```tsx
 * <Tag tone="verified">Verified anchor</Tag>
 * <Tag tone="community" icon={<Icon name="food" size="sm" />}>Food pantry</Tag>
 * ```
 */
export const Tag = forwardRef<HTMLSpanElement, TagProps>(function Tag(
  { tone = 'neutral', icon, children, className, ...rest },
  ref,
) {
  const classes = ['tag', `tag--${tone}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <span {...rest} ref={ref} className={classes}>
      {icon ? (
        <span aria-hidden="true" className="tag__icon">
          {icon}
        </span>
      ) : null}
      <span className="tag__label">{children}</span>
    </span>
  );
});
