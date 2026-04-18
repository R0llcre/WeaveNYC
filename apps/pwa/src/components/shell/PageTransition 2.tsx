'use client';

/**
 * PageTransition — lightweight Framer Motion wrapper for route changes.
 *
 * Wave 6A microinteraction. Fades and slides the active route content as
 * the URL changes so the shell stops feeling like a server-rendered page
 * refresh and starts reading as an app.
 *
 * Design decisions:
 *
 *  - Uses `AnimatePresence mode="wait"` so the outgoing route finishes
 *    exiting before the incoming route starts animating. Combined with the
 *    pathname-keyed `<motion.div>`, this yields a clean "page swap" feel
 *    instead of stacked cross-fades that look janky on Low-tier Android.
 *
 *  - `initial={false}` on `<AnimatePresence>` suppresses the enter animation
 *    on the very first mount (cold boot / hard refresh). Without this the
 *    home screen visibly "slides in" after hydration, which looks like a
 *    loading glitch rather than an intentional beat. Real transitions only
 *    trigger on subsequent route changes.
 *
 *  - Motion vocabulary: 240ms with the "spring-like" cubic-bezier
 *    `(0.22, 0.61, 0.36, 1)` — a classic ease-out curve (fast start, soft
 *    settle) that matches native iOS navigation timing. Distance is 8px
 *    on enter and 4px on exit: intentionally asymmetric so attention lands
 *    on the incoming content and the outgoing content "fades backward"
 *    rather than fighting for focus.
 *
 *  - `useReducedMotion()` compresses all transforms to `duration: 0` and
 *    holds `opacity: 1` across all three states. The element is still
 *    keyed by pathname so React can still cycle trees, but the visual
 *    effect is an instant swap — the correct behaviour for users with
 *    vestibular or cognitive motion sensitivity.
 *
 *  - Only `opacity` and `y` (transform) are animated — never `width`,
 *    `height`, or `padding`. Keeps CLS at 0 and lets the GPU rasterize
 *    the transition without triggering a layout pass.
 *
 * Static-export safety: entirely client-side. `usePathname` and the Framer
 * Motion hooks are all client-only; this file is `'use client'` so it
 * composes safely under the static-export root layout.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type PageTransitionProps = {
  children: ReactNode;
};

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const shouldReduce = useReducedMotion();

  // Reduced-motion branch: transition object collapses to zero duration so
  // Framer Motion still sees a valid transition config (required for the
  // variants API) but the animation completes in a single frame. Variants
  // hold opacity at 1 and skip the translate so no transform is ever
  // applied — critical for users who trigger on subtle vertical drift.
  const transition = shouldReduce
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 0.61, 0.36, 1] as const };

  const variants = shouldReduce
    ? {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 1 },
      }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
      };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname ?? '/'}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={variants}
        transition={transition}
        className="page-transition"
        data-testid="page-transition"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
