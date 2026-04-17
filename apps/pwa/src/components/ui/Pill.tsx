'use client';

import { forwardRef } from 'react';

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Pill = forwardRef<HTMLButtonElement, PillProps>(function Pill(
  { active, className, children, type, ...rest },
  ref,
) {
  const classes = ['pill', active ? 'pill--active' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      aria-pressed={active ?? undefined}
    >
      {children}
    </button>
  );
});
