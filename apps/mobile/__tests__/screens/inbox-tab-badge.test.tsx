/**
 * InboxTabBadge — unit tests.
 *
 * The badge is the mobile twin of `contact-inbox-link.tsx` — it mounts
 * into the tab bar and shows the count of pending contact requests. It's
 * small enough to render fully under the existing RN test stubs (no
 * file-read fallback needed).
 *
 * Two tests:
 *
 *   1. Renders `null` when the user is anonymous/unverified — no badge,
 *      no pre-auth leakage.
 *   2. Renders the pending count when verified + pending > 0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Provider as ReduxProvider } from 'react-redux';

import { InboxTabBadge } from '@/components/InboxTabBadge';
import { AppThemeProvider } from '@/theme';

// Mock the hooks module so the test doesn't need to stand up TanStack
// Query + a real backend. We reset the mock between tests so anonymous
// vs verified states are isolated.
jest.mock('@/lib/hooks', () => ({
  useAppSelector: jest.fn(),
  useContactRequestsInbox: jest.fn(),
}));
jest.mock('@/lib/selectors', () => ({
  selectIsVerified: jest.fn(),
  selectSession: jest.fn(),
}));

// Minimal Redux store — only needed because `useAppSelector` is typed
// against the store; the mock short-circuits the selectors so the store
// contents aren't actually read.
import { configureStore } from '@reduxjs/toolkit';
const emptyStore = configureStore({ reducer: { noop: (s = {}) => s } });

import * as hooks from '@/lib/hooks';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ReduxProvider store={emptyStore as never}>
      <AppThemeProvider>{ui}</AppThemeProvider>
    </ReduxProvider>,
  );
}

describe('<InboxTabBadge />', () => {
  beforeEach(() => {
    (hooks.useAppSelector as jest.Mock).mockReset();
    (hooks.useContactRequestsInbox as jest.Mock).mockReset();
  });

  test('renders nothing when the user is unverified', () => {
    // useAppSelector is called twice: session, then isVerified. Return
    // falsy for both so the gate triggers the early-return `null`.
    (hooks.useAppSelector as jest.Mock)
      .mockReturnValueOnce(null) // selectSession
      .mockReturnValueOnce(false); // selectIsVerified
    (hooks.useContactRequestsInbox as jest.Mock).mockReturnValue({
      data: undefined,
    });

    renderWithProviders(<InboxTabBadge />);

    expect(screen.queryByTestId('inbox-tab-badge')).toBeNull();
  });

  test('renders the pending count when verified with pending requests', () => {
    (hooks.useAppSelector as jest.Mock)
      .mockReturnValueOnce({ access_token: 'tok', user: { user_id: 'u1' } })
      .mockReturnValueOnce(true);
    (hooks.useContactRequestsInbox as jest.Mock).mockReturnValue({
      data: {
        items: [
          { contact_request_id: 'a', status: 'pending' },
          { contact_request_id: 'b', status: 'pending' },
          { contact_request_id: 'c', status: 'accepted' },
        ],
      },
    });

    renderWithProviders(<InboxTabBadge />);

    const badge = screen.getByTestId('inbox-tab-badge');
    expect(badge).toBeDefined();
    // Pending count is 2 (third request is accepted and should be excluded).
    expect(badge.props.accessibilityLabel).toBe('2');
  });
});
