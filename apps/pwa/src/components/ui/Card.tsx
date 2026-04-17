'use client';

import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'flat' | 'raised' | 'accent';
  as?: 'div' | 'article' | 'section';
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { variant = 'flat', as = 'section', className, children, ...rest },
  ref,
) {
  const classes = ['card', `card--${variant}`, className ?? ''].filter(Boolean).join(' ');

  const commonProps = {
    ...rest,
    className: classes,
    children,
  };

  if (as === 'article') {
    return (
      <article {...commonProps} ref={ref as React.Ref<HTMLElement>} />
    );
  }
  if (as === 'div') {
    return (
      <div
        {...(commonProps as React.HTMLAttributes<HTMLDivElement>)}
        ref={ref as unknown as React.Ref<HTMLDivElement>}
      />
    );
  }
  return (
    <section {...commonProps} ref={ref as React.Ref<HTMLElement>} />
  );
});
