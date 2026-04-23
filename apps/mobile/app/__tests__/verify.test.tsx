/**
 * verify-screen tests — S1 auth flows (OTP + magic link).
 *
 * Coverage (4 cases per the S1 spec):
 *   1. Renders the SMS (OTP) tab by default, with the phone field visible.
 *   2. Tapping "Send code" forwards the typed phone to `startOtp`.
 *   3. Entering a code + tapping "Verify" forwards it to `verifyOtp`.
 *   4. Switching to the Email-link tab shows the email field; pressing
 *      "Send link" forwards the email to `startMagicLink`.
 *
 * Wiring
 * ------
 * The mobile jest env runs on the plain Node environment with the `react-
 * native` host stub (see `__tests__/__mocks__/react-native.js`). That stub
 * is enough for `@testing-library/react-native` to walk the tree and for
 * `fireEvent.press` to resolve host press handlers. For the pieces the
 * node-only harness can't load natively, we stub:
 *
 *   - `@/lib/api` — the four auth mutations are swapped for `jest.fn`s
 *     so we can assert the payload routed through.
 *   - `expo-linking` — the universal-link intake effect calls
 *     `getInitialURL()` + `addEventListener('url', …)`. Both are no-ops
 *     here; the magic-link auto-consume path is exercised in PWA land.
 *   - `expo-router` — only imported by the two route wrappers; the test
 *     imports the underlying VerifyScreen directly so we don't need it.
 *   - `@/lib/use-session-bootstrap` — no-op. The real hook mints an
 *     anonymous session; we preload one via the Redux store instead so
 *     `session?.access_token` is truthy and the Send CTAs aren't
 *     disabled.
 *   - `react-i18next.useTranslation` — returns an identity translator so
 *     `t('sendCode')` renders literally `sendCode`, which is what our
 *     queries below expect.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider as ReduxProvider } from 'react-redux';

// -----------------------------------------------------------------------
// Mocks — declared BEFORE importing the screen so jest's require-time
// hoisting picks them up.
// -----------------------------------------------------------------------

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('@/lib/use-session-bootstrap', () => ({
  useSessionBootstrap: () => undefined,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: jest.fn(), language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: jest.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const startOtpMock: jest.Mock = jest.fn(
  (_token: string, _input: { phone: string }) =>
    Promise.resolve({ challenge_id: 'ch_1' }),
);
const verifyOtpMock: jest.Mock = jest.fn(
  (_token: string, _input: { challengeId: string; code: string }) =>
    Promise.resolve({
      access_token: 'fresh',
      refresh_token: 'r',
      user: { user_id: 'u_1', level: 'verified' as const, created_at: '2026' },
      issued_via: 'otp',
    }),
);
const startMagicLinkMock: jest.Mock = jest.fn(
  (_token: string, _input: { email: string }) =>
    Promise.resolve({ challenge_id: 'ch_2' }),
);
const verifyMagicLinkMock: jest.Mock = jest.fn(
  (
    _token: string | null | undefined,
    _input: { challengeId: string; token: string },
  ) =>
    Promise.resolve({
      access_token: 'fresh',
      refresh_token: 'r',
      user: { user_id: 'u_1', level: 'verified' as const, created_at: '2026' },
      issued_via: 'magic_link',
    }),
);

jest.mock('@/lib/api', () => ({
  startOtp: (token: string, input: { phone: string }) => startOtpMock(token, input),
  verifyOtp: (token: string, input: { challengeId: string; code: string }) =>
    verifyOtpMock(token, input),
  startMagicLink: (token: string, input: { email: string }) =>
    startMagicLinkMock(token, input),
  verifyMagicLink: (
    token: string | null | undefined,
    input: { challengeId: string; token: string },
  ) => verifyMagicLinkMock(token, input),
  createAnonymousSession: jest.fn(() =>
    Promise.resolve({
      access_token: 'anon',
      refresh_token: 'r',
      user: { user_id: 'u_0', level: 'anonymous', created_at: '2026' },
      issued_via: 'anonymous',
    }),
  ),
  getApiBaseUrl: () => 'http://localhost:4000',
}));

// -----------------------------------------------------------------------
// Imports that depend on the mocks above.
// -----------------------------------------------------------------------

import { AppThemeProvider } from '@/theme';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { VerifyScreen } from '@/components/VerifyScreen';

/**
 * Build a fresh Redux store + QueryClient + theme wrapper so each test
 * starts with a clean state. Pre-seeds a verified-level-0 (anonymous)
 * session so the Send buttons aren't disabled on mount.
 */
