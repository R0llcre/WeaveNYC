'use client';

import { forwardRef } from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, hint, className, ...rest },
  ref,
) {
  const classes = ['checkbox-row', className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <input {...rest} ref={ref} type="checkbox" />
      <span>
        <strong>{label}</strong>
        {hint ? <span className="muted">{hint}</span> : null}
      </span>
    </label>
  );
});
