'use client';

import { Children, cloneElement, forwardRef, isValidElement, useId } from 'react';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

type HintableElement = React.ReactElement<{
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
}>;

/**
 * Form field wrapper: pairs a visible <label> with exactly one form control child
 * (input/select/textarea). Automatically wires aria-describedby to hint/error nodes.
 */
export const Field = forwardRef<HTMLLabelElement, FieldProps>(function Field(
  { label, hint, error, required, htmlFor, children, className, ...rest },
  ref,
) {
  const reactId = useId();
  const controlId = htmlFor ?? `field-${reactId}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  // Attach ARIA wiring to the first valid element child (the form control).
  const kids = Children.toArray(children);
  const firstElementIdx = kids.findIndex((c) => isValidElement(c));
  const enriched = kids.map((child, idx) => {
    if (idx !== firstElementIdx || !isValidElement(child)) {
      return child;
    }
    const el = child as HintableElement;
    const existingDescribedBy = el.props['aria-describedby'];
    const mergedDescribedBy = [existingDescribedBy, describedBy]
      .filter(Boolean)
      .join(' ')
      .trim();
    return cloneElement(el, {
      id: el.props.id ?? controlId,
      'aria-describedby': mergedDescribedBy || undefined,
      'aria-invalid': error ? true : el.props['aria-invalid'],
      'aria-required': required ? true : el.props['aria-required'],
    });
  });

  const classes = ['field', error ? 'field--error' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <label
      {...rest}
      ref={ref}
      htmlFor={controlId}
      className={classes}
    >
      <span className="field__label">
        {label}
        {required ? (
          <span aria-hidden="true" className="field__required">
            {' '}
            *
          </span>
        ) : null}
      </span>
      {enriched}
      {hint ? (
        <span className="field__hint muted" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
});
