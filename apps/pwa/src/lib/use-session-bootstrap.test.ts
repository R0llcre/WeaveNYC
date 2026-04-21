// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authReducer, hydrateSession } from './slices/auth-slice';
import { preferencesReducer } from './slices/preferences-slice';
import { communityReducer } from './slices/community-slice';
import { postDraftReducer } from './slices/post-draft-slice';
import { useSessionBootstrap } from './use-session-bootstrap';

// Mock the API module so the hook exercises our branching logic
// without hitting the real network.
const createAnonymousSessionMock = vi.fn();
const refreshSessionMock = vi.fn();

vi.mock('./api', () => ({
  createAnonymousSession: (...args: unknown[]) => createAnonymousSessionMock(...args),
  refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
}));

function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      preferences: preferencesReducer,
      community: communityReducer,
      postDraft: postDraftReducer,
    },
  });
}

function makeWrapper(store: ReturnType<typeof makeStore>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      Provider as React.ComponentType<{
        store: typeof store;
        children: ReactNode;
      }>,
      { store, children },
    );
  };
}

describe('useSessionBootstrap', () => {
  beforeEach(() => {
    createAnonymousSessionMock.mockReset();
    refreshSessionMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mints a new anonymous session when no session is present', async () => {
    createAnonymousSessionMock.mockResolvedValue({
      access_token: 'at_fresh',
      refresh_token: 'rt_fresh',
      user: { user_id: 'u1', level: 'anonymous' },
    });

    const store = makeStore();
    const wrapper = makeWrapper(store);

    await act(async () => {
      renderHook(() => useSessionBootstrap(), { wrapper });
    });

    expect(createAnonymousSessionMock).toHaveBeenCalledTimes(1);
    expect(refreshSessionMock).not.toHaveBeenCalled();
    expect(store.getState().auth.session?.access_token).toBe('at_fresh');
  });

  it('exchanges a rehydrated refresh token for a fresh access_token (A1 P1-6)', async () => {
    // Simulate the post-IndexedDB hydration: Redux slice carries a
    // refresh_token and user shape but the access_token has been
    // stripped. Bootstrap MUST call /v1/auth/refresh to load a fresh
    // access_token rather than minting a new anonymous session.
    refreshSessionMock.mockResolvedValue({
      access_token: 'at_refreshed',
      refresh_token: 'rt_rotated',
      user: { user_id: 'u1', level: 'verified' },
    });

    const store = makeStore();
    store.dispatch(
      hydrateSession({
        access_token: '',
        refresh_token: 'rt_persisted',
        user: { user_id: 'u1', level: 'verified' },
      }),
    );
    const wrapper = makeWrapper(store);

    await act(async () => {
      renderHook(() => useSessionBootstrap(), { wrapper });
    });

    expect(refreshSessionMock).toHaveBeenCalledWith('rt_persisted');
    expect(createAnonymousSessionMock).not.toHaveBeenCalled();
    expect(store.getState().auth.session?.access_token).toBe('at_refreshed');
    expect(store.getState().auth.session?.refresh_token).toBe('rt_rotated');
  });

  it('falls back to an anonymous session if the persisted refresh token is no longer valid', async () => {
    refreshSessionMock.mockRejectedValue(new Error('refresh failed'));
    createAnonymousSessionMock.mockResolvedValue({
      access_token: 'at_fallback',
      refresh_token: 'rt_fallback',
      user: { user_id: 'u_new', level: 'anonymous' },
    });

    const store = makeStore();
    store.dispatch(
      hydrateSession({
        access_token: '',
        refresh_token: 'rt_invalid',
        user: { user_id: 'u_old', level: 'verified' },
      }),
    );
    const wrapper = makeWrapper(store);

    await act(async () => {
      renderHook(() => useSessionBootstrap(), { wrapper });
    });

    expect(refreshSessionMock).toHaveBeenCalledWith('rt_invalid');
    expect(createAnonymousSessionMock).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the session already carries a live access_token', async () => {
    const store = makeStore();
    store.dispatch(
      hydrateSession({
        access_token: 'at_already_live',
        refresh_token: 'rt_live',
        user: { user_id: 'u1', level: 'verified' },
      }),
    );
    const wrapper = makeWrapper(store);

    await act(async () => {
      renderHook(() => useSessionBootstrap(), { wrapper });
    });

    expect(createAnonymousSessionMock).not.toHaveBeenCalled();
    expect(refreshSessionMock).not.toHaveBeenCalled();
  });
});
