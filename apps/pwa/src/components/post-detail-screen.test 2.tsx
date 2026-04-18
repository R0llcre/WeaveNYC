/**
 * W4A smoke coverage for the redesigned Post Detail page.
 *
 * Guards:
 *   - Signed-out visitors get the "Sign in" CTA back to `/`.
 *   - When the post loads, the hero card renders the title as an h2 (not h1,
 *     since the TopBar already owns the h1) and the status/type/category
 *     Tag atoms are all present.
 *   - Owner-only edit/close/delete IconButtons are reachable by aria-label
 *     so screen-reader users can act on their own posts.
 *   - Non-owner viewers see the `post-contact-owner` Button + the
 *     `post-report` flag IconButton.
 *   - Edit mode exposes the category Pill row and the privacy <select> so
 *     edits can't silently replay stale values — save fires the mutation with
 *     whatever the user picked.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { Provider } from 'react-redux';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';

import { messages } from '@/lib/i18n';
import { authReducer, setSession } from '@/lib/slices/auth-slice';
import { communityReducer } from '@/lib/slices/community-slice';
import { postDraftReducer } from '@/lib/slices/post-draft-slice';
import { preferencesReducer } from '@/lib/slices/preferences-slice';
import type { AuthSession, PostDetail } from '@/lib/types';
import { PostDetailScreen } from './post-detail-screen';

const getPostMock = vi.fn();
const updatePostMock = vi.fn();
const createReportMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/posts/post-1',
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ...actual,
    getPost: (...args: unknown[]) => getPostMock(...args),
    updatePost: (...args: unknown[]) => updatePostMock(...args),
    createReport: (...args: unknown[]) => createReportMock(...args),
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

function seedSession(): AuthSession {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    user: { user_id: 'user-1', level: 'verified' },
    issued_via: 'otp',
  };
}

function makePostDetail(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    post_id: 'post-1',
    community_id: 'community-1',
    post_type: 'request',
    category: 'food',
    title: 'Need groceries',
    body: 'Help me tonight.',
    language: 'en',
    location_zip: '11735',
    privacy: 'community_only',
    status: 'active',
    risk_level: 'low',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
    is_owner: true,
    contact_pref: null,
    actions: { can_edit: true, can_close: true, can_delete: true, can_review: false },
    ...overrides,
  };
}

function renderDetail({ withSession = true }: { withSession?: boolean } = {}) {
  const store = buildStore();
  if (withSession) store.dispatch(setSession(seedSession()));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider
          locale="en"
          messages={messages.en}
          timeZone="America/New_York"
        >
          <PostDetailScreen postId="post-1" />
        </NextIntlClientProvider>
      </QueryClientProvider>
    </Provider>,
  );
}

beforeEach(() => {
  getPostMock.mockReset();
  updatePostMock.mockReset();
  createReportMock.mockReset();
  pushMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('PostDetailScreen (/posts/:id)', () => {
  it('prompts anonymous visitors to start a session before viewing a post', () => {
    renderDetail({ withSession: false });
    // `joinNeedsSession` is the localized copy for the bootstrap card.
    expect(screen.getByText(messages.en.joinNeedsSession)).toBeTruthy();
  });

  it('renders the post title and owner edit/close/delete icon buttons once loaded', async () => {
    getPostMock.mockResolvedValue(makePostDetail());
    renderDetail();
    await waitFor(() => {
      // Title renders inside the hero Card as an h2.
      expect(screen.getByRole('heading', { level: 2, name: 'Need groceries' })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: messages.en.postEditAction })).toBeTruthy();
    expect(screen.getByRole('button', { name: messages.en.postCloseAction })).toBeTruthy();
    expect(screen.getByRole('button', { name: messages.en.postDeleteAction })).toBeTruthy();
  });

  it('does not render owner actions when the viewer is not the owner', async () => {
    getPostMock.mockResolvedValue(
      makePostDetail({
        is_owner: false,
        actions: { can_edit: false, can_close: false, can_delete: false, can_review: false },
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: 'Need groceries' })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: messages.en.postEditAction })).toBeNull();
  });

  /* ------------------------------------------------------------------ */
  /* B1 — non-owner path                                                 */
  /* ------------------------------------------------------------------ */

  it('non-owner view shows the Contact + Report buttons with accessible labels', async () => {
    getPostMock.mockResolvedValue(
      makePostDetail({
        is_owner: false,
        actions: { can_edit: false, can_close: false, can_delete: false, can_review: false },
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('post-contact-owner')).toBeTruthy();
    });
    expect(screen.getByTestId('post-report')).toBeTruthy();
    // Flag icon button carries the localized aria-label.
    expect(screen.getByRole('button', { name: messages.en.reportPost })).toBeTruthy();
    // Contact CTA label matches the localized copy.
    expect(screen.getByText(messages.en.postContactAction)).toBeTruthy();
  });

  it('clicking post-contact-owner navigates to the composer pre-set to the opposite post_type', async () => {
    getPostMock.mockResolvedValue(
      makePostDetail({
        is_owner: false,
        post_type: 'request',
        actions: { can_edit: false, can_close: false, can_delete: false, can_review: false },
      }),
    );
    renderDetail();
    await waitFor(() => {
      expect(screen.getByTestId('post-contact-owner')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('post-contact-owner'));
    expect(pushMock).toHaveBeenCalledWith('/posts/new?post_type=offer');
  });

  /* ------------------------------------------------------------------ */
  /* B2 — edit mode category + privacy                                   */
  /* ------------------------------------------------------------------ */

  it('edit mode exposes the category Pill row and the privacy <select>', async () => {
    getPostMock.mockResolvedValue(makePostDetail());
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: messages.en.postEditAction })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: messages.en.postEditAction }));
    // Seven category pills + a privacy select should all be reachable.
    expect(screen.getByTestId('post-edit-category-food')).toBeTruthy();
    expect(screen.getByTestId('post-edit-category-childcare')).toBeTruthy();
    expect(screen.getByTestId('post-edit-category-transportation')).toBeTruthy();
    expect(screen.getByTestId('post-edit-privacy')).toBeTruthy();
  });

  it('editing the category + privacy and pressing Save fires updatePost with the new values', async () => {
    getPostMock.mockResolvedValue(makePostDetail());
    updatePostMock.mockResolvedValue(makePostDetail({ category: 'translation', privacy: 'public' }));
    renderDetail();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: messages.en.postEditAction })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: messages.en.postEditAction }));
    fireEvent.click(screen.getByTestId('post-edit-category-translation'));
    fireEvent.change(screen.getByTestId('post-edit-privacy'), { target: { value: 'public' } });
    fireEvent.click(screen.getByTestId('post-edit-save'));
    await waitFor(() => {
      expect(updatePostMock).toHaveBeenCalledTimes(1);
    });
    const [, , patch] = updatePostMock.mock.calls[0] as unknown as [
      string,
      string,
      { category: string; privacy: string; title: string; body: string },
    ];
    expect(patch.category).toBe('translation');
    expect(patch.privacy).toBe('public');
  });

  /* ------------------------------------------------------------------ */
  /* M2 — loading state aria-busy                                        */
  /* ------------------------------------------------------------------ */

  it('loading state is announced as a live region with aria-busy', () => {
    // getPostMock never resolves → query stays in loading.
    getPostMock.mockImplementation(() => new Promise(() => {}));
    renderDetail();
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.getAttribute('aria-label')).toBe(messages.en.loadingLabel);
  });
});
