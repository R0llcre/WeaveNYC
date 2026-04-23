/**
 * Checkbox atom — unit tests.
 *
 * Locks the a11y + haptic + disabled contract:
 *   1. `accessibilityRole="checkbox"` + `accessibilityState.checked`
 *      mirrors the `checked` prop (web parity for `aria-checked`).
 *   2. Press fires `onChange(!checked)` AND calls through to the haptic
 *      wrapper at the Light tier (30ms → Light per haptic.ts table).
 *   3. `disabled` short-circuits both the handler and the haptic — a
 *      disabled checkbox never silently "half-fires" its effects.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Checkbox } from './Checkbox';

// Spy the local haptic wrapper at module level — atoms import it sibling-
// to-sibling so we intercept at the module layer and assert the Checkbox
// wired the call through.
jest.mock('./haptic', () => ({
  triggerHaptic: jest.fn(),
}));

const { triggerHaptic } = require('./haptic') as {
  triggerHaptic: jest.Mock;
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<Checkbox />', () => {
  beforeEach(() => {
    triggerHaptic.mockClear();
  });

  test('exposes checkbox role and mirrors checked into accessibilityState', () => {
    renderWithTheme(
      <Checkbox checked onChange={() => {}} label="Agree" testID="c-on" />,
    );
    const on = screen.getByTestId('c-on');
    expect(on.props.accessibilityRole).toBe('checkbox');
    expect(on.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );

    renderWithTheme(
      <Checkbox
        checked={false}
        onChange={() => {}}
        label="Agree"
        testID="c-off"
      />,
    );
    expect(
      screen.getByTestId('c-off').props.accessibilityState,
    ).toEqual(expect.objectContaining({ checked: false }));
  });

  test('press fires onChange(!checked) and triggers a Light haptic', () => {
    const onChange = jest.fn();
    renderWithTheme(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Subscribe"
        testID="c"
      />,
    );
    fireEvent.press(screen.getByTestId('c'));

    // next boolean is the TOGGLED value — not the current one.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
    // Duration maps to Light per haptic.ts (21-40ms window).
    expect(triggerHaptic).toHaveBeenCalledTimes(1);
    expect(triggerHaptic).toHaveBeenCalledWith(30);
  });

  test('disabled: press is a no-op for both onChange and haptic', () => {
    const onChange = jest.fn();
    renderWithTheme(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Locked"
        disabled
        testID="c-disabled"
      />,
    );
    fireEvent.press(screen.getByTestId('c-disabled'));

    expect(onChange).not.toHaveBeenCalled();
    expect(triggerHaptic).not.toHaveBeenCalled();
  });
});
