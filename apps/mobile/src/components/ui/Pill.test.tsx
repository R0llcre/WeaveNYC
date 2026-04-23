/**
 * Pill atom — unit tests.
 *
 * Locks the a11y + touch-target + haptic contract:
 *   1. `accessibilityRole="button"` (toggle host) and `selected` prop flows
 *      into `accessibilityState.selected` so AT announces "selected" /
 *      "not selected" — web parity for `aria-pressed`.
 *   2. `hitSlop` is 8 — the 44x44 minimum the iOS HIG requires. Regressing
 *      this is easy on a refactor; the test locks it.
 *   3. Press fires `onPress` AND triggers a selection-level haptic, so
 *      the mobile ack on toggle stays present.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Pill } from './Pill';

// Spy the haptic wrapper at module level — the Pill imports it sibling-to-
// sibling, so we can assert the atom wired the call through without poking
// at expo-haptics' internals.
jest.mock('./haptic', () => ({
  triggerHaptic: jest.fn(),
}));

const { triggerHaptic } = require('./haptic') as {
  triggerHaptic: jest.Mock;
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<Pill />', () => {
  beforeEach(() => {
    triggerHaptic.mockClear();
  });

  test('exposes button role and mirrors selected into accessibilityState', () => {
    renderWithTheme(
      <Pill selected testID="pill-on">
        Food
      </Pill>,
    );
    const pillOn = screen.getByTestId('pill-on');
    expect(pillOn.props.accessibilityRole).toBe('button');
    expect(pillOn.props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );

    renderWithTheme(
      <Pill selected={false} testID="pill-off">
        Food
      </Pill>,
    );
    expect(
      screen.getByTestId('pill-off').props.accessibilityState,
    ).toEqual(expect.objectContaining({ selected: false }));
  });

  test('sets hitSlop to 8 so the tap target clears 44x44', () => {
    renderWithTheme(
      <Pill testID="pill">
        Chip
      </Pill>,
    );
    expect(screen.getByTestId('pill').props.hitSlop).toBe(8);
  });

  test('press fires onPress AND triggers a haptic', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <Pill onPress={onPress} testID="pill">
        Tap
      </Pill>,
    );

    fireEvent.press(screen.getByTestId('pill'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledTimes(1);
    // Argument is the duration in ms — Pill uses the selection tier (<= 20).
    expect(triggerHaptic).toHaveBeenCalledWith(10);
  });
});