function renderVerify() {
  const store = configureStore({ reducer: { auth: authReducer } });
  store.dispatch(
    setSession({
      access_token: 'anon',
      refresh_token: 'r',
      user: {
        user_id: 'u_0',
        level: 'anonymous',
        created_at: '2026-04-22T00:00:00Z',
      },
      issued_via: 'anonymous',
    } as never),
  );

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider override="light">
          <VerifyScreen />
        </AppThemeProvider>
      </QueryClientProvider>
    </ReduxProvider>,
  );
}

describe('VerifyScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders the SMS (OTP) tab by default with the phone field visible', () => {
    const { getByTestId, queryByTestId } = renderVerify();
    // Both tab pills should be present; the phone field is rendered under
    // the OTP tab and the email field is hidden until the user switches.
    expect(getByTestId('verify-tab-otp')).toBeDefined();
    expect(getByTestId('verify-tab-magic')).toBeDefined();
    expect(getByTestId('verify-phone-field')).toBeDefined();
    expect(queryByTestId('verify-email-field')).toBeNull();
  });

  test('tapping "Send code" calls startOtp with the typed phone', async () => {
    const { getByTestId } = renderVerify();

    // Type a phone number into the phone field's underlying TextInput.
    // The field's testID lands on the container; the input is the only
    // TextInput descendent so we use `UNSAFE_getAllByType` via the host
    // stub's `onChangeText` prop search.
    const phoneField = getByTestId('verify-phone-field');
    const input = phoneField.findByType('TextInput' as never);
    fireEvent(input, 'changeText', '+15165550101');

    await act(async () => {
      fireEvent.press(getByTestId('verify-send-code'));
    });

    await waitFor(() => {
      expect(startOtpMock).toHaveBeenCalledTimes(1);
    });
    expect(startOtpMock).toHaveBeenCalledWith(
      'anon',
      expect.objectContaining({ phone: '+15165550101' }),
    );
  });

  test('entering code + tapping "Verify" calls verifyOtp', async () => {
    const { getByTestId } = renderVerify();

    // Step 1: start the OTP challenge so `otpStart.data` is populated,
    // which is required to enable the Verify button.
    const phoneField = getByTestId('verify-phone-field');
    const phoneInput = phoneField.findByType('TextInput' as never);
    fireEvent(phoneInput, 'changeText', '+15165550101');

    await act(async () => {
      fireEvent.press(getByTestId('verify-send-code'));
    });
    await waitFor(() => expect(startOtpMock).toHaveBeenCalled());

    // Step 2: enter the 6-digit code + press Verify.
    const codeField = getByTestId('verify-code-field');
    const codeInput = codeField.findByType('TextInput' as never);
    fireEvent(codeInput, 'changeText', '123456');

    await act(async () => {
      fireEvent.press(getByTestId('verify-code-submit'));
    });

    await waitFor(() => expect(verifyOtpMock).toHaveBeenCalledTimes(1));
    expect(verifyOtpMock).toHaveBeenCalledWith(
      'anon',
      expect.objectContaining({ challengeId: 'ch_1', code: '123456' }),
    );
  });

  test('tapping the Email tab reveals the email field; sending calls startMagicLink', async () => {
    const { getByTestId, queryByTestId } = renderVerify();

    await act(async () => {
      fireEvent.press(getByTestId('verify-tab-magic'));
    });

    // The email field is now mounted; the phone field from the other tab
    // is unmounted because the two branches share mode state.
    expect(getByTestId('verify-email-field')).toBeDefined();
    expect(queryByTestId('verify-phone-field')).toBeNull();

    const emailField = getByTestId('verify-email-field');
    const emailInput = emailField.findByType('TextInput' as never);
    fireEvent(emailInput, 'changeText', 'neighbor@example.com');

    await act(async () => {
      fireEvent.press(getByTestId('verify-send-link'));
    });

    await waitFor(() => expect(startMagicLinkMock).toHaveBeenCalledTimes(1));
    expect(startMagicLinkMock).toHaveBeenCalledWith(
      'anon',
      expect.objectContaining({ email: 'neighbor@example.com' }),
    );
  });
});
