/**
 * Field atom — unit tests.
 *
 * Covers the three interesting branches of the atom:
 *   1. Baseline render — label and input ship with the expected a11y wiring.
 *   2. Hint — shown when present, suppressed when an error also exists
 *      (errors outrank hints so screen readers don't get double-spoken).
 *   3. Error — surfaces the message with `accessibilityRole="alert"` so
 *      assistive tech picks up the correction on change.
 *
 * Style assertions stay minimal (border flip on error) because the atom's
 * visual surface is mostly theme-driven and would snapshot-break on any
 * token change; the a11y contract is the load-bearing part.
 */

import React from 'react';
import TestRenderer from 'react-test-renderer';

import { AppThemeProvider } from '@/theme';

import { Field } from './Field';
import { findHostByTestID, flattenStyle } from './test-utils';

function renderUnderTheme(ui: React.ReactElement) {
  return TestRenderer.create(
    <AppThemeProvider override="light">{ui}</AppThemeProvider>,
  ).root;
}

describe('Field atom', () => {
  test('renders the label, input, and derives accessibilityLabel from label', () => {
    const root = renderUnderTheme(
      <Field
        testID="email"
        label="Email"
        value=""
        onChangeText={() => {}}
      />,
    );
    const container = findHostByTestID(root, 'email');
    expect(container).toBeTruthy();

    // The label is a 'Text' host node containing the string 'Email'.
    const texts = root.findAllByType('Text' as never);
    const labelNode = texts.find((t) => t.children?.[0] === 'Email');
    expect(labelNode).toBeDefined();

    // The input exposes `accessibilityLabel="Email"` even though the label
    // is a sibling node rather than a descendent — that's the key a11y
    // contract for TalkBack / VoiceOver.
    const input = root.findByType('TextInput' as never);
    expect(input.props.accessibilityLabel).toBe('Email');
    expect(input.props.value).toBe('');
  });

  test('forwards keyboardType / autoCapitalize / secureTextEntry to the TextInput', () => {
    const root = renderUnderTheme(
      <Field
        label="Password"
        value="hunter2"
        onChangeText={() => {}}
        keyboardType="email-address"
        autoCapitalize="none"
        secureTextEntry
      />,
    );
    const input = root.findByType('TextInput' as never);
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoCapitalize).toBe('none');
    expect(input.props.secureTextEntry).toBe(true);
  });

  test('renders a hint below the input when no error is set', () => {
    const root = renderUnderTheme(
      <Field
        label="Phone"
        hint="We only use this for anchor calls."
        value=""
        onChangeText={() => {}}
      />,
    );
    const texts = root.findAllByType('Text' as never);
    const hintNode = texts.find(
      (t) => t.children?.[0] === 'We only use this for anchor calls.',
    );
    expect(hintNode).toBeDefined();
  });

  test('renders error text with accessibilityRole="alert" and suppresses the hint', () => {
    const root = renderUnderTheme(
      <Field
        label="ZIP code"
        hint="5 digits"
        error="Must be a valid NYC ZIP"
        value="123"
        onChangeText={() => {}}
      />,
    );
    const texts = root.findAllByType('Text' as never);
    const errorNode = texts.find(
      (t) => t.children?.[0] === 'Must be a valid NYC ZIP',
    );
    expect(errorNode).toBeDefined();
    expect(errorNode?.props.accessibilityRole).toBe('alert');
    // Hint is hidden when error is present.
    expect(
      texts.find((t) => t.children?.[0] === '5 digits'),
    ).toBeUndefined();
  });

  test('input border flips to the `danger` token when error is set', () => {
    const rootWithError = renderUnderTheme(
      <Field
        label="ZIP code"
        error="bad"
        value=""
        onChangeText={() => {}}
      />,
    );
    const input = rootWithError.findByType('TextInput' as never);
    const style = flattenStyle(input.props.style);
    // `danger` token in the light theme is the deep red `#8b2a2a`.
    expect(style.borderColor).toBe('#8b2a2a');
  });
});
