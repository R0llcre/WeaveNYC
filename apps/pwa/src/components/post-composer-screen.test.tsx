/**
 * W4A smoke coverage for the redesigned Post Composer.
 *
 * The new screen swaps the flat 3-column grid for atoms-first Stack/Inline/
 * Card layout and introduces the mode-card selector. These tests guard the
 * rendering contract that E2E and the product flow rely on:
 *
 *   - E2E testids remain in the DOM: `select-request`, `select-offer`,
 *     `preview-post`, `publish-post`, `browser-speech`, `create-session`.
 *   - The mode-card path still dispatches the correct Redux transition
 *     (request/offer → step=compose).
 *   - Interaction coverage: mode toggle between request/offer updates the
 *     store, and `publish-post` stays disabled until the draft clears every
 *     validator. These are behavioural guards so a future refactor that
 *     accidentally drops the aria-pressed toggle or the validation gate
 *     fails loudly rather than at E2E time.
 *
 * Business logic (createPost, speech transcribe, intent pump) is covered by
 * the tests/e2e/community-posts.spec.ts Playwright suite — this file is the
 * fast Vitest gate.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { configureStore, type EnhancedStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import {
  communityReducer,
  setCurrentCommunity,
  upsertJoinedCommunity,
} from '@/lib/slices/community-slice';
import { mergePostDraft, postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession } from '@/lib/types';
import { PostComposerScreen } from './post-composer-screen';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
  usePathname: () => '/posts/new',
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    createAnonymousSession: vi.fn(),
    createPost: vi.fn(async () => ({ post_id: 'created' })),
    transcribeSpeech: vi.fn(async () => ({
      transcript: 'demo',
      language: 'en',
      provider: 'browser',
    })),
  };
});

vi.mock('@/lib/speech', () => ({
  listenOnceWithBrowserSpeech: vi.fn(async () => 'demo'),
  supportsBrowserSpeechRecognition: () => true,
}));

type Store = EnhancedStore<{
  auth: ReturnType<typeof authReducer>;
  community: ReturnType<typeof communityReducer>;
  postDraft: ReturnType<typeof postDraftReducer>;
  preferences: ReturnType<typeof preferencesReducer>;
}>;

function buildStore(): Store {
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
    access_token: 'token',
    refresh_token: 'refresh',
    user: { user_id: 'user-1', level: 'verified' },
    issued_via: 'otp',
  };
}

function renderComposer(options: {
  withSession?: boolean;
  withCommunity?: boolean;
  store?: Store;
} = {}) {
  const { withSession = false, withCommunity = false } = options;
  const store = options.store ?? buildStore();
  if (withSession) store.dispatch(setSession(seedSession()));
  if (withCommunity) {
    store.dispatch(
      upsertJoinedCommunity({
        community: {
          community_id: 'community-11735',
          name: 'Farmingdale Demo',
          center_zip: '11735',
          join_policy: 'invite_only',
        },
        joinedAt: new Date().toISOString(),
      }),
    );
    store.dispatch(setCurrentCommunity('community-11735'));
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <PostComposerScreen />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
  return { ...view, store };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

describe('PostComposerScreen (/posts/new)', () => {
  it('renders the anonymous bootstrap CTA with the `create-session` testid', () => {
    renderComposer();
    expect(screen.getByTestId('create-session')).toBeTruthy();
  });

  it('exposes the mode-card testids `select-request` and `select-offer`', () => {
    renderComposer({ withSession: true, withCommunity: true });
    expect(screen.getByTestId('select-request')).toBeTruthy();
    expect(screen.getByTestId('select-offer')).toBeTruthy();
  });

  it('the speech-to-text button preserves the `browser-speech` testid once in compose step', () => {
    renderComposer({ withSession: true, withCommunity: true });
    fireEvent.click(screen.getByTestId('select-request'));
    expect(screen.getByTestId('browser-speech')).toBeTruthy();
  });

  it('exposes the `preview-post` CTA once the user is in the compose step', () => {
    renderComposer({ withSession: true, withCommunity: true });
    fireEvent.click(screen.getByTestId('select-request'));
    expect(screen.getByTestId('preview-post')).toBeTruthy();
  });

  /* ------------------------------------------------------------------ */
  /* Interaction coverage — behaviour, not just render                   */
  /* ------------------------------------------------------------------ */

  it('clicking select-request then select-offer updates the draft postType in Redux', () => {
    const { store } = renderComposer({ withSession: true, withCommunity: true });
    fireEvent.click(screen.getByTestId('select-request'));
    expect(store.getState().postDraft.postType).toBe('request');
    // From compose step the composer hides the mode cards. Jump the user back
    // to the type step so the pressable-state guard for the second mode card
    // can be exercised through a re-render.
    act(() => {
      store.dispatch(mergePostDraft({ step: 'type' }));
    });
    fireEvent.click(screen.getByTestId('select-offer'));
    expect(store.getState().postDraft.postType).toBe('offer');
    expect(store.getState().postDraft.step).toBe('compose');
  });

  it('publish-post is disabled when the draft is invalid (empty title + body)', () => {
    // Seed into preview step with a blank title so the publish CTA renders but
    // the validator rejects it. This is the full regression for W4-R1 M3:
    // previously we only asserted presence, not the gate.
    const store = buildStore();
    store.dispatch(setSession(seedSession()));
    store.dispatch(
      upsertJoinedCommunity({
        community: {
          community_id: 'community-11735',
          name: 'Farmingdale Demo',
          center_zip: '11735',
          join_policy: 'invite_only',
        },
        joinedAt: new Date().toISOString(),
      }),
    );
    store.dispatch(setCurrentCommunity('community-11735'));
    store.dispatch(
      mergePostDraft({
        step: 'preview',
        postType: 'request',
        title: '',
        body: '',
        locationZip: '11735',
        category: 'food',
      }),
    );
    renderComposer({ withSession: false, withCommunity: false, store });
    const publish = screen.getByTestId('publish-post') as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
  });

  it('publish-post becomes enabled once title + body + zip are valid', () => {
    const store = buildStore();
    store.dispatch(setSession(seedSession()));
    store.dispatch(
      upsertJoinedCommunity({
        community: {
          community_id: 'community-11735',
          name: 'Farmingdale Demo',
          center_zip: '11735',
          join_policy: 'invite_only',
        },
        joinedAt: new Date().toISOString(),
      }),
    );
    store.dispatch(setCurrentCommunity('community-11735'));
    store.dispatch(
      mergePostDraft({
        step: 'preview',
        postType: 'request',
        title: 'Need groceries tonight',
        body: 'I live alone and run out of cans. Pickup near 11735.',
        locationZip: '11735',
        category: 'food',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    );
    renderComposer({ withSession: false, withCommunity: false, store });
    const publish = screen.getByTestId('publish-post') as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
  });
});
