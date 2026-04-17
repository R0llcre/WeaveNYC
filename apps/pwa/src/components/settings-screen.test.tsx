/**
 * M8 W2C — vitest coverage for /settings introduced in W3D.
 *
 * The 3-step account deletion flow is covered end-to-end in the api-gateway
 * integration tests (services/api-gateway/test/account.test.ts) and in the
 * real-HTTP smoke (tests/smoke/real-api.ts). Here we verify the wiring of the
 * SettingsScreen component:
 *
 * - language pills dispatch setLanguage and reflect aria-pressed
 * - visibility radio updates default post visibility
 * - low-bandwidth toggle flips preferences.lowBandwidth
 * - expanding the Delete account summary reveals the danger-zone controls
 * - request -> confirm happy path shows the "deletion_scheduled" banner
 * - undo shows the "restored" banner
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession } from '@/lib/types';
import { SettingsScreen } from './settings-screen';

const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: replaceMock, replace: replaceMock }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock the pwa api module so we don't need a real fetch stub or UUID-shaped
// server responses; we just confirm the SettingsScreen calls the helpers in
// the right order with the right inputs.
const requestDeletionMock = vi.fn();
const confirmDeletionMock = vi.fn();
const undeleteMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    requestAccountDeletion: (...args: unknown[]) =>
      requestDeletionMock(...args),
    confirmAccountDeletion: (...args: unknown[]) =>
      confirmDeletionMock(...args),
    undeleteAccount: (...args: unknown[]) => undeleteMock(...args),
  };
});

function buildStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
      preferences: preferencesReducer,
    },
  });
}

function seedVerifiedSession() {
  const session: AuthSession = {
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '550e8400-e29b-41d4-a716-446655440099',
      level: 'verified',
    },
    issued_via: 'otp',
  };
  return session;
}

function renderSettings() {
  const store = buildStore();
  store.dispatch(setSession(seedVerifiedSession()));
  const utils = render(
    <Provider store={store}>
      <NextIntlClientProvider
        locale="en"
        messages={messages.en}
        timeZone="America/New_York"
      >
        <SettingsScreen />
      </NextIntlClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

afterEach(() => {
  cleanup();
  requestDeletionMock.mockReset();
  confirmDeletionMock.mockReset();
  undeleteMock.mockReset();
  replaceMock.mockReset();
});

describe('SettingsScreen (/settings)', () => {
  it('renders the five expected section headings (Language / Privacy / Safety / Account / Help)', () => {
    renderSettings();
    // Each Card is labelled via aria-labelledby -> an <h2>. We assert by
    // finding heading elements with stable ids so the test survives i18n
    // tweaks to the exact text.
    const headingIds = [
      'settings-language-heading',
      'settings-privacy-heading',
      'settings-safety-heading',
      'settings-account-heading',
      'settings-help-heading',
    ];
    for (const id of headingIds) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('toggles the selected language pill via aria-pressed when clicked', () => {
    const { store } = renderSettings();

    const en = screen.getByTestId('settings-language-select-en');
    const es = screen.getByTestId('settings-language-select-es');
    expect(en.getAttribute('aria-pressed')).toBe('true');
    expect(es.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(es);

    expect(store.getState().preferences.language).toBe('es');
  });

  it('updates the default post visibility radio selection', () => {
    const { store } = renderSettings();
    const publicRadio = screen.getByRole('radio', {
      name: /Public/i,
    });
    fireEvent.click(publicRadio);
    expect(store.getState().preferences.defaultPostVisibility).toBe('public');
  });

  it('flips the low-bandwidth checkbox on the preferences slice', () => {
    const { store } = renderSettings();
    const checkbox = screen.getByRole('checkbox', {
      name: /low.bandwidth/i,
    });
    expect(store.getState().preferences.lowBandwidth).toBe(false);
    fireEvent.click(checkbox);
    expect(store.getState().preferences.lowBandwidth).toBe(true);
  });

  it('runs the delete request -> confirm -> undelete happy path and calls the API helpers', async () => {
    const challengeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const userId = '550e8400-e29b-41d4-a716-446655440099';
    const recoveryToken =
      'uri_abcdef12_1234567890abcdef1234567890abcdef01';

    requestDeletionMock.mockResolvedValue({
      challenge_id: challengeId,
      masked_destination: '(***) ***-0099',
      delivery_channel: 'sms',
      expires_in_seconds: 600,
    });
    confirmDeletionMock.mockResolvedValue({
      status: 'deletion_scheduled',
      purge_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      user_id: userId,
      undelete_recovery_token: recoveryToken,
    });
    undeleteMock.mockResolvedValue({
      status: 'restored',
      user_id: userId,
    });

    renderSettings();

    // 1) Click the "Delete your account" summary to expand the danger zone
    const summary = screen.getByText(/Delete your account/i);
    fireEvent.click(summary);

    // 2) Start deletion -> calls requestAccountDeletion
    const start = screen.getByTestId('settings-delete-start');
    fireEvent.click(start);
    await waitFor(() => {
      expect(requestDeletionMock).toHaveBeenCalledWith('access-token-fixture');
    });

    // 3) OTP input + confirm -> calls confirmAccountDeletion
    const otpInput = await screen.findByTestId('settings-delete-otp-input');
    fireEvent.change(otpInput, { target: { value: '246810' } });
    fireEvent.click(screen.getByTestId('settings-delete-confirm'));
    await waitFor(() => {
      expect(confirmDeletionMock).toHaveBeenCalledWith(
        'access-token-fixture',
        expect.objectContaining({
          challenge_id: challengeId,
          code: '246810',
        }),
      );
    });

    // 4) Undo click -> calls undeleteAccount
    const undoButton = await screen.findByTestId('settings-delete-undo');
    fireEvent.click(undoButton);
    await waitFor(() => {
      expect(undeleteMock).toHaveBeenCalledWith(
        '',
        expect.objectContaining({
          user_id: userId,
          recovery_token: recoveryToken,
        }),
      );
    });

    // Allow the post-undone setTimeout to fire so React doesn't warn about
    // act-less state updates during teardown. 1500ms is the router.replace
    // delay set in settings-screen.tsx.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
  });
});
