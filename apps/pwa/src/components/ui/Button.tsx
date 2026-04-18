'use client';

import { forwardRef } from 'react';

import { triggerHaptic } from '@/lib/use-haptic';

type BaseButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /**
   * Optional brand tone override. `accent` (default) uses the main teal brand
   * colour; `community`, `urgent`, `verified`, `danger` map onto the extended
   * palette (W1A tokens). Atoms apply the tone as a modifier class so the
   * base variant chrome (primary fill vs ghost outline) is preserved.
   */
  tone?: 'accent' | 'community' | 'urgent' | 'verified' | 'danger';
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /**
   * Wave 6C — opt in to a subtle 10ms vibration buzz on tap. Gated by the
   * Vibration API and `prefers-reduced-motion` inside `triggerHaptic`, so a
   * `haptic={true}` on desktop or reduced-motion devices is a silent no-op.
   * Not applied automatically to every button: only primary CTAs that would
   * feel inert without tactile confirmation should opt in (see the redesign
   * plan §4 Wave 6C).
   */
  haptic?: boolean;
};

export type ButtonAsButtonProps = BaseButtonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    as?: 'button';
    href?: never;
  };

export type ButtonAsAnchorProps = BaseButtonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href'> & {
    as: 'a';
    href: string;
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsAnchorProps;

/**
 * Button — primary action atom.
 *
 * Default element is `<button>`. When a button is purely a navigation target
 * (in-app link styled as a CTA, or a `tel:` / `mailto:` / external URL that
 * MUST render as an anchor for the platform to dispatch correctly), pass
 * `as="a"` and `href`. This lets screens drop raw `<a className="button ...">`
 * strings and the `<Link className="button ...">` pattern that kept drifting
 * from the atom's class list.
 *
 * For internal static-export routes (`/posts/new`, `/community`) a plain
 * anchor is sufficient — the app ships as static HTML and the browser does
 * full-document navigation. Consumers that want Next.js client transitions
 * can still wrap `<Button>` with `<Link passHref legacyBehavior>`, but none
 * of the current PWA screens rely on that.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      tone,
      loading = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      haptic = false,
    } = props;

    const classes = [
      'button',
      `button--${variant}`,
      `button--${size}`,
      tone && tone !== 'accent' ? `button--tone-${tone}` : '',
      loading ? 'button--loading' : '',
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    const iconsAndLabel = (
      <>
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
      </>
    );

    if (props.as === 'a') {
      // Strip atom-specific props before forwarding the rest to the DOM anchor.
      const {
        as: _as,
        variant: _variant,
        size: _size,
        tone: _tone,
        loading: _loading,
        leadingIcon: _leadingIcon,
        trailingIcon: _trailingIcon,
        className: _className,
        children: _children,
        haptic: _haptic,
        onClick,
        ...rest
      } = props;
      void _as;
      void _variant;
      void _size;
      void _tone;
      void _loading;
      void _leadingIcon;
      void _trailingIcon;
      void _className;
      void _children;
      void _haptic;

      const handleAnchorClick = haptic
        ? (event: React.MouseEvent<HTMLAnchorElement>) => {
            triggerHaptic(10);
            onClick?.(event);
          }
        : onClick;

      return (
        <a
          {...rest}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-busy={loading || undefined}
          onClick={handleAnchorClick}
        >
          {iconsAndLabel}
        </a>
      );
    }

    const {
      as: _as,
      variant: _variant,
      size: _size,
      tone: _tone,
      loading: _loading,
      leadingIcon: _leadingIcon,
      trailingIcon: _trailingIcon,
      className: _className,
      children: _children,
      haptic: _haptic,
      disabled,
      type,
      onClick,
      ...rest
    } = props;
    void _as;
    void _variant;
    void _size;
    void _tone;
    void _loading;
    void _leadingIcon;
    void _trailingIcon;
    void _className;
    void _children;
    void _haptic;

    const isDisabled = disabled || loading;

    // When the button is disabled or loading we intentionally skip the
    // haptic — pressing an unresponsive button should not buzz, which would
    // incorrectly signal that the tap "worked".
    const handleButtonClick = haptic && !isDisabled
      ? (event: React.MouseEvent<HTMLButtonElement>) => {
          triggerHaptic(10);
          onClick?.(event);
        }
      : onClick;

    return (
      <button
        {...rest}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type ?? 'button'}
        className={classes}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        onClick={handleButtonClick}
      >
        {iconsAndLabel}
      </button>
    );
  },
);
