/**
 * IconButton atom — unit tests.
 *
 * Covers the three behaviours we'd rather not regress silently:
 *   1. Press fires `onPress` AND routes through `triggerHaptic` at the
 *      Light-impact level — the core affordance + the iOS tactile
 *      contract.
 *   2. `haptic={false}` disables the impact call (a battery / UX escape
 *      hatch that's easy to break on a future press-handler tweak).
 *   3. `disabled` blocks BOTH the press handler and the haptic — buzzing
 *      a disabled control would falsely signal "that worked".
 *   4. The atom guarantees the 44×44 hit area at every size variant via
 *      a combination of visible size + `hitSlop`.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { AppThemeProvider } from '@/theme';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<IconButton />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fires onPress and a Light-impact haptic by default', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <IconButton
        accessibilityLabel="Save"
        onPress={onPress}
        testID="btn"
      >
        <Icon name="bookmark" />
      </IconButton>,
    );

    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
    // triggerHaptic(30) → Light impact per haptic.ts mapping.
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
  });

  test('haptic={false} disables the impact call; press still fires', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <IconButton
        accessibilityLabel="Mute"
        haptic={false}
        onPress={onPress}
        testID="btn"
      >
        <Icon name="chat" />
      </IconButton>,
    );

    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  test('disabled blocks the press AND skips the haptic', () => {
    const onPress = jest.fn();
    renderWithTheme(
      <IconButton
        accessibilityLabel="Share"
        disabled
        onPress={onPress}
        testID="btn"
      >
        <Icon name="share" />
      </IconButton>,
    );

    fireEvent.press(screen.getByTestId('btn'));
    // Press is a no-op in disabled state.
    expect(onPress).not.toHaveBeenCalled();
    // And the haptic MUST NOT fire — buzzing a disabled control would
    // falsely signal the action succeeded.
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });

  test('44x44 hit area: sm visible + hitSlop 8 → 44 effective', () => {
    renderWithTheme(
      <IconButton
        accessibilityLabel="Back"
        size="sm"
        testID="btn"
      >
        <Icon name="chevron-right" />
      </IconButton>,
    );
    const node = screen.getByTestId('btn');
    // Pressable receives `style` as a function — call it with a
    // neutral `pressed=false` to resolve the array, then flatten so we
    // can read width/height. This mirrors how the real RN renderer
    // invokes the function before passing styles to the view tree.
    const styleFn = node.props.style;
    const resolved =
      typeof styleFn === 'function' ? styleFn({ pressed: false }) : styleFn;
    const style = Array.isArray(resolved)
      ? Object.assign({}, ...resolved.filter(Boolean))
      : resolved;
    // sm visible chrome is 28px; hitSlop of 8 on each side → 44×44
    // effective (28 + 2*8). md would be 36 + 2*4, lg 44 + 0.
    expect(style.width).toBe(28);
    expect(style.height).toBe(28);
    expect(node.props.hitSlop).toBe(8);
  });

  test('accessibilityLabel is forwarded to the Pressable', () => {
    renderWithTheme(
      <IconButton
        accessibilityLabel="Bookmark this resource"
        testID="btn"
      >
        <Icon name="bookmark" />
      </IconButton>,
    );
    const node = screen.getByTestId('btn');
    expect(node.props.accessibilityLabel).toBe('Bookmark this resource');
    expect(node.props.accessibilityRole).toBe('button');
  });
});
