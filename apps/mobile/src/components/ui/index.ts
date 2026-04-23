/**
 * UI atoms — public barrel.
 * =========================
 *
 * Consumers (screens, composite components) import atoms from this path:
 *
 *   import { Stack, Inline, Field, EmptyState, Toast } from '@/components/ui';
 *
 * Adding a new atom: add the component file, then re-export it here. Types
 * that travel with a component (prop interfaces, enum unions) are re-
 * exported alongside so callers don't reach into the component module
 * directly.
 */

export { Stack } from './Stack';
export type {
  StackProps,
  StackSpaceToken,
  StackAlign,
  StackJustify,
} from './Stack';

export { Inline } from './Inline';
export type {
  InlineProps,
  InlineSpaceToken,
  InlineAlign,
  InlineJustify,
} from './Inline';

export { Field } from './Field';
export type { FieldProps } from './Field';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateCta, EmptyStateTone } from './EmptyState';

export { Toast } from './Toast';
export type { ToastProps, ToastTone } from './Toast';
