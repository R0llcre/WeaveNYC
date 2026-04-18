/**
 * Wave 6A — PageTransition coverage.
 *
 * PageTransition wraps AppShell's `<main>` children with a Framer Motion
 * fade+slide so route changes animate rather than snap. The tests below
 * pin three contract points:
 *
 *   1. Children render at all (smoke).
 *   2. Changing the mocked pathname re-renders children (the keyed
 *      `<motion.div>` is what makes AnimatePresence treat it as a new route).
 *   3. `useReducedMotion()` being true means no translation is applied —
 *      the element starts at `y: 0` / `opacity: 1` instead of drifting in.
 *
 * We mock `next/navigation`'s `usePathname` via a mutable `pathnameValue`
 * (mirrors the pattern in `shell.test.tsx`) and mock `useReducedMotion`
 * from `framer-motion` so we can flip the reduced-motion branch without
 * touching `matchMedia`. Framer Motion itself is NOT globally mocked — we
 * keep the real motion components so the variants wiring gets exercised.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

// --- next/navigation ---
// Mutable pathname so a single module instance can simulate both a fresh
// render and a post-navigation render within the same test.
let pathnameValue: string = '/';
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameValue,
}));

// --- framer-motion ---
// We keep `AnimatePresence`, `motion`, `LayoutGroup` as the real exports
// so the JSX wiring actually mounts a `motion.div`. Only `useReducedMotion`
// is stubbed — the return value flips per describe block.
let reducedMotionValue = false;
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => reducedMotionValue,
  };
});

import { PageTransition } from './PageTransition';

afterEach(() => {
  cleanup();
  pathnameValue = '/';
  reducedMotionValue = false;
});

describe('shell/PageTransition', () => {
  beforeEach(() => {
    reducedMotionValue = false;
  });

  it('renders its children inside the motion wrapper', () => {
    pathnameValue = '/';
    render(
      <PageTransition>
        <p data-testid="child">hello</p>
      </PageTransition>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
    // The motion wrapper exposes a load-bearing testid so E2E and
    // performance traces can locate the transition container.
    expect(screen.getByTestId('page-transition')).toBeInTheDocument();
  });

  it('re-renders a new child tree when the pathname key changes', async () => {
    // First render on "/" — child A is mounted.
    pathnameValue = '/';
    const { rerender } = render(
      <PageTransition>
        <p data-testid="child-home">home</p>
      </PageTransition>,
    );
    expect(screen.getByTestId('child-home')).toHaveTextContent('home');

    // Simulate a route change: update the mocked pathname and supply a new
    // child tree. Framer's keyed `<motion.div>` cycles because `key` flips,
    // which is exactly the "animate out → animate in" trigger we need.
    // `AnimatePresence mode="wait"` keeps the outgoing tree mounted until
    // its exit animation resolves, so we wait for the new tree to appear
    // rather than asserting synchronously.
    pathnameValue = '/me';
    rerender(
      <PageTransition>
        <p data-testid="child-me">me</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('child-me')).toHaveTextContent('me');
    });
    // Wrapper testid is preserved across route changes.
    expect(screen.getByTestId('page-transition')).toBeInTheDocument();
  });

  it('does not apply a translation when reduced motion is preferred', () => {
    reducedMotionValue = true;
    pathnameValue = '/';

    render(
      <PageTransition>
        <p data-testid="child">static</p>
      </PageTransition>,
    );

    const wrapper = screen.getByTestId('page-transition');
    // In the reduced-motion branch the `initial` variant resolves to
    // `{ opacity: 1 }` with no `y` — Framer writes the starting style
    // inline as `opacity: 1` and omits any `translateY`. We assert both
    // shapes: the inline opacity is 1 and no `translateY` or `translate3d`
    // appears in the style string.
    const inlineStyle = wrapper.getAttribute('style') ?? '';
    expect(inlineStyle).toContain('opacity: 1');
    expect(inlineStyle).not.toMatch(/translate(Y|3d)/);
  });

  it('still cycles keys under reduced motion so React swaps subtrees', async () => {
    // Even with zero-duration transitions, AnimatePresence(mode="wait")
    // still routes through a resolve step before mounting the next key.
    // The test therefore waits for the new subtree rather than asserting
    // synchronously — the important contract is "React eventually swaps",
    // not "the swap is microtask-synchronous in jsdom."
    reducedMotionValue = true;
    pathnameValue = '/';
    const { rerender } = render(
      <PageTransition>
        <p data-testid="child-a">a</p>
      </PageTransition>,
    );
    expect(screen.getByTestId('child-a')).toHaveTextContent('a');

    pathnameValue = '/inbox';
    rerender(
      <PageTransition>
        <p data-testid="child-b">b</p>
      </PageTransition>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('child-b')).toHaveTextContent('b');
    });
  });
});
