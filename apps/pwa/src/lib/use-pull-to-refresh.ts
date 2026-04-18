'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Wave 6B — native-feeling pull-to-refresh for the PWA.
 *
 * This hook owns the pure touch logic only. A thin `<PullIndicator>` layer
 * in each screen renders the feedback glyph + i18n label; the hook just:
 *   1. Listens on a caller-provided container element (`bindContainer`).
 *   2. Starts tracking a potential pull only when `window.scrollY === 0` so
 *      we never fight native rubber-band scroll or inner scroll containers.
 *   3. Dampens the travel distance (0.5x) and caps at `maxPull` to mimic
 *      the iOS "pull stretches then stalls" feel without flooding `setState`.
 *   4. Crosses `threshold` → `ready` (release will refresh). Below → `pulling`.
 *   5. On touchend, if `ready` fires `onRefresh()` and returns to `idle` once
 *      the returned promise resolves (or synchronously if the caller returned
 *      void).
 *
 * Framer-motion coexistence (W6A): PTR must NOT be attached to the same node
 * that framer-motion animates (its `transform: translateY()` would get
 * overwritten every frame). Callers therefore bind the hook to an inner
 * wrapper that lives BELOW the motion.div. See resource-home / chat-inbox
 * integrations for the concrete pattern.
 *
 * Reduced-motion: the hook itself emits no animation — it only surfaces
 * `pullDistance` + `status`. The rendering layer (via `.ptr-indicator`) is
 * responsible for honouring `prefers-reduced-motion`. When callers want the
 * refresh to skip its animation entirely they can pass `disabled: true`
 * behind a `prefers-reduced-motion` media query and wire a plain refresh
 * button instead.
 *
 * Passive-listener strategy:
 *   - `touchstart`: `{ passive: true }` — we never need to cancel the initial
 *     touch, so let the browser optimise for scroll.
 *   - `touchmove` : `{ passive: false }` — only way to `preventDefault()` and
 *     stop the page from native-scrolling while we're driving the rubber-band.
 *     We only call `preventDefault()` AFTER the user has pulled more than
 *     20px from scrollTop=0 so accidental vertical micro-drags still let the
 *     page scroll as usual.
 *   - `touchend`  : passive default (we never need to cancel it).
 */

export type PullToRefreshStatus = 'idle' | 'pulling' | 'ready' | 'refreshing';

export interface UsePullToRefreshOptions {
  /** Refresh callback. May return a Promise; hook waits for it before idling. */
  onRefresh: () => Promise<unknown> | void;
  /** Travel (after damping) at which release will trigger refresh. Default 80. */
  threshold?: number;
  /** Maximum damped travel distance so the stretch doesn't run away. Default 120. */
  maxPull?: number;
  /** Switch the hook off (skips listener attach + no-ops touch callbacks). */
  disabled?: boolean;
}

export interface UsePullToRefreshResult {
  /** Current damped pull distance in px, 0..maxPull. */
  pullDistance: number;
  /** Lifecycle state machine — rendering layer uses this to swap labels. */
  status: PullToRefreshStatus;
  /** Ref callback to attach the listener to a container element. */
  bindContainer: (el: HTMLElement | null) => void;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<PullToRefreshStatus>('idle');

  // Container ref is stored in state so re-binding triggers the effect;
  // callbacks capture it via closure the moment the effect runs.
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // `bindContainer` is stable (useCallback) so attaching via React's ref
  // callback semantics doesn't churn on every parent re-render.
  const bindContainer = useCallback((el: HTMLElement | null) => {
    setContainer(el);
  }, []);

  // Latest values live in refs so the touch closures don't need to be
  // rebuilt on every state change (which would remove/re-add listeners and
  // drop in-flight pulls). Only `container` + `disabled` actually force
  // a listener rebind.
  const startYRef = useRef<number | null>(null);
  // `statusRef` mirrors `status` but is written synchronously inside the
  // same touch handler that triggered the transition. React may defer the
  // `setStatus()` commit until the next microtask, which is too late for
  // a follow-up `touchend` that needs to read "did we cross the threshold?".
  const statusRef = useRef<PullToRefreshStatus>('idle');
  const onRefreshRef = useRef(onRefresh);
  const thresholdRef = useRef(threshold);
  const maxPullRef = useRef(maxPull);

  // Keep refs in sync without using a useEffect so the next handler fired
  // in the same task sees the latest values.
  onRefreshRef.current = onRefresh;
  thresholdRef.current = threshold;
  maxPullRef.current = maxPull;

  const setStatusBoth = useCallback((next: PullToRefreshStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  useEffect(() => {
    if (!container || disabled) {
      return;
    }

    const handleTouchStart = (event: TouchEvent) => {
      // Only start tracking when the viewport is already at the top; any
      // ongoing refresh is also a no-op so double-pulls don't race.
      if (statusRef.current === 'refreshing') return;
      const scrollY =
        typeof window !== 'undefined'
          ? window.scrollY ?? window.pageYOffset ?? 0
          : 0;
      if (scrollY > 0) return;
      const touch = event.touches[0];
      if (!touch) return;
      startYRef.current = touch.clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (startYRef.current === null) return;
      const touch = event.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startYRef.current;
      if (delta <= 0) {
        // Upward swipe while we were tracking: abandon this gesture, let the
        // page scroll normally.
        if (statusRef.current !== 'idle') {
          setPullDistance(0);
          setStatusBoth('idle');
        }
        return;
      }
      // 0.5x damping keeps the stretch feel; cap at maxPull so giant pulls
      // don't desync the indicator layer.
      const damped = Math.min(delta * 0.5, maxPullRef.current);
      setPullDistance(damped);
      const nextStatus: PullToRefreshStatus =
        damped >= thresholdRef.current ? 'ready' : 'pulling';
      if (statusRef.current !== nextStatus) {
        setStatusBoth(nextStatus);
      }
      // Only suppress native scroll once the user has clearly committed to
      // a pull — below 20px we let the browser handle accidental drags.
      if (damped > 20 && event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      if (statusRef.current === 'ready') {
        setStatusBoth('refreshing');
        const maybePromise = onRefreshRef.current();
        Promise.resolve(maybePromise as Promise<unknown> | void)
          .catch(() => {
            // Caller owns error surfacing; the hook just unwinds UI state.
          })
          .finally(() => {
            setPullDistance(0);
            setStatusBoth('idle');
          });
      } else {
        setPullDistance(0);
        setStatusBoth('idle');
      }
    };

    const handleTouchCancel = () => {
      startYRef.current = null;
      setPullDistance(0);
      setStatusBoth('idle');
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchCancel);
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [container, disabled]);

  return {
    pullDistance,
    status,
    bindContainer,
  };
}
