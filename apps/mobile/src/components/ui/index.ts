/**
 * UI atoms — public barrel.
 * =========================
 *
 * Consumers import atoms from this path:
 *
 *   import { Button, Card } from '@/components/ui';
 *
 * This file is the single append-point for every atom port. Parallel
 * waves (M3b layout atoms, M4 SVG-backed atoms) add their own
 * `export { … } from './<Name>'` lines here — merge conflicts stay
 * trivial because each wave only appends below the last.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Card } from './Card';
export type { CardProps, CardVariant, CardPadding } from './Card';
