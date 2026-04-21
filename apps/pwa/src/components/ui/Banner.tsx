'use client';

import { forwardRef } from 'react';

import { Button } from './Button';

type BannerBaseProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'role' | 'title'> & {
  tone: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Visual weight for the action button when `actionLabel` is set.
   *
   * Defaults to `secondary` so retry affordances line up with the banner's
   * own tone without competing with the page's main CTA. Use `primary`
   * sparingly (e.g. "Reconnect" on a chat disconnect banner where the
   * action is the only thing the user should do next).
   */
  actionVariant?: 'primary' | 'secondary' | 'ghost';
};

/**
 * Discriminated props for the dismiss button. When a caller provides
 * `onDismiss`, they MUST also provide a localized `dismissLabel`
 * (previously defaulted to hardcoded English "Dismiss"). Omitting either
 * both or providing only `onDismiss` is a compile error — this is the
 * whole point of F4-C fix #3.
 */
type BannerDismissProps =
  | { onDismiss: () => void; dismissLabel: string }
  | { onDismiss?: undefined; dismissLabel?: undefined };

export type BannerProps = BannerBaseProps & BannerDismissProps;

/**
 * Banner — inline status / advisory surface.
 *
 * Tone conventions (aligned across the PWA so users and screen readers get
 * a consistent signal):
 *
 * - `info`    — neutral guidance; something is in progress or the user may
 *               want to know about a non-blocking state (e.g. "Creating
 *               session…", "Reconnecting…"). Renders as `role=status`.
 * - `success` — positive confirmation of a completed action (e.g.
 *               "Verified!", "Account restored"). Renders as `role=status`.
 * - `warning` — the user can recover; something is wrong but action is
 *               available (e.g. "Verification required", expired OTP code,
 *               WS disconnected). Renders as `role=alert`.
 * - `danger`  — system-level error or destructive outcome (e.g. network
 *               failure, "Account scheduled for deletion", 5xx responses).
 *               Renders as `role=alert`.
 *
 * Pick the lightest tone that still conveys the situation — overusing
 * `danger` desensitises users to real problems.
 */
export const Banner = forwardRef<HTMLDivElement, BannerProps>(function Banner(
  {
    tone,
    title,
    children,
    onDismiss,
    dismissLabel,
    actionLabel,
    onAction,
    actionVariant = 'secondary',
    className,
    ...rest
  },
  ref,
) {
  const role = tone === 'warning' || tone === 'danger' ? 'alert' : 'status';
  // role="alert" already implies aria-live="assertive"; role="status" implies
  // aria-live="polite". Making it explicit guarantees that info/success
  // Banners mounted dynamically after hydration (e.g. match-results success,
  // resource-empty hints) get announced reliably across screen readers.
  const ariaLive = role === 'alert' ? 'assertive' : 'polite';
  const classes = ['banner', `banner--${tone}`, className ?? ''].filter(Boolean).join(' ');
  return (
    <div {...rest} ref={ref} role={role} aria-live={ariaLive} className={classes}>
      <div className="banner__body">
        <strong className="banner__title">{title}</strong>
        {children ? <div className="banner__content">{children}</div> : null}
      </div>
      {actionLabel || onDismiss ? (
        <div className="banner__actions">
          {actionLabel ? (
            <Button variant={actionVariant} size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              className="banner__dismiss"
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
