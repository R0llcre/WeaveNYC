'use client';

import { forwardRef } from 'react';

import { triggerHaptic } from '@/lib/use-haptic';

export type IconButtonVariant = 'ghost' | 'filled' | 'tonal';
export type IconButtonSize = 'sm' | 'md';
export type IconButtonShape = 'circle' | 'square';
export type IconButtonTone =
  | 'accent'
  | 'community'
  | 'urgent'
  | 'verified'
  | 'danger'
  | 'neutral';

type BaseIconButtonProps = {
  /**
   * Required. Screen readers announce this in place of visible text, so the
   * caller MUST provide a localized string. Never hardcode English here.
   */
  'aria-label': string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
  tone?: IconButtonTone;
  children?: React.ReactNode;
  className?: string;
  /**
   * Wave 6C — opt in to a subtle 10ms vibration on tap. Off by default for
   * IconButton because most icon-only affordances are secondary/ghost (back
   * arrow, dismiss, refresh). Reserve `haptic={true}` for destructive or
   * primary icon actions (e.g. a filled tonal "accept request" button).
   */
  haptic?: boolean;
};

export type IconButtonAsButtonProps = BaseIconButtonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children' | 'aria-label'> & {
    as?: 'button';
    href?: never;
  };

export type IconButtonAsAnchorProps = BaseIconButtonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children' | 'href' | 'aria-label'> & {
    as: 'a';
    href: string;
  };

export type IconButtonProps = IconButtonAsButtonProps | IconButtonAsAnchorProps;

/**
 * IconButton — icon-only action. Guarantees a 44x44 minimum tap target
 * (WCAG 2.5.5) regardless of size variant, and enforces a required
 * `aria-label` so screen readers have something to announce.
 */
export const IconButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, IconButtonProps>(
  function IconButton(props, ref) {
    const {
      variant = 'ghost',
      size = 'md',
      shape = 'circle',
      tone = 'accent',
      className,
      children,
      haptic = false,
    } = props;

    const classes = [
      'icon-button',
      `icon-button--${variant}`,
      `icon-button--${size}`,
      `icon-button--${shape}`,
      `icon-button--tone-${tone}`,
      className ?? '',
    ]
      .filter(Boolean)
      .join(' ');

    if (props.as === 'a') {
      const {
        as: _as,
        variant: _variant,
        size: _size,
        shape: _shape,
        tone: _tone,
        className: _className,
        children: _children,
        haptic: _haptic,
        onClick,
        ...rest
      } = props;
      void _as;
      void _variant;
      void _size;
      void _shape;
      void _tone;
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
          onClick={handleAnchorClick}
        >
          <span aria-hidden="true" className="icon-button__glyph">
            {children}
          </span>
        </a>
      );
    }

    const {
      as: _as,
      variant: _variant,
      size: _size,
      shape: _shape,
      tone: _tone,
      className: _className,
      children: _children,
      haptic: _haptic,
      type,
      disabled,
      onClick,
      ...rest
    } = props;
    void _as;
    void _variant;
    void _size;
    void _shape;
    void _tone;
    void _className;
    void _children;
    void _haptic;

    // Skip the haptic when the button is disabled — pressing an unresponsive
    // control should not buzz, which would falsely signal success.
    const handleButtonClick = haptic && !disabled
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
        disabled={disabled}
        onClick={handleButtonClick}
      >
        <span aria-hidden="true" className="icon-button__glyph">
          {children}
        </span>
      </button>
    );
  },
);
