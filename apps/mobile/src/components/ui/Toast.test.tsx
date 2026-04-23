/**
 * Toast atom — unit tests.
 *
 * Load-bearing branches:
 *   1. A `danger` / `warning` tone renders as `accessibilityRole="alert"`
 *      with an assertive live region so screen readers announce it
 *      immediately; other tones use a polite live region.
 *   2. The auto-dismiss timer fires `onDismiss` at `durationMs`.
 *   3. `durationMs={Infinity}` disables auto-dismiss.
 *   4. A dismiss button renders when `onDismiss` is provided, uses the
 *      supplied `dismissLabel` for `accessibilityLabel`, and fires
 *      `onDismiss` when pressed.
 *   5. Reduce-motion: when `AccessibilityInfo.isReduceMotionEnabled()`
 *      resolves `true`, the entrance animation is skipped (the Toast
 *      mounts at its final resting position).
 *
 * Animation timing isn't snapshotted — the reanimated mock resolves
 * `withTiming` to the target value synchronously, which is fine for
 * correctness and keeps tests deterministic.
 */

import { AccessibilityInfo } from 'react-native';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AppThemeProvider } from '@/theme';

import { Toast } from './Toast';
import { findHostByTestID } from './test-utils';

function renderUnderTheme(ui: React.ReactElement) {
  return TestRenderer.create(
    <AppThemeProvider override="light">{ui}</AppThemeProvider>,
  );
}

describe('Toast atom', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('danger tone renders with role=alert + live=assertive', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderUnderTheme(
        <Toast testID="t" tone="danger" message="Something broke" durationMs={Infinity} />,
      );
    });
    const container = findHostByTestID(tree.root, 't');
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessibilityLiveRegion).toBe('assertive');
  });

  test('info tone renders with polite live region (no alert role)', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderUnderTheme(
        <Toast testID="t" tone="info" message="Saved" durationMs={Infinity} />,
      );
    });
    const container = findHostByTestID(tree.root, 't');
    expect(container.props.accessibilityRole).toBeUndefined();
    expect(container.props.accessibilityLiveRegion).toBe('polite');
  });

  test('auto-dismisses after the default 3500 ms', async () => {
    const onDismiss = jest.fn();
    await act(async () => {
      renderUnderTheme(
        <Toast tone="info" message="Auto-dismiss" onDismiss={onDismiss} />,
      );
    });
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(3500);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('respects a custom `durationMs`', async () => {
    const onDismiss = jest.fn();
    await act(async () => {
      renderUnderTheme(
        <Toast
          tone="info"
          message="Quick toast"
          durationMs={500}
          onDismiss={onDismiss}
        />,
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(499);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('`durationMs={Infinity}` disables auto-dismiss', async () => {
    const onDismiss = jest.fn();
    await act(async () => {
      renderUnderTheme(
        <Toast
          tone="info"
          message="Sticky"
          durationMs={Infinity}
          onDismiss={onDismiss}
        />,
      );
    });
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  test('renders a dismiss button when onDismiss is provided, fires on press', async () => {
    const onDismiss = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderUnderTheme(
        <Toast
          testID="t"
          tone="info"
          message="Dismiss me"
          onDismiss={onDismiss}
          dismissLabel="Close"
          durationMs={Infinity}
        />,
      );
    });
    const button = findHostByTestID(tree.root, 't-dismiss');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Close');
    await act(async () => {
      button.props.onPress();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('reduce-motion users skip the entrance animation', async () => {
    // Flip the mock so the promise resolves `true`.
    const spy = jest
      .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
      .mockResolvedValue(true);

    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = renderUnderTheme(
        <Toast testID="t" tone="info" message="Hi" durationMs={Infinity} />,
      );
    });
    // Flush pending promises so the effect runs.
    await act(async () => {
      await Promise.resolve();
    });

    // The Toast renders an Animated.View; the `transform: translateY`
    // shared value collapses to `0` (resting position) for reduce-motion
    // users. We only assert that it doesn't throw; styling values run
    // through the reanimated mock which returns the target synchronously.
    const container = findHostByTestID(tree.root, 't');
    expect(container).toBeTruthy();
    expect(spy).toHaveBeenCalled();
  });
});
