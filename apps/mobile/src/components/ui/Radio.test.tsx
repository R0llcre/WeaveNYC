/**
 * Radio + RadioGroup atom — unit tests.
 *
 * Locks three behaviours:
 *   1. `accessibilityRole="radio"` + `accessibilityState.checked` mirrors
 *      the derived checked state (from the group's selectedValue). The
 *      group itself carries the `radiogroup` role so AT announces the
 *      set boundary when swiping into the form.
 *   2. Group selection semantics — tapping an unselected radio fires
 *      the group's onChange with that radio's value; tapping the already-
 *      selected radio does NOT re-fire onChange (mutual exclusion + no
 *      spurious re-renders).
 *   3. Haptic fires on EVERY tap — even re-selection taps — so users
 *      always get tactile confirmation that the tap registered.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Radio, RadioGroup } from './Radio';

jest.mock('./haptic', () => ({
  triggerHaptic: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { triggerHaptic } = require('./haptic') as {
  triggerHaptic: jest.Mock;
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<Radio /> + <RadioGroup />', () => {
  beforeEach(() => {
    triggerHaptic.mockClear();
  });

  test('group exposes radiogroup role; each Radio exposes radio + reflects selectedValue', () => {
    renderWithTheme(
      <RadioGroup value="b" onChange={() => {}} testID="grp">
        <Radio value="a" label="A" testID="r-a" />
        <Radio value="b" label="B" testID="r-b" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('grp').props.accessibilityRole).toBe('radiogroup');

    const a = screen.getByTestId('r-a');
    const b = screen.getByTestId('r-b');
    expect(a.props.accessibilityRole).toBe('radio');
    expect(a.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
    expect(b.props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  test('tapping an unselected Radio fires group.onChange(value); tapping selected is a no-op for onChange', () => {
    const onChange = jest.fn();
    renderWithTheme(
      <RadioGroup value="b" onChange={onChange}>
        <Radio value="a" label="A" testID="r-a" />
        <Radio value="b" label="B" testID="r-b" />
      </RadioGroup>,
    );

    // Unselected → fires with new value.
    fireEvent.press(screen.getByTestId('r-a'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('a');

    // Already-selected → no re-emit (mutual exclusion).
    fireEvent.press(screen.getByTestId('r-b'));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('haptic fires on every tap, including re-selection of the selected option', () => {
    renderWithTheme(
      <RadioGroup value="a" onChange={() => {}}>
        <Radio value="a" label="A" testID="r-a" />
        <Radio value="b" label="B" testID="r-b" />
      </RadioGroup>,
    );

    fireEvent.press(screen.getByTestId('r-a')); // already selected — still haptic
    fireEvent.press(screen.getByTestId('r-b')); // new selection — still haptic
    expect(triggerHaptic).toHaveBeenCalledTimes(2);
    // Each tap routes through the Light tier.
    expect(triggerHaptic).toHaveBeenNthCalledWith(1, 30);
    expect(triggerHaptic).toHaveBeenNthCalledWith(2, 30);
  });
});
