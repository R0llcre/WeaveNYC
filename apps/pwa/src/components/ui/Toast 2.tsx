'use client';

import { forwardRef } from 'react';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title' | 'role'> {
  tone: ToastTone;
  /** Required headline. Callers pass an already-translated string. */
  title: string;
  /** Optional supporting copy. */
  description?: React.ReactNode;
  /** Optional single action (e.g. "Undo") — keep to ≤2 words. */
  action?: {
    label: string;
    onClick: () => void;
  };
  /**
   * When provided, renders a ✕ button. The caller owns dismissal logic —
   * this atom never auto-dismisses because a higher-level provider handles
   * the queue/timer.
   */
  onDismiss?: () => void;
  /** Accessible label for the ✕ dismiss button (must be localized). */
  dismissLabel?: string;
}

/**
 * Toast — transient status notification.
 *
 * This is the presentational shell only. A separate Toast Provider (outside
 * this wave's scope) owns the portal, queue, and auto-dismiss timing. Use
 * `role=alert` for danger/warning so screen readers announce assertively,
 * `role=status` for info/success for a polite announcement.
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { tone, title, description, action, onDismiss, dismissLabel = 'Dismiss', className, ...rest },
  ref,
) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  const ariaLive = role === 'alert' ? 'assertive' : 'polite';
  const classes = ['toast', `toast--${tone}`, className ?? ''].filter(Boolean).join(' ');

  return (
    <div {...rest} ref={ref} className={classes} role={role} aria-live={ariaLive}>
      <div className="toast__body">
        <strong className="toast__title">{title}</strong>
        {description ? <div className="toast__description">{description}</div> : null}
      </div>
      {action || onDismiss ? (
        <div className="toast__actions">
          {action ? (
            <button type="button" className="toast__action" onClick={action.onClick}>
              {action.label}
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="toast__dismiss"
              onClick={onDismiss}
              aria-label={dismissLabel}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});
