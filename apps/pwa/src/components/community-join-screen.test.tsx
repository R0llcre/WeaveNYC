/**
 * F4 — vitest coverage for the 4 community-join screen fixes:
 *   - Bug 3: failed join clears joinPreview + shows "code expired" banner
 *   - Bug 4: double-submit protection on both resolve + confirm-join buttons
 *   - Bug 5: 3-step progress indicator (Enter code / Review / Join)
 *   - Bug 6: invalid-code (404) path shows friendly banner + Start over button
 *
 * The full flow is also covered at the API layer by
 * services/api-gateway/test/community-access.test.ts; this file focuses on the
 * PWA wiring so we catch UI regressions without a real gateway.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
import { communityReducer, setJoinPreview } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession } from '@/lib/types';
import { CommunityJoinScreen } from './community-join-screen';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock }),
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

const resolveMock = vi.fn();
const joinMock = vi.fn();
const createAnonymousMock = vi.fn();
vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    resolveCommunityAccess: (...args: unknown[]) => resolveMock(...args),
    joinCommunity: (...args: unknown[]) => joinMock(...args),
    createAnonymousSession: (...args: unknown[]) => createAnonymousMock(...args),
  };
});

// The QR module pokes navigator.mediaDevices / BarcodeDetector at import time;
// stub to keep jsdom quiet.
vi.mock('@/lib/qr', () => ({
  parseScannedQrPayload: vi.fn(() => null),
  scanQrFromImageFile: vi.fn(async () => ''),
  scanQrFromVideo: vi.fn(async () => ''),
  supportsBarcodeDetector: vi.fn(() => false),
}));

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

function seedSession(): AuthSession {
  return {
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '550e8400-e29b-41d4-a716-446655440011',
      level: 'anonymous',
    },
    issued_via: 'anonymous',
  };
}

function renderJoin(options: { withSession?: boolean; withPreview?: boolean } = {}) {
  const { withSession = true, withPreview = false } = options;
  const store = buildStore();
  if (withSession) {
    store.dispatch(setSession(seedSession()));
  }
  if (withPreview) {
    store.dispatch(
      setJoinPreview({
        community: {
          community_id: 'community-11373',
          name: 'Elmhurst Mutual Aid',
          center_zip: '11373',
          join_policy: 'invite_only',
        },
        joinToken: 'join-token-fixture',
        entry: 'invite_code',
        expiresInSeconds: 300,
      }),
    );
  }
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const utils = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <CommunityJoinScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  resolveMock.mockReset();
  joinMock.mockReset();
  createAnonymousMock.mockReset();
  pushMock.mockReset();
  window.sessionStorage.clear();
});

describe('CommunityJoinScreen (/community/join)', () => {
  it('renders the 3-step progress indicator with step 1 active at rest (Bug 5)', () => {
    renderJoin();
    const progress = screen.getByTestId('join-step-progress');
    expect(progress).toBeTruthy();

    const step1 = screen.getByTestId('join-step-1');
    const step2 = screen.getByTestId('join-step-2');
    const step3 = screen.getByTestId('join-step-3');

    expect(step1.getAttribute('aria-pressed')).toBe('true');
    expect(step2.getAttribute('aria-pressed')).toBe('false');
    expect(step3.getAttribute('aria-pressed')).toBe('false');
    expect(step1.getAttribute('aria-current')).toBe('step');
  });

  it('advances to step 2 once the join preview is in the store (Bug 5)', () => {
    renderJoin({ withPreview: true });
    const step1 = screen.getByTestId('join-step-1');
    const step2 = screen.getByTestId('join-step-2');
    expect(step1.getAttribute('aria-pressed')).toBe('false');
    expect(step2.getAttribute('aria-pressed')).toBe('true');
    expect(step2.getAttribute('aria-current')).toBe('step');
  });

  it('disables the resolve button when input is empty and when a session is missing (Bug 4)', () => {
    renderJoin({ withSession: false });
    const resolve = screen.getByTestId('resolve-community');
    expect(resolve.hasAttribute('disabled')).toBe(true);
  });

  it('shows the friendly invalid-code banner when resolve returns HTTP 404 (Bug 6)', async () => {
    resolveMock.mockRejectedValue(
      new Error('/v1/community-access/resolve failed: HTTP 404 not found'),
    );

    renderJoin();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'BAD-CODE' } });
    fireEvent.click(screen.getByTestId('resolve-community'));

    const banner = await screen.findByTestId('join-invalid-code');
    expect(banner).toBeTruthy();
    // F9 i18n rewrote the invite-code error copy to "We do not know this
    // invite code" (plainer English, matching the ES/ZH translations).
    expect(banner.textContent).toMatch(/do not know this invite code/i);
    expect(banner.textContent).toMatch(/Start over/i);
  });

  it('clears input + mutation state when the user clicks Start over (Bug 6)', async () => {
    resolveMock.mockRejectedValue(
      new Error('/v1/community-access/resolve failed: HTTP 404 not found'),
    );

    renderJoin();

    const input = screen.getByRole('textbox') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'BAD-CODE' } });
    fireEvent.click(screen.getByTestId('resolve-community'));

    await screen.findByTestId('join-invalid-code');

    const startOver = screen.getByRole('button', { name: /Start over/i });
    fireEvent.click(startOver);

    await waitFor(() => {
      expect(screen.queryByTestId('join-invalid-code')).toBeNull();
    });
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  });

  it('clears the stale joinPreview and shows the expired banner when join fails (Bug 3)', async () => {
    joinMock.mockRejectedValue(
      new Error('/v1/communities/community-11373/join failed: HTTP 410 gone'),
    );

    const { store } = renderJoin({ withPreview: true });

    expect(store.getState().community.joinPreview).not.toBeNull();

    fireEvent.click(screen.getByTestId('confirm-join'));

    await screen.findByTestId('join-stale-error');

    // The preview should be wiped so the user cannot click Confirm join
    // again with the same spent join_token.
    expect(store.getState().community.joinPreview).toBeNull();
  });

  it('confirm-join button remains disabled while the mutation is pending (Bug 4)', async () => {
    // Resolve the mutation slowly so we can observe the pending state.
    let resolveJoin: ((value: unknown) => void) | null = null;
    joinMock.mockImplementation(
      () =>
        new Promise((res) => {
          resolveJoin = res;
        }),
    );

    renderJoin({ withPreview: true });

    const confirm = screen.getByTestId('confirm-join') as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);

    await waitFor(() => {
      expect((screen.getByTestId('confirm-join') as HTMLButtonElement).disabled).toBe(true);
    });

    // Settle the pending mutation so the test does not leak timers.
    await act(async () => {
      resolveJoin?.({
        joined_at: new Date().toISOString(),
      });
    });
  });
});
