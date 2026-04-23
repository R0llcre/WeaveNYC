/**
 * Inline atom — unit tests.
 *
 * Mirrors the Stack suite: lock in the horizontal-flex mapping contract
 * plus the `wrap` toggle. Keeping the two suites symmetric means when
 * someone touches the shared alignment maps, both regress in the same
 * visible way — a fast signal that the maps drift.
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

import { AppThemeProvider } from '@/theme';

import { Inline } from './Inline';
import { flattenStyle, getHostStyleByTestID } from './test-utils';

function renderUnderTheme(ui: React.ReactElement) {
  return TestRenderer.create(
    <AppThemeProvider override="light">{ui}</AppThemeProvider>,
  ).root;
}

describe('Inline atom', () => {
  test('renders as a row with `nowrap` by default', () => {
    const root = renderUnderTheme(
      <Inline testID="inline">
        <></>
      </Inline>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'inline'));
    expect(style.flexDirection).toBe('row');
    expect(style.flexWrap).toBe('nowrap');
    // Default gap is `sm` (12 px) — matches Stack for cross-axis parity.
    expect(style.gap).toBe(12);
  });

  test('default `align` is `center` (not `stretch` like Stack)', () => {
    // This default is load-bearing — icon-plus-label rows look broken
    // when vertical alignment slips. Guard it explicitly.
    const root = renderUnderTheme(
      <Inline testID="inline">
        <></>
      </Inline>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'inline'));
    expect(style.alignItems).toBe('center');
  });

  test('maps `justify` via the same vocabulary as Stack', () => {
    const root = renderUnderTheme(
      <Inline testID="inline" justify="around">
        <></>
      </Inline>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'inline'));
    expect(style.justifyContent).toBe('space-around');
  });

  test('`wrap` toggles flex-wrap', () => {
    const root = renderUnderTheme(
      <Inline testID="inline" wrap>
        <></>
      </Inline>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'inline'));
    expect(style.flexWrap).toBe('wrap');
  });

  test('resolves `gap` against the theme spacing scale', () => {
    const root = renderUnderTheme(
      <Inline testID="inline" gap="xl">
        <></>
      </Inline>,
    );
    const style = flattenStyle(getHostStyleByTestID(root, 'inline'));
    expect(style.gap).toBe(28); // theme.spacing.xl
  });
});
