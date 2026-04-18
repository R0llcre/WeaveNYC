'use client';

import Link from 'next/link';
import { forwardRef } from 'react';

export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** When present, renders a Link with "← back" in the topbar. */
  backHref?: string;
  actions?: React.ReactNode;
}

export const PageHeader = forwardRef<HTMLElement, PageHeaderProps>(function PageHeader(
  { eyebrow, title, subtitle, backHref, actions, className, ...rest },
  ref,
) {
  const classes = ['hero', className ?? ''].filter(Boolean).join(' ');
  const hasTopbar = Boolean(backHref || eyebrow);
  return (
    <section {...rest} ref={ref} className={classes}>
      {hasTopbar ? (
        <div className="hero__topbar">
          {backHref ? (
            <Link href={backHref} className="hero__link">
              ← back
            </Link>
          ) : null}
          {eyebrow ? <span className="hero__eyebrow">{eyebrow}</span> : null}
        </div>
      ) : null}
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions ? <div className="actions">{actions}</div> : null}
    </section>
  );
});
