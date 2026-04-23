/**
 * EmptyState atom — unit tests.
 *
 * Coverage:
 *   1. Title renders; subtitle optional.
 *   2. `illustrationName` is exposed on a nested testID so layout tests
 *      can assert "this empty state shows the right slot" without needing
 *      the real SVG (which M4a will wire in).
 *   3. `tone="error"` flips the container to `accessibilityRole="alert"`
 *      + `accessibilityLiveRegion="polite"` so failures announce.
 *   4. CTA fires `onPress` and renders the supplied label.
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

import { AppThemeProvider } from '@/theme';

import { EmptyState } from './EmptyState';
import { findHostByTestID } from './test-utils';

function renderUnderTheme(ui: React.ReactElement) {
  return TestRenderer.create(
    <AppThemeProvider override="light">{ui}</AppThemeProvider>,
  ).root;
}

describe('EmptyState atom', () => {
  test('renders the title and optional subtitle', () => {
    const root = renderUnderTheme(
      <EmptyState
        title="No results"
        subtitle="Try widening your search radius."
      />,
    );
    const texts = root.findAllByType('Text' as never);
    expect(texts.find((t) => t.children?.[0] === 'No results')).toBeDefined();
    expect(
      texts.find((t) => t.children?.[0] === 'Try widening your search radius.'),
    ).toBeDefined();
  });

  test('exposes the illustration name on a testID suffix so layout tests can target it', () => {
    const root = renderUnderTheme(
      <EmptyState
        testID="empty"
        title="Still searching"
        illustrationName="compass"
      />,
    );
    // Container is findable by outer testID.
    expect(findHostByTestID(root, 'empty')).toBeTruthy();
    // Illustration slot is findable by `<testID>-illustration-<name>`.
    expect(
      findHostByTestID(root, 'empty-illustration-compass'),
    ).toBeTruthy();
    // The illustration name is also rendered as a visible label (M4a will
    // swap this for the SVG). We assert the text node exists.
    const texts = root.findAllByType('Text' as never);
    expect(texts.find((t) => t.children?.[0] === 'compass')).toBeDefined();
  });

  test('tone="error" sets accessibilityRole="alert" on the container', () => {
    const root = renderUnderTheme(
      <EmptyState testID="empty" title="Load failed" tone="error" />,
    );
    const container = findHostByTestID(root, 'empty');
    expect(container.props.accessibilityRole).toBe('alert');
    expect(container.props.accessibilityLiveRegion).toBe('polite');
  });

  test('tone="info" (default) is silent for assistive tech', () => {
    const root = renderUnderTheme(
      <EmptyState testID="empty" title="Nothing yet" />,
    );
    const container = findHostByTestID(root, 'empty');
    expect(container.props.accessibilityRole).toBeUndefined();
    expect(container.props.accessibilityLiveRegion).toBe('none');
  });

  test('cta fires onPress and renders the label text', () => {
    const onPress = jest.fn();
    const root = renderUnderTheme(
      <EmptyState
        title="Empty"
        cta={{ label: 'Reload', onPress, testID: 'reload-btn' }}
      />,
    );
    const button = findHostByTestID(root, 'reload-btn');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Reload');
    // Invoke the Pressable handler directly.
    button.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
