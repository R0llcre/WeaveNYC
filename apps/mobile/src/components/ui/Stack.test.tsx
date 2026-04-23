/**
 * Stack atom — unit tests.
 *
 * Goal: lock in the mapping contract between the friendly prop vocabulary
 * (`gap="m"`, `align="center"`, `justify="between"`) and the raw flex
 * style values that ship out to the native renderer. If someone changes
 * the alignment maps by accident (e.g. inverting `start` ↔ `end`) every
 * screen downstream flips its layout; these tests block the regression.
 *
 * We render with `react-test-renderer` directly (not RNTL): `@testing-
 * library/react-native` relies on runtime detection of the real RN host
 * component names, which our thin stub can't provide. The raw renderer
 * is sufficient — we only need to read `props.style` off the rendered
 * host View, not query by role.
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

import { AppThemeProvider } from '@/theme';

import { Stack } from './Stack';
import { flattenStyle, getHostStyleByTestID } from './test-utils';

function renderUnderTheme(ui: React.ReactElement) {
  return TestRenderer.create(
    <AppThemeProvider override="light">{ui}</AppThemeProvider>,
  ).root;
}

describe('Stack atom', () => {
  test('renders as a column with default gap token', () => {
    const root = renderUnderTheme(
      <Stack testID="stack">
        <></>
      </Stack>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'stack'));
    expect(style.flexDirection).toBe('column');
    // Default `sm` spacing token = 12 px (see src/theme/tokens.ts).
    expect(style.gap).toBe(12);
  });

  test('resolves `gap` against the theme spacing scale', () => {
    const root = renderUnderTheme(
      <Stack testID="stack" gap="l">
        <></>
      </Stack>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'stack'));
    expect(style.gap).toBe(24); // theme.spacing.l
  });

  test('maps `align` → `alignItems` via the flex vocabulary', () => {
    const root = renderUnderTheme(
      <Stack testID="stack" align="end">
        <></>
      </Stack>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'stack'));
    expect(style.alignItems).toBe('flex-end');
  });

  test('maps `justify="between"` → `space-between`', () => {
    const root = renderUnderTheme(
      <Stack testID="stack" justify="between">
        <></>
      </Stack>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'stack'));
    expect(style.justifyContent).toBe('space-between');
  });

  test('merges consumer-supplied style AFTER the Stack-computed style', () => {
    const root = renderUnderTheme(
      <Stack testID="stack" gap="m" style={{ paddingHorizontal: 8 }}>
        <></>
      </Stack>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'stack'));
    expect(style.gap).toBe(16); // theme.spacing.m
    expect(style.paddingHorizontal).toBe(8);
  });
});
