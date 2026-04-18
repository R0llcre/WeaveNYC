'use client';

import { forwardRef } from 'react';

import { illustrations, type IllustrationName } from '../../assets/illustrations/registry';
import { Button } from './Button';

export interface EmptyStateCta {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  testId?: string;
}

export type EmptyStateTone = 'info' | 'error';

/**
 * Strip a registered SVG's embedded a11y attributes before injecting, so the
 * wrapping node stays the sole owner of `aria-hidden` / `role`. Mirrors the
 * helper in `Icon.tsx` — registries stamp `role="img" aria-hidden="true"`
 * for standalone use, but we don't want that doubling up inside wrappers.
 */
function stripInnerSvgA11y(markup: string): string {
  return markup
    .replace(/\s+role="[^"]*"/g, '')
    .replace(/\s+aria-hidden="[^"]*"/g, '');
}

export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Registered illustration key. Renders the raw SVG from
   * `assets/illustrations/registry.ts` via `dangerouslySetInnerHTML`. When
   * both `illustrationName` and `illustration` are provided, `illustration`
   * wins.
   */
  illustrationName?: IllustrationName;
  /** Explicit illustration slot (usually an `<img>` or raw SVG). */
  illustration?: React.ReactNode;
  /** h2-sized headline. Required. */
  title: string;
  /** Body-sm, muted supporting line. Keep to one sentence. */
  subtitle?: string;
  /** Optional primary CTA rendered as a `<Button>`. Label ≤3 words. */
  cta?: EmptyStateCta;
  /**
   * Announcement semantics. `info` (default) renders with no `role` and no
   * live region, so static empty states don't announce on every mount.
   * `error` renders `role="alert"` so screen readers surface the failure.
   */
  tone?: EmptyStateTone;
}

/**
 * EmptyState — reusable zero-data surface.
 *
 * Used when a list/tab/search returns nothing. Copy is constrained to
 * `title` + one-sentence `subtitle` + a single CTA so the screen stays
 * focused. Consumers own translation; the atom never ships English strings.
 *
 * Announcement defaults to silent (`tone="info"`) to avoid screen-reader
 * chatter on tab switches and initial load. Pass `tone="error"` to opt in
 * to `role="alert"` for failure states.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  {
    illustrationName,
    illustration,
    title,
    subtitle,
    cta,
    tone = 'info',
    className,
    children,
    ...rest
  },
  ref,
) {
  const classes = ['empty-state', className ?? ''].filter(Boolean).join(' ');
  const role = tone === 'error' ? 'alert' : undefined;
  const registryMarkup =
    !illustration && illustrationName && illustrations[illustrationName]
      ? stripInnerSvgA11y(illustrations[illustrationName])
      : undefined;

  return (
    <div {...rest} ref={ref} className={classes} role={role}>
      {illustration || illustrationName ? (
        <div
          className="empty-state__illustration"
          aria-hidden="true"
          data-illustration={illustrationName}
          {...(registryMarkup ? { dangerouslySetInnerHTML: { __html: registryMarkup } } : {})}
        >
          {registryMarkup ? undefined : illustration}
        </div>
      ) : null}
      <h2 className="empty-state__title">{title}</h2>
      {subtitle ? <p className="empty-state__subtitle muted">{subtitle}</p> : null}
      {cta ? (
        <div className="empty-state__cta">
          {cta.href ? (
            <Button
              as="a"
              href={cta.href}
              variant={cta.variant ?? 'primary'}
              data-testid={cta.testId}
            >
              {cta.label}
            </Button>
          ) : (
            <Button
              variant={cta.variant ?? 'primary'}
              onClick={cta.onClick}
              data-testid={cta.testId}
            >
              {cta.label}
            </Button>
          )}
        </div>
      ) : null}
      {children}
    </div>
  );
});
