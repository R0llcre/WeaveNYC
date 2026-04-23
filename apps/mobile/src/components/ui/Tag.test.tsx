/**
 * Tag atom — unit tests.
 *
 * Tag is read-only; the important checks are:
 *   1. Label renders (basic render correctness).
 *   2. Tag does NOT expose a `button` role — locking the "not interactive"
 *      contract. Regressing this would cause AT to announce Tags as
 *      buttons and confuse users.
 *   3. Tone prop flips the surface colour so downstream screens actually
 *      get the differentiated chip fills the designers committed to.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider, theme as lightTheme } from '@/theme';

import { Tag } from './Tag';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

/** Flatten a StyleProp<ViewStyle> cascade into one object for assertions. */
function flattenStyle(style: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  function walk(s: unknown) {
    if (!s) return;
    if (Array.isArray(s)) {
      s.forEach(walk);
      return;
    }
    if (typeof s === 'object') {
      Object.assign(out, s as Record<string, unknown>);
    }
  }
  walk(style);
  return out;
}

describe('<Tag />', () => {
  test('renders its label', () => {
    renderWithTheme(<Tag testID="tag">Food pantry</Tag>);
    expect(screen.getByTestId('tag')).toBeDefined();
    expect(screen.getByText('Food pantry')).toBeDefined();
  });

  test('is NOT interactive — no button role, no press handler', () => {
    renderWithTheme(<Tag testID="tag">Verified</Tag>);
    const node = screen.getByTestId('tag');
    expect(node.props.accessibilityRole).toBeUndefined();
    // Defensive: Tag is a read-only View; press handlers must not leak in.
    expect(node.props.onPress).toBeUndefined();
  });

  test('tone selects the expected surface token', () => {
    renderWithTheme(
      <Tag tone="verified" testID="verified-tag">
        Verified anchor
      </Tag>,
    );
    const verifiedStyle = flattenStyle(
      screen.getByTestId('verified-tag').props.style,
    );
    expect(verifiedStyle.backgroundColor).toBe(
      lightTheme.colors.verifiedSoft,
    );

    renderWithTheme(
      <Tag tone="urgent" testID="urgent-tag">
        Closes today
      </Tag>,
    );
    const urgentStyle = flattenStyle(
      screen.getByTestId('urgent-tag').props.style,
    );
    expect(urgentStyle.backgroundColor).toBe(lightTheme.colors.urgentSoft);
  });
});
