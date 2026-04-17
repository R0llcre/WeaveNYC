'use client';

import { forwardRef } from 'react';

type BaseButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
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
      loading = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
    } = props;

    const classes = [
      'button',
      `button--${variant}`,
      `button--${size}`,
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
        loading: _loading,
        leadingIcon: _leadingIcon,
        trailingIcon: _trailingIcon,
        className: _className,
        children: _children,
        ...rest
      } = props;
      void _as;
      void _variant;
      void _size;
      void _loading;
      void _leadingIcon;
      void _trailingIcon;
      void _className;
      void _children;
      return (
        <a
          {...rest}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-busy={loading || undefined}
        >
          {iconsAndLabel}
        </a>
      );
    }

    const {
      as: _as,
      variant: _variant,
      size: _size,
      loading: _loading,
      leadingIcon: _leadingIcon,
      trailingIcon: _trailingIcon,
      className: _className,
      children: _children,
      disabled,
      type,
      ...rest
    } = props;
    void _as;
    void _variant;
    void _size;
    void _loading;
    void _leadingIcon;
    void _trailingIcon;
    void _className;
    void _children;

    const isDisabled = disabled || loading;

    return (
      <button
        {...rest}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type ?? 'button'}
        className={classes}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
      >
        {iconsAndLabel}
      </button>
    );
  },
);
