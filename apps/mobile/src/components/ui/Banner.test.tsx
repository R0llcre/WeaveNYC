/**
 * Banner atom — unit tests.
 *
 * Focus on the contracts that drift easily during refactors:
 *   1. Tone maps to the correct a11y role + live-region urgency (info /
 *      success = polite summary, warning / danger = assertive alert).
 *   2. `onDismiss` + `dismissLabel` together render a dismiss button that
 *      exposes the localised label to AT and fires the callback on press.
 *   3. `actionLabel` + `onAction` render an inline action pill that fires
 *      when tapped; the action is optional (omitting it hides the button).
 *
 * The "must provide `dismissLabel` when `onDismiss` is set" contract is a
 * *compile-time* check on the discriminated union, so it doesn't need a
 * runtime test — the TS suite in CI will reject any violating call site.
 */
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '@/theme';

import { Banner } from './Banner';

function renderWithTheme(ui: React.ReactElement) {
  return render(<AppThemeProvider>{ui}</AppThemeProvider>);
}

describe('<Banner />', () => {
  test('info tone renders polite summary, warning tone renders assertive alert', () => {
    renderWithTheme(
      <Banner tone="info" title="Creating session" testID="banner-info" />,
    );
    const info = screen.getByTestId('banner-info');
    expect(info.props.accessibilityRole).toBe('summary');
    expect(info.props.accessibilityLiveRegion).toBe('polite');

    renderWithTheme(
      <Banner
        tone="warning"
        title="Verification required"
        testID="banner-warn"
      />,
    );
    const warn = screen.getByTestId('banner-warn');
    expect(warn.props.accessibilityRole).toBe('alert');
    expect(warn.props.accessibilityLiveRegion).toBe('assertive');
  });

  test('dismiss button uses dismissLabel and fires onDismiss on press', () => {
    const onDismiss = jest.fn();
    renderWithTheme(
      <Banner
        tone="danger"
        title="Network failure"
        onDismiss={onDismiss}
        dismissLabel="Close banner"
        testID="banner"
      />,
    );

    // The glyph is visual-only; AT reads the accessibilityLabel.
    const closeButton = screen.getByLabelText('Close banner');
    expect(closeButton).toBeDefined();
    fireEvent.press(closeButton);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('actionLabel renders the action pill and fires onAction', () => {
    const onAction = jest.fn();
    renderWithTheme(
      <Banner
        tone="warning"
        title="Connection lost"
        actionLabel="Retry"
        onAction={onAction}
        testID="banner"
      />,
    );

    fireEvent.press(screen.getByLabelText('Retry'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
