/**
 * @vitest-environment jsdom
 *
 * Unit tests for `usePullToRefresh` — the Wave 6B touch hook.
 *
 * Scope:
 *   - Pure touch lifecycle (start → move → end transitions)
 *   - `onRefresh` only fires when damped distance crosses `threshold`
 *   - `disabled` flag is a hard switch (no listeners attached)
 *   - `window.scrollY > 0` skips the gesture (no accidental refresh mid-scroll)
 *   - Upward swipe aborts a running pull
 *   - Damping clamps at `maxPull`
 *   - Status reaches 'refreshing' before resolving, then returns to 'idle'
 *
 * jsdom caveats: Touch is not constructed with `new Touch(...)` in jsdom 25,
 * so we dispatch synthetic TouchEvents with a plain object shape in the
 * `touches` array. The hook only reads `touches[0].clientY`, so that's all
 * we model.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePullToRefresh } from './use-pull-to-refresh';

/**
 * Minimal synthetic TouchEvent factory — jsdom does not implement the Touch
 * constructor, so we fall back to dispatching a plain `Event` that carries
 * the `touches` array the hook reads. `cancelable: true` is required so
 * `preventDefault()` is a no-op rather than throwing.
 */
function dispatchTouch(
  el: HTMLElement,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  clientY: number,
): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  // Attach a touches array shaped like TouchList enough for our hook reads.
  Object.defineProperty(event, 'touches', {
    value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientY }],
  });
  el.dispatchEvent(event);
}

/**
 * Fully exercise a pull gesture: touchstart at 0 → touchmove to `toY`
 * → touchend. `toY` is the raw finger delta; the hook damps by 0.5x so the
 * displayed distance is toY/2 (capped at maxPull). The hook writes statusRef
 * synchronously so all three phases can share one `act()` call.
 */
function performPull(el: HTMLElement, toY: number): void {
  dispatchTouch(el, 'touchstart', 0);
  dispatchTouch(el, 'touchmove', toY);
  dispatchTouch(el, 'touchend', toY);
}

describe('usePullToRefresh', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('starts in idle with zero pull distance', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
    act(() => result.current.bindContainer(container));
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);
  });

  it('transitions idle → pulling → ready as the finger passes threshold', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    act(() => dispatchTouch(container, 'touchstart', 0));
    // 100px raw = 50px damped → still below 80 threshold → 'pulling'
    act(() => dispatchTouch(container, 'touchmove', 100));
    expect(result.current.status).toBe('pulling');
    expect(result.current.pullDistance).toBe(50);

    // 200px raw = 100px damped → above 80 threshold → 'ready'
    act(() => dispatchTouch(container, 'touchmove', 200));
    expect(result.current.status).toBe('ready');
    expect(result.current.pullDistance).toBe(100);
  });

  it('fires onRefresh only when released past threshold', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    // Release below threshold — no refresh
    act(() => performPull(container, 40));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);

    // Release above threshold — refresh fires exactly once
    await act(async () => {
      performPull(container, 200);
      // Flush microtasks for the .finally() branch in the hook
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);
  });

  it('shows refreshing state while the promise is in flight, then idles on resolve', async () => {
    let resolveFn: (() => void) | undefined;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    act(() => performPull(container, 300));
    expect(result.current.status).toBe('refreshing');
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFn?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);
  });

  it('swallows onRefresh rejections and still returns to idle', async () => {
    const onRefresh = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    await act(async () => {
      performPull(container, 300);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');
  });

  it('skips the gesture entirely when disabled', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, disabled: true }),
    );
    act(() => result.current.bindContainer(container));

    act(() => performPull(container, 400));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);
  });

  it('ignores the pull when the page is already scrolled', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));
    Object.defineProperty(window, 'scrollY', { value: 120, writable: true, configurable: true });

    act(() => performPull(container, 400));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('aborts the pull when the user reverses direction', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    act(() => dispatchTouch(container, 'touchstart', 0));
    act(() => dispatchTouch(container, 'touchmove', 200));
    expect(result.current.status).toBe('ready');
    // Reverse: finger goes back above the anchor
    act(() => dispatchTouch(container, 'touchmove', -20));
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);

    act(() => dispatchTouch(container, 'touchend', -20));
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('clamps the damped distance at maxPull', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80, maxPull: 120 }),
    );
    act(() => result.current.bindContainer(container));

    // 1000px raw → 500px damped but clamped to 120.
    act(() => dispatchTouch(container, 'touchstart', 0));
    act(() => dispatchTouch(container, 'touchmove', 1000));
    expect(result.current.pullDistance).toBe(120);
  });

  it('resets cleanly on touchcancel', () => {
    const onRefresh = vi.fn();
    const { result } = renderHook(() =>
      usePullToRefresh({ onRefresh, threshold: 80 }),
    );
    act(() => result.current.bindContainer(container));

    act(() => dispatchTouch(container, 'touchstart', 0));
    act(() => dispatchTouch(container, 'touchmove', 200));
    expect(result.current.status).toBe('ready');
    act(() => dispatchTouch(container, 'touchcancel', 0));
    expect(result.current.status).toBe('idle');
    expect(result.current.pullDistance).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
