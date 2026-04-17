'use client';

import { forwardRef } from 'react';

export interface BannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'title'> {
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  { tone, title, children, onDismiss, actionLabel, onAction, className, ...rest },
  ref,
) {
  const role = tone === 'warning' || tone === 'danger' ? 'alert' : 'status';
  const classes = ['banner', `banner--${tone}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <div {...rest} ref={ref} role={role} className={classes}>
      <div className="banner__body">
        <strong className="banner__title">{title}</strong>
        {children ? <div className="banner__content">{children}</div> : null}
      </div>
      {actionLabel || onDismiss ? (
        <div className="banner__actions">
          {actionLabel ? (
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={onAction}
            >
              {actionLabel}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="banner__dismiss"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
