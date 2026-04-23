/**
 * RouteLoadingFallback atom — import + shape smoke tests.
 */

import { RouteLoadingFallback } from './RouteLoadingFallback';
import { RouteLoadingFallback as BarrelRouteLoadingFallback } from './index';

describe('RouteLoadingFallback atom', () => {
  it('exports a callable React component', () => {
    expect(typeof RouteLoadingFallback).toBe('function');
  });

  it('is re-exported from the ui barrel', () => {
    expect(BarrelRouteLoadingFallback).toBe(RouteLoadingFallback);
  });

  it('has a stable display name for debugging', () => {
    expect(RouteLoadingFallback.name).toBe('RouteLoadingFallback');
  });
});
