/**
 * Icon atom — unit tests.
 *
 * Covers the contract the rest of the UI depends on:
 *   1. Renders with the correct size pixel dimensions per `size` prop so
 *      layout doesn't shift when a caller chooses sm/md/lg.
 *   2. Without a `label`, the icon is decorative — AT hides it. With a
 *      `label`, the icon flips to `accessibilityRole="image"` and
 *      announces the string (the "name" placeholder fallback also still
 *      sets `accessibilityLabel` for dev-time triage).
 *   3. Even when the registry doesn't resolve a component (M4a-1
 *      placeholder branch), the atom renders a same-sized View with
 *      `accessibilityLabel` set to the name as a last-resort breadcrumb
 *      for VoiceOver / Accessibility Inspector.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';
import { Icon } from './Icon';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<Icon />', () => {
  test('renders at the size prop pixel scale (md = 20)', () => {
    renderWithTheme(<Icon name="food" testID="icon" />);
    const node = screen.getByTestId('icon');
    // Style is an array; flatten to read width/height.
    const style = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(style.width).toBe(20);
    expect(style.height).toBe(20);
  });

  test('sm size resolves to 16px, lg to 24px — no off-by-one on boundaries', () => {
    const { rerender } = renderWithTheme(
      <Icon name="food" size="sm" testID="icon" />,
    );
    let node = screen.getByTestId('icon');
    let style = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(style.width).toBe(16);

    rerender(
      <AppThemeProvider>
        <Icon name="food" size="lg" testID="icon" />
      </AppThemeProvider>,
    );
    node = screen.getByTestId('icon');
    style = Array.isArray(node.props.style)
      ? Object.assign({}, ...node.props.style.filter(Boolean))
      : node.props.style;
    expect(style.width).toBe(24);
  });

  test('decorative (no label) hides the icon from AT', () => {
    renderWithTheme(<Icon name="food" testID="icon" />);
    const node = screen.getByTestId('icon');
    // Without `label`, the icon is decorative: `accessible={false}`
    // keeps the element in the render tree (so layout / snapshot tests
    // can still find it) but tells AT to skip it. See Icon.tsx docblock
    // for the rationale vs the heavier-handed
    // `accessibilityElementsHidden` / `importantForAccessibility` flags.
    expect(node.props.accessible).toBe(false);
    // `accessibilityRole` must not be "image" — that would re-expose it.
    expect(node.props.accessibilityRole).not.toBe('image');
  });

  test('with label, becomes an image role + announces the label', () => {
    renderWithTheme(
      <Icon name="food" label="Food pantry" testID="icon" />,
    );
    const node = screen.getByTestId('icon');
    expect(node.props.accessibilityRole).toBe('image');
    expect(node.props.accessibilityLabel).toBe('Food pantry');
  });

  test('registry-miss fallback labels the placeholder with the name', () => {
    // Shim exports only the type, so at runtime `icons[name]` is
    // undefined → the placeholder branch runs. Even decorative icons in
    // this state expose the name to AT as a last-resort breadcrumb so
    // Accessibility Inspector can surface missing glyphs.
    renderWithTheme(<Icon name="chevron-right" testID="icon" />);
    const node = screen.getByTestId('icon');
    expect(node.props.accessibilityLabel).toBe('chevron-right');
  });
});
