'use client';

import { forwardRef } from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    leadingIcon,
    trailingIcon,
    className,
    children,
    disabled,
    type,
    ...rest
  },
  ref,
) {
  const classes = [
    'button',
    `button--${variant}`,
    `button--${size}`,
    loading ? 'button--loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...rest}
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {leadingIcon ? (
        <span aria-hidden="true" className="button__icon button__icon--leading">
          {leadingIcon}
        </span>
      ) : null}
      <span className="button__label">{children}</span>
      {trailingIcon ? (
        <span aria-hidden="true" className="button__icon button__icon--trailing">
          {trailingIcon}
        </span>
      ) : null}
    </button>
  );
});
