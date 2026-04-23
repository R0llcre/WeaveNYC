/**
 * Skeleton atom — import + shape smoke tests.
 *
 * The reanimated loop and reduced-motion path exercise real RN APIs
 * that the scaffold's minimal mock doesn't fully emulate. We pin the
 * module's public surface here; behavioural tests land once jest-expo
 * is wired (wave B).
 */

import { Skeleton } from './Skeleton';
import { Skeleton as BarrelSkeleton } from './index';

describe('Skeleton atom', () => {
  it('exports a callable React component', () => {
    expect(typeof Skeleton).toBe('function');
  });

  it('is re-exported from the ui barrel', () => {
    expect(BarrelSkeleton).toBe(Skeleton);
  });

  it('has a stable display name for debugging', () => {
    expect(Skeleton.name).toBe('Skeleton');
  });
});
