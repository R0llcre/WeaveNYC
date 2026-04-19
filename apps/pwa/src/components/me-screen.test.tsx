/**
 * M8.5 W3C — `<MeScreen>` tab-hub coverage.
 *
 * The real delete flow (/me/danger) and verify flow (/me/verify) ship in
 * their own screens and have their own tests; the Me hub is a *directory*
 * of those flows. These cases pin the directory contract:
 *
 *   1. Verified user sees the verified Tag and no verify CTA.
 *   2. Unverified user sees the verify CTA pointing at `/me/verify`.
 *   3. Sign-out button is present and clicking it clears the Redux session.
 *   4. Danger CTA is present and points at `/me/danger`.
 *   5. Language row reflects the current preferences.language label.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer, setLanguage } from '@/lib/slices/preferences-slice';
import type { AuthSession, UserLevel } from '@/lib/types';
import { MeScreen } from './me-screen';

// `<TopBar>` consumes `useRouter()` and `useTranslations()`. The intl
// provider below wires the real en bundle; we stub next/navigation so the
// router.back() call path is inert in jsdom.
const routerBackMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: routerBackMock,
    push: vi.fn(),
    replace: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/me',
}));

// We don't touch the IndexedDB persistence layer in these cases — the
// sign-out hook calls `saveSession(null)` which is async/best-effort, and
// jsdom has no IDB. Mock the whole persistence module so the call is a
// no-op instead of swallowing an unhandled promise.
vi.mock('@/lib/persistence', () => ({
  saveSession: vi.fn().mockResolvedValue(undefined),
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

function renderMe(options: { level?: UserLevel; language?: 'en' | 'es' | 'zh' } = {}) {
  const { level = 'anonymous', language = 'en' } = options;
  const store = buildStore();
  store.dispatch(setSession(buildSession(level)));
  store.dispatch(setLanguage(language));

  const utils = render(
    <Provider store={store}>
      <NextIntlClientProvider
        locale="en"
        messages={messages.en}
        timeZone="America/New_York"
      >
        <MeScreen />
      </NextIntlClientProvider>
    </Provider>,
  );
  return { ...utils, store };
}

beforeEach(() => {
  routerBackMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('MeScreen (/me)', () => {
  it('renders the TopBar title and all 6 section headings', () => {
    renderMe();
    // Top bar title
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Me');
    // Section overlines (h2) are keyed by stable ids.
    for (const id of [
      'me-language-heading',
      'me-verify-heading',
      'me-privacy-heading',
      'me-account-heading',
      'me-danger-heading',
    ]) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('shows the verified Tag and NO verify CTA when the user is verified', () => {
    renderMe({ level: 'verified' });
    // The verified Tag label reuses `meVerifyStatusVerified` → "Verified".
    // We scope the assertion to the verify section to avoid collision with
    // the status caption in the account header.
    const verifySection = document.getElementById('me-verify-heading')!
      .parentElement!;
    expect(verifySection.textContent).toContain('Verified');
    // Verify CTA must be absent for verified users.
    expect(screen.queryByTestId('me-verify-cta')).toBeNull();
  });

  it('shows the verify CTA with href=/me/verify when unverified', () => {
    renderMe({ level: 'anonymous' });
    const cta = screen.getByTestId('me-verify-cta');
    expect(cta.getAttribute('href')).toBe('/me/verify/');
    // CTA copy comes from `meActionVerifyIdentity` → "Verify identity".
    expect(cta.textContent).toContain('Verify identity');
  });

  it('renders a sign-out button that clears the Redux session on click', async () => {
    const { store } = renderMe({ level: 'verified' });
    // Pre-condition: the store has a session.
    expect(store.getState().auth.session).not.toBeNull();

    const signOut = screen.getByTestId('me-sign-out');
    expect(signOut.textContent).toContain('Sign out');
    fireEvent.click(signOut);

    // `useSignOut` dispatches `clearSession` synchronously before awaiting
    // the persistence cleanup, so the store change is observable immediately.
    await waitFor(() => {
      expect(store.getState().auth.session).toBeNull();
    });
  });

  it('renders the danger CTA with href=/me/danger', () => {
    renderMe({ level: 'verified' });
    const dangerCta = screen.getByTestId('me-danger-cta');
    expect(dangerCta.getAttribute('href')).toBe('/me/danger/');
    // CTA copy comes from `meDangerCta` → "Delete account".
    expect(dangerCta.textContent).toContain('Delete account');
  });

  it('reflects the current preferences language on the Language row', () => {
    renderMe({ language: 'zh' });
    // The Tag inside the language section renders the label in the picked
    // language ("中文" for zh). We locate the language section by its stable
    // heading id to avoid matching the same glyph elsewhere on the page.
    const langSection = document.getElementById('me-language-heading')!
      .parentElement!;
    expect(langSection.textContent).toContain('中文');
  });
});
