/**
 * M8.5 W2 R4 — RouteGuards direct coverage.
 *
 * `RouteGuards` is the tiny client island the root layout mounts above
 * every non-onboarding route. It does exactly two things: (1) invokes
 * `useOnboardingGuard` once on mount, and (2) renders `null` so it never
 * paints. Those two guarantees are load-bearing — swapping the hook for
 * an inline `useEffect` (for example) would lose the Suspense boundary
 * contract that keeps static export happy, and any stray JSX would paint
 * chrome alongside the AppShell.
 *
 * The test below mocks the hook module so we can assert it's called
 * exactly once without needing a real Redux store / next/navigation
 * context, mirroring the harness pattern established in
 * `apps/pwa/src/lib/route-guard.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Suspense } from 'react';

const useOnboardingGuardSpy = vi.fn();

vi.mock('@/lib/route-guard', () => ({
  useOnboardingGuard: () => {
    useOnboardingGuardSpy();
  },
}));

// Imported after vi.mock so the mock is in place when the module graph
// resolves `@/lib/route-guard`.
import { RouteGuards } from './RouteGuards';

afterEach(() => {
  cleanup();
  useOnboardingGuardSpy.mockReset();
});

describe('shell/RouteGuards', () => {
  it('renders null (no DOM) and invokes useOnboardingGuard exactly once', () => {
    const { container } = render(
      <Suspense fallback={null}>
        <RouteGuards />
      </Suspense>,
    );

    expect(container.innerHTML).toBe('');
    expect(useOnboardingGuardSpy).toHaveBeenCalledTimes(1);
  });
});
