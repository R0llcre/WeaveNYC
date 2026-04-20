/**
 * M8.5 W5C — `<VerifyScreen>` coverage for the `/me/verify` redesign.
 *
 * The full OTP/magic-link mutation paths are already covered by the
 * api-gateway integration tests and the e2e smoke spec
 * (tests/e2e/resource-smoke.spec.ts → "language -> zip -> ...").
 *
 * These cases pin the *presentation contract* that W5C introduced on top
 * of the W4 state machine:
 *
 *   1. The `verify-title` h1 is rendered inside the page content (not the
 *      TopBar) so the e2e locator keeps resolving.
 *   2. Clicking `send-code` dispatches the OTP start mutation (the
 *      happy-path for the entry form).
 *   3. A mutation error surfaces the danger Banner so users see a
 *      recovery affordance rather than a silent failure.
 *
 * All tests render through `NextIntlClientProvider` + a real Redux store
 * so we exercise the same selectors / reducers the screen uses in prod.
 * `@tanstack/react-query` is mocked at the hook boundary so we don't
 * have to spin up a QueryClientProvider + network stubs; the mutation
 * shape we care about is the sequence of `mutate()` calls.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import {
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
import type { AuthSession, UserLevel } from '@/lib/types';
import { VerifyScreen } from './verify-screen';

// `<TopBar>` and the verify logic both consume next/navigation. We stub
// useRouter so router.back()/router.replace() are no-ops in jsdom, and
// useSearchParams returns a mutable URLSearchParams instance per test.
const routerBackMock = vi.fn();
const routerReplaceMock = vi.fn();
let currentSearch = new URLSearchParams('');
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: routerBackMock,
    push: vi.fn(),
    replace: routerReplaceMock,
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => currentSearch,
  usePathname: () => '/me/verify',
}));

// react-query mutations are mocked at the hook boundary so we don't need
// a real QueryClientProvider. The shared otpStartState is mutated per
// test to drive the "idle → pending → data" branches without having to
// round-trip through an actual mutation queue.
type MutationStub<TData> = {
  mutate: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  isPending: boolean;
  data: TData | undefined;
  error: Error | null;
};

const otpStartState: MutationStub<{ challenge_id: string; demo_code?: string }> = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  data: undefined,
  error: null,
};
const otpVerifyState: MutationStub<AuthSession> = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  data: undefined,
  error: null,
};
const magicStartState: MutationStub<{
  challenge_id: string;
  demo_token?: string;
  demo_url?: string;
}> = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  data: undefined,
  error: null,
};
const magicVerifyState: MutationStub<AuthSession> = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  data: undefined,
  error: null,
};

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ cancelQueries: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('@/lib/hooks', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hooks')>('@/lib/hooks');
  return {
    ...actual,
    useOtpStart: () => otpStartState,
    useOtpVerify: () => otpVerifyState,
    useMagicLinkStart: () => magicStartState,
    useMagicLinkVerify: () => magicVerifyState,
  };
});

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createAnonymousSession: vi.fn().mockResolvedValue({
      access_token: 'anon',
      refresh_token: 'r',
      user: { user_id: 'anon-id', level: 'anonymous' as UserLevel },
      issued_via: 'anonymous',
    }),
  };
});

vi.mock('@/lib/match-intent', () => ({
  loadMatchContactIntent: () => null,
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

function buildSession(level: UserLevel): AuthSession {
  return {
    access_token: 'access-token-fixture',
    refresh_token: 'refresh-token-fixture',
    user: {
      user_id: '550e8400-e29b-41d4-a716-446655440099',
      level,
    },
    issued_via: 'otp',
  };
}

function renderVerify(level: UserLevel = 'anonymous') {
  const store = buildStore();
  store.dispatch(setSession(buildSession(level)));
  const utils = render(
    <Provider store={store}>
      <NextIntlClientProvider
        locale="en"
        messages={messages.en}
        timeZone="America/New_York"
      >
        <VerifyScreen />
      </NextIntlClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

function resetMutationState<TData>(state: MutationStub<TData>) {
  state.mutate.mockReset();
  state.reset.mockReset();
  state.isPending = false;
  state.data = undefined;
  state.error = null;
}

beforeEach(() => {
  currentSearch = new URLSearchParams('');
  routerBackMock.mockReset();
  routerReplaceMock.mockReset();
  resetMutationState(otpStartState);
  resetMutationState(otpVerifyState);
  resetMutationState(magicStartState);
  resetMutationState(magicVerifyState);
});

afterEach(() => {
  cleanup();
});

describe('VerifyScreen (/me/verify)', () => {
  it('renders the verify-title heading inside page content', () => {
    renderVerify('anonymous');
    const heading = screen.getByTestId('verify-title');
    // Wave 6D a11y pass: the Card-level verify title was demoted from
    // <h1> to <h2> so the TopBar's <h1> stays the single page heading.
    // The testid contract survives and the heading element is still a
    // real heading (not a span), which is what the e2e locators care
    // about. If this ever needs to be h1 again, the TopBar title must be
    // suppressed on the verify route to avoid a double-h1 violation.
    expect(heading.tagName.toLowerCase()).toBe('h2');
    // W8 i18n pass: `verifyTitle` copy tightened to "Verify your identity".
    expect(heading.textContent).toContain('Verify your identity');
  });

  it('calls otpStart.mutate with the typed phone when send-code is clicked', async () => {
    renderVerify('anonymous');

    // Enter a US phone number and fire the primary CTA.
    const phoneInput = screen.getByLabelText('Phone number');
    fireEvent.change(phoneInput, { target: { value: '+15165550101' } });
    fireEvent.click(screen.getByTestId('send-code'));

    await waitFor(() => {
      expect(otpStartState.mutate).toHaveBeenCalledTimes(1);
    });
    expect(otpStartState.mutate).toHaveBeenCalledWith({ phone: '+15165550101' });
  });

  it('renders the danger Banner with verifyError copy when a mutation errors', () => {
    // Drive the otpStart mutation into an error state so the screen has
    // an Error to render in the error stack.
    otpStartState.error = new Error('Rate limited');
    renderVerify('anonymous');

    // The Banner uses role="alert" for danger tone.
    const alerts = screen.getAllByRole('alert');
    const dangerBanner = alerts.find((node) =>
      node.className.includes('banner--danger'),
    );
    expect(dangerBanner).toBeDefined();
    expect(dangerBanner?.textContent).toContain("Couldn't verify");
    expect(dangerBanner?.textContent).toContain('Rate limited');
  });

  it('renders the EmptyState success card for already-verified users', () => {
    renderVerify('verified');
    // The success CTA links back to /me and its label comes from
    // `verifySuccessCta` → "Back to Me".
    const cta = screen.getByRole('link', { name: 'Back to Me' });
    // Trailing slash required by the PWA's static-export config (see
    // W8 UX audit, P0 trailing-slash 404 regressions).
    expect(cta.getAttribute('href')).toBe('/me/');
  });
});
