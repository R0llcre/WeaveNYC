'use client';

import { forwardRef } from 'react';

type BasePillProps = {
  active?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export type PillButtonProps = BasePillProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'> & {
    as?: 'button';
    href?: never;
  };

export type PillAnchorProps = BasePillProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'> & {
    as: 'a';
    href: string;
  };

export type PillProps = PillButtonProps | PillAnchorProps;

/**
 * Pill — tab/chip atom.
 *
 * Default element is `<button>` so pills work for local state toggles
 * (language picker, filter, verify-mode). When a pill participates in
 * URL-driven navigation (e.g. inbox `?view=requests`), pass `as="a"` and
 * `href` so it renders as an anchor. Consumers that want client-side
 * transitions can still wrap Pill with `next/link` + `passHref`, but the
 * simpler case of plain hrefs is handled directly here so screens stop
 * falling back to `<Link className="pill ...">` and drifting from the atom.
 *
 * `aria-pressed` is always emitted as a concrete "true"/"false" string
 * whenever `active` is a boolean, since AT requires the attribute present
 * with a stable value for toggles.
 */
export const Pill = forwardRef<HTMLButtonElement | HTMLAnchorElement, PillProps>(
  function Pill(props, ref) {
    const { active, className, children } = props;
    const classes = ['pill', active ? 'pill--active' : '', className ?? '']
      .filter(Boolean)
      .join(' ');
    // Always emit a boolean string when `active` is a boolean. Leaving the
    // attribute `undefined` only when the consumer does not pass `active`
    // at all — in that case the button is not a toggle. When it is a toggle,
    // AT requires the attribute present with a stable "true"/"false" value.
    const ariaPressed =
      typeof active === 'boolean' ? (active ? 'true' : 'false') : undefined;

    if (props.as === 'a') {
      // Strip atom-specific props before forwarding the rest to the DOM.
      const { as: _as, active: _active, className: _className, children: _children, ...rest } = props;
      void _as;
      void _active;
      void _className;
      void _children;
      return (
        <a
          {...rest}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
          aria-pressed={ariaPressed}
        >
          {children}
        </a>
      );
    }

    const { as: _as, active: _active, className: _className, children: _children, type, ...rest } = props;
    void _as;
    void _active;
    void _className;
    void _children;
    return (
      <button
        {...rest}
        ref={ref as React.Ref<HTMLButtonElement>}
        type={type ?? 'button'}
        className={classes}
        aria-pressed={ariaPressed}
      >
        {children}
      </button>
    );
  },
);
