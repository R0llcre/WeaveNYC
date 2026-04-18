'use client';

import { forwardRef } from 'react';

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(function Radio(
  { label, hint, className, ...rest },
  ref,
) {
  const classes = ['radio-row', className ?? ''].filter(Boolean).join(' ');
  return (
    <label className={classes}>
      <input {...rest} ref={ref} type="radio" />
      <span>
        <strong>{label}</strong>
        {hint ? <span className="muted">{hint}</span> : null}
      </span>
    </label>
  );
});
