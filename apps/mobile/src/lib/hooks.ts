'use client';

import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

import {
  acceptContactRequest,
  blockUser,
  closeConversation,
  createReport,
  createMatchContact,
  getConversation,
  getResource,
  getPost,
  getMatchSuggestions,
  joinCommunity,
  listCommunityAnnouncements,
  listConversationMessages,
  listConversations,
  listContactRequestsInbox,
  listMyPosts,
  listPosts,
  refreshSession,
  rejectContactRequest,
  resolveCommunityAccess,
  searchResources,
  sendConversationMessage,
  startMagicLink,
  startOtp,
  transcribeSpeech,
  verifyMagicLink,
  verifyOtp,
  closePost,
  createPost,
  deletePost,
  getApiBaseUrl,
  updatePost,
} from "@/lib/api";
import { createBrowserP2PWorkerClient, type BrowserP2PWorkerClient } from '@/lib/p2p-worker-client';
import {
  applyCommunitySyncDeltaToCache,
  listPendingPosts,
  loadP2PEventCursor,
  loadP2PKeyMaterial,
  loadP2PSyncState,
  markPendingPostAttempt,
  removePendingPost,
  saveP2PEventCursor,
  saveP2PKeyMaterial,
  saveP2PSyncState,
} from '@/lib/persistence';
import { selectSession } from '@/lib/selectors';
import type {
  BlockUserInput,
  CommunityAccessResolveInput,
  ConversationMessagesInput,
  ConversationsListInput,
  ContactRequestInboxInput,
  CreatePostInput,
  MatchContactInput,
  MagicLinkStartInput,
  MagicLinkVerifyInput,
  MatchResultsResponse,
  MyPostsInput,
  OtpStartInput,
  OtpVerifyInput,
  PostListInput,
  ReportCreateInput,
  ResourceQueryInput,
  SendConversationMessageInput,
  SpeechTranscribeInput,
  P2PKeyMaterial,
  P2PSyncStatus,
  UpdatePostInput,
} from "@/lib/types";
import type { AppDispatch, RootState } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

function buildDefaultP2PSyncStatus(communityId: string | null): P2PSyncStatus {
  return {
    communityId: communityId ?? '',
    enabled: false,
    mdnsDemoEnabled: false,
    phase: 'disabled',
    peerId: null,
    peerCount: 0,
    transportLabel: 'bootstrap',
    lastSyncAt: null,
    latestSnapshot: null,
    lastError: null,
  };
}

function createP2PKeyMaterial(communityId: string): P2PKeyMaterial {
  return {
    communityId,
    peerId: `edge-${crypto.randomUUID()}`,
    createdAt: new Date().toISOString(),
  };
}

export function useResources(input: ResourceQueryInput, enabled = true) {
  return useQuery({
    queryKey: ["resources", input],
    queryFn: () => searchResources(input),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * V2-B win #3 — localStorage-backed variant of `useResources` for the
 * home screen. The underlying `["resources", input]` query is already
 * persisted via `PersistQueryClientProvider` (see
 * `components/providers.tsx`), so return visits rehydrate the result on
 * mount. `placeholderData: keepPreviousData` smooths the typical filter-
 * change flow (user toggles categories / ZIP): instead of flashing the
 * skeleton while the new query loads, we keep the previous result
 * visible and overlay the refreshed data when it lands. Pair with the
 * existing `staleTime: 60_000` so we still refetch in the background on
 * every mount past the minute mark.
 */
export function useCachedResources(input: ResourceQueryInput, enabled = true) {
  return useQuery({
    queryKey: ["resources", input],
    queryFn: () => searchResources(input),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useResource(providerId: string, zip?: string) {
  return useQuery({
    queryKey: ["resource", providerId, zip],
    queryFn: () => getResource(providerId, zip),
    enabled: Boolean(providerId),
    staleTime: 60_000,
  });
}

export function useOtpStart(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: OtpStartInput) => {
      if (!accessToken) {
        throw new Error("Create an anonymous session before starting OTP verification.");
      }

      return startOtp(accessToken, input);
    },
  });
}

export function useOtpVerify(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: OtpVerifyInput) => {
      if (!accessToken) {
        throw new Error("Create an anonymous session before verifying OTP.");
      }

      return verifyOtp(accessToken, input);
    },
  });
}

export function useMagicLinkStart(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: MagicLinkStartInput) => {
      if (!accessToken) {
        throw new Error("Create an anonymous session before requesting a magic link.");
      }

      return startMagicLink(accessToken, input);
    },
  });
}

export function useMagicLinkVerify(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: MagicLinkVerifyInput) => verifyMagicLink(accessToken, input),
  });
}

export function useRefreshSession() {
  return useMutation({
    mutationFn: (refreshToken: string) => refreshSession(refreshToken),
  });
}

export function useCommunityAccessResolve(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: CommunityAccessResolveInput) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before joining a community.');
      }

      return resolveCommunityAccess(accessToken, input);
    },
  });
}

export function useCommunityAnnouncements(
  accessToken: string | null | undefined,
  communityId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['community-announcements', communityId, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before loading community announcements.');
      }

      if (!communityId) {
        throw new Error('Join a community before loading community announcements.');
      }

      return listCommunityAnnouncements(accessToken, communityId);
    },
    enabled: enabled && Boolean(accessToken) && Boolean(communityId),
    staleTime: 60_000,
  });
}

export function useJoinCommunity(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: { communityId: string; joinToken: string }) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before joining a community.');
      }

      return joinCommunity(accessToken, input.communityId, input.joinToken);
    },
  });
}

export function usePosts(accessToken: string | null | undefined, input: PostListInput, enabled = true) {
  return useQuery({
    queryKey: ['posts', input, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before loading posts.');
      }

      return listPosts(accessToken, input);
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 30_000,
  });
}

export function useMyPosts(accessToken: string | null | undefined, input: MyPostsInput = {}, enabled = true) {
  return useQuery({
    queryKey: ['posts', 'mine', input, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before loading your posts.');
      }

      return listMyPosts(accessToken, input);
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 30_000,
  });
}

export function usePost(accessToken: string | null | undefined, postId: string, enabled = true) {
  return useQuery({
    queryKey: ['post', postId, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before loading a post.');
      }

      return getPost(accessToken, postId);
    },
    enabled: enabled && Boolean(accessToken) && Boolean(postId),
    staleTime: 30_000,
  });
}

export function useMatchSuggestions(accessToken: string | null | undefined, postId: string, enabled = true) {
  return useQuery({
    queryKey: ['post-matches', postId, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before loading action plans.');
      }

      return getMatchSuggestions(accessToken, postId, false);
    },
    enabled: enabled && Boolean(accessToken) && Boolean(postId),
    staleTime: 30_000,
  });
}

export function useRefreshMatchSuggestions(accessToken: string | null | undefined, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<MatchResultsResponse> => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before refreshing action plans.');
      }

      return getMatchSuggestions(accessToken, postId, true);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['post-matches', postId, accessToken], data);
    },
  });
}

export function useCreateMatchContact(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MatchContactInput) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before requesting contact.');
      }

      return createMatchContact(accessToken, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useContactRequestsInbox(
  accessToken: string | null | undefined,
  input: ContactRequestInboxInput = {},
  enabled = true,
  refetchInterval = 0,
) {
  return useQuery({
    queryKey: ['inbox', 'requests', input, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Verify this session before opening the inbox requests view.');
      }

      return listContactRequestsInbox(accessToken, input);
    },
    enabled: enabled && Boolean(accessToken),
    refetchInterval: refetchInterval > 0 ? refetchInterval : false,
    staleTime: 10_000,
  });
}

export function useAcceptContactRequest(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactRequestId: string) => {
      if (!accessToken) {
        throw new Error('Verify this session before accepting contact requests.');
      }

      return acceptContactRequest(accessToken, contactRequestId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useRejectContactRequest(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactRequestId: string) => {
      if (!accessToken) {
        throw new Error('Verify this session before rejecting contact requests.');
      }

      return rejectContactRequest(accessToken, contactRequestId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useConversations(
  accessToken: string | null | undefined,
  input: ConversationsListInput = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['inbox', 'chats', input, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Verify this session before opening the inbox chats view.');
      }

      return listConversations(accessToken, input);
    },
    enabled: enabled && Boolean(accessToken),
    staleTime: 10_000,
  });
}

export function useConversation(
  accessToken: string | null | undefined,
  conversationId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['conversation', conversationId, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Verify this session before opening a conversation.');
      }

      return getConversation(accessToken, conversationId);
    },
    enabled: enabled && Boolean(accessToken) && Boolean(conversationId),
    staleTime: 10_000,
  });
}

export function useConversationPlaceholder(
  accessToken: string | null | undefined,
  conversationId: string,
  enabled = true,
) {
  return useConversation(accessToken, conversationId, enabled);
}

export function useConversationMessages(
  accessToken: string | null | undefined,
  conversationId: string,
  input: ConversationMessagesInput = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['conversation', conversationId, 'messages', input, accessToken],
    queryFn: () => {
      if (!accessToken) {
        throw new Error('Verify this session before loading conversation messages.');
      }

      return listConversationMessages(accessToken, conversationId, input);
    },
    enabled: enabled && Boolean(accessToken) && Boolean(conversationId),
    staleTime: 5_000,
  });
}

export function useSendConversationMessage(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendConversationMessageInput) => {
      if (!accessToken) {
        throw new Error('Verify this session before sending a message.');
      }

      return sendConversationMessage(accessToken, input);
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['conversation', data.conversation_id] });
      void queryClient.invalidateQueries({ queryKey: ['conversation', data.conversation_id, 'messages'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useCloseConversation(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => {
      if (!accessToken) {
        throw new Error('Verify this session before closing a conversation.');
      }

      return closeConversation(accessToken, conversationId);
    },
    onSuccess: (_, conversationId) => {
      void queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useBlockUser(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: BlockUserInput) => {
      if (!accessToken) {
        throw new Error('Verify this session before blocking a user.');
      }

      return blockUser(accessToken, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversation'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useCreateReport(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: ReportCreateInput) => {
      if (!accessToken) {
        throw new Error('Verify this session before creating a report.');
      }

      return createReport(accessToken, input);
    },
  });
}

export function useCreatePost(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePostInput) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before publishing a post.');
      }

      return createPost(accessToken, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useUpdatePost(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { postId: string; patch: UpdatePostInput }) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before editing a post.');
      }

      return updatePost(accessToken, input.postId, input.patch);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['post', variables.postId] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useClosePost(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before closing a post.');
      }

      return closePost(accessToken, postId);
    },
    onSuccess: (_, postId) => {
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useDeletePost(accessToken: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before deleting a post.');
      }

      return deletePost(accessToken, postId);
    },
    onSuccess: (_, postId) => {
      void queryClient.invalidateQueries({ queryKey: ['post', postId] });
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useSpeechTranscribe(accessToken: string | null | undefined) {
  return useMutation({
    mutationFn: (input: SpeechTranscribeInput) => {
      if (!accessToken) {
        throw new Error('Create an anonymous session before using server speech fallback.');
      }

      return transcribeSpeech(accessToken, input);
    },
  });
}

export function useCommunityP2PSync(accessToken: string | null | undefined, communityId: string | null) {
  const queryClient = useQueryClient();
  const workerRef = useRef<BrowserP2PWorkerClient | null>(null);
  const cursorSinceRef = useRef<string | null>(null);
  const [status, setStatus] = useState<P2PSyncStatus>(buildDefaultP2PSyncStatus(communityId));
  const [keyMaterial, setKeyMaterial] = useState<P2PKeyMaterial | null>(null);

  useEffect(() => {
    let cancelled = false;

    workerRef.current?.dispose();
    workerRef.current = null;
    cursorSinceRef.current = null;
    setStatus(buildDefaultP2PSyncStatus(communityId));
    setKeyMaterial(null);

    if (!communityId) {
      return;
    }

    void (async () => {
      const [storedStatus, storedKeyMaterial, storedCursor] = await Promise.all([
        loadP2PSyncState(communityId),
        loadP2PKeyMaterial(communityId),
        loadP2PEventCursor(communityId),
      ]);

      if (cancelled) {
        return;
      }

      const nextKeyMaterial = storedKeyMaterial ?? createP2PKeyMaterial(communityId);
      if (!storedKeyMaterial) {
        void saveP2PKeyMaterial(nextKeyMaterial);
      }

      setStatus(
        storedStatus
          ? {
              ...storedStatus,
              communityId,
            }
          : buildDefaultP2PSyncStatus(communityId),
      );
      setKeyMaterial(nextKeyMaterial);
      cursorSinceRef.current = storedCursor?.since ?? null;
    })();

    return () => {
      cancelled = true;
    };
  }, [communityId]);

  useEffect(() => {
    if (!communityId) {
      workerRef.current?.dispose();
      workerRef.current = null;
      return;
    }

    if (status.communityId !== communityId) {
      workerRef.current?.dispose();
      workerRef.current = null;
      return;
    }

    if (!accessToken || !keyMaterial || !status.enabled) {
      workerRef.current?.dispose();
      workerRef.current = null;
      return;
    }

    const client = createBrowserP2PWorkerClient({
      onStatus(nextStatus) {
        setStatus((current) => ({
          ...current,
          ...nextStatus,
          enabled: true,
        }));
      },
      onSync(nextStatus, delta) {
        setStatus((current) => ({
          ...current,
          ...nextStatus,
          enabled: true,
        }));

        if (!delta) {
          return;
        }

        cursorSinceRef.current = delta.next_since;

        void applyCommunitySyncDeltaToCache(delta);

        if (delta.events.length > 0) {
          void queryClient.invalidateQueries({
            predicate: (query) =>
              Array.isArray(query.queryKey) &&
              query.queryKey[0] === 'posts' &&
              query.queryKey[1] !== 'mine',
          });
          void queryClient.invalidateQueries({ queryKey: ['community-announcements', communityId] });
        }
      },
      onError(nextStatus, error) {
        setStatus((current) => ({
          ...current,
          ...nextStatus,
          enabled: true,
          lastError: error,
        }));
      },
      onCursorUpdate(update) {
        // The worker emits this whenever it wants to persist a new `since`
        // cursor. Persistence is main-thread-owned so Dexie / IndexedDB stays
        // single-writer; the worker itself serializes multi-tab races via a
        // Web Lock around the message emission.
        if (update.communityId !== communityId) {
          return;
        }
        cursorSinceRef.current = update.since;
        void saveP2PEventCursor({
          communityId: update.communityId,
          since: update.since,
          updatedAt: update.updatedAt,
        });
      },
    });

    if (!client) {
      setStatus((current) => ({
        ...current,
        communityId,
        enabled: true,
        phase: 'degraded',
        peerId: keyMaterial.peerId,
        lastError: 'Web Workers are unavailable in this browser.',
      }));
      return;
    }

    workerRef.current = client;
    client.start({
      apiBaseUrl: getApiBaseUrl(),
      accessToken,
      communityId,
      peerId: keyMaterial.peerId,
      mdnsDemoEnabled: status.mdnsDemoEnabled,
      since: cursorSinceRef.current,
      limit: 100,
    });

    return () => {
      client.dispose();
      if (workerRef.current === client) {
        workerRef.current = null;
      }
    };
  }, [accessToken, communityId, keyMaterial, queryClient, status.enabled, status.mdnsDemoEnabled]);

  // Bridge lifecycle events into the worker: network coming back online
  // or the app returning to the foreground should force an immediate
  // sync rather than waiting up to 30s for the next poll tick.
  //
  // TODO(mobile): the PWA binds to `window.addEventListener('online')`
  // and `document.addEventListener('visibilitychange')`. In React
  // Native the equivalents are `@react-native-community/netinfo`'s
  // `addEventListener` (for online/offline) and `AppState.addEventListener`
  // (for active/background). Wiring those lives in M6 alongside the
  // real P2P worker rewrite — the worker client is a stub on mobile
  // today (see `@/lib/p2p-worker-client`), so there's nothing to kick.
  // The PWA `typeof window === 'undefined'` SSR guard short-circuits
  // on mobile because no web `document.addEventListener` exists; we
  // keep the guards explicit so a mis-polyfilled RN environment that
  // fakes `window` without `document` can't throw at module load.
  useEffect(() => {
    const g = globalThis as typeof globalThis & {
      window?: { addEventListener?: unknown; removeEventListener?: unknown };
      document?: { addEventListener?: unknown; removeEventListener?: unknown; visibilityState?: string };
    };
    if (typeof g.window === 'undefined' || typeof g.window.addEventListener !== 'function') {
      return;
    }
    if (typeof g.document === 'undefined' || typeof g.document.addEventListener !== 'function') {
      return;
    }

    const handleOnline = () => {
      workerRef.current?.sync();
    };

    const handleVisibilityChange = () => {
      if (g.document && g.document.visibilityState === 'visible') {
        workerRef.current?.sync();
      }
    };

    (g.window.addEventListener as (t: string, h: () => void) => void)('online', handleOnline);
    (g.document.addEventListener as (t: string, h: () => void) => void)(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      (g.window?.removeEventListener as (t: string, h: () => void) => void)?.(
        'online',
        handleOnline,
      );
      (g.document?.removeEventListener as (t: string, h: () => void) => void)?.(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
  }, []);

  useEffect(() => {
    if (!communityId) {
      return;
    }

    void saveP2PSyncState({
      ...status,
      communityId,
      peerId: keyMaterial?.peerId ?? status.peerId,
    });
  }, [communityId, keyMaterial?.peerId, status]);

  const updateStatus = (updater: (current: P2PSyncStatus) => P2PSyncStatus) => {
    setStatus((current) => updater(current));
  };

  return {
    status: {
      ...status,
      communityId: communityId ?? '',
      peerId: keyMaterial?.peerId ?? status.peerId,
    },
    enable() {
      updateStatus((current) => ({
        ...current,
        communityId: communityId ?? '',
        enabled: true,
        phase: current.phase === 'disabled' ? 'connecting' : current.phase,
        lastError: null,
        peerId: keyMaterial?.peerId ?? current.peerId,
      }));
    },
    disable() {
      workerRef.current?.dispose();
      workerRef.current = null;
      updateStatus((current) => ({
        ...current,
        communityId: communityId ?? '',
        enabled: false,
        phase: 'disabled',
        peerCount: 0,
        lastError: null,
      }));
    },
    setMdnsDemoEnabled(enabled = false) {
      updateStatus((current) => ({
        ...current,
        mdnsDemoEnabled: enabled,
        transportLabel: enabled ? 'mdns-demo' : 'bootstrap',
      }));
      workerRef.current?.updateConfig(enabled);
    },
    syncNow() {
      workerRef.current?.sync();
    },
  };
}

/* ------------------------------------------------------------------------- */
/* useOutboxDrain — offline-publish drain loop.                              */
/*                                                                           */
/* Mounts once near the top of the tree (see `ShellFrame`) so it runs        */
/* regardless of which screen is visible. On `online`, on visibility         */
/* returning to `'visible'`, and on initial mount, it walks the pendingPosts */
/* table and replays each entry against `createPost`. Success removes the    */
/* entry and invalidates post caches. Network / 5xx failure leaves the       */
/* entry in place with an incremented `attempt_count` so the NEXT trigger    */
/* (online event, tab focus, user retry) picks it up — the exponential       */
/* backoff is implicit in the trigger cadence, not a timer. 4xx is marked    */
/* permanent so the pending-posts UI can show a distinct "failed" state and  */
/* we avoid thrashing the server.                                            */
/* ------------------------------------------------------------------------- */

/**
 * Parse the HTTP status from an error thrown by `requestJson`. The helper
 * throws `new Error(\`${path} failed: HTTP ${response.status} ${message}\`)`;
 * this reader extracts the status so the drain loop can tell a 4xx semantic
 * rejection from a 5xx/network transient. Returns `null` on parse failure —
 * an unknown shape is treated as a transient (safer to retry than to
 * permanent-fail).
 */
function readHttpStatusFromError(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message !== 'string') {
    return null;
  }
  const match = /HTTP\s+(\d{3})/.exec(message);
  if (!match || !match[1]) {
    return null;
  }
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

function isPermanentFailure(status: number | null): boolean {
  // 4xx (excluding 408 Request Timeout and 429 Too Many Requests which are
  // transient) is a semantic rejection we should not auto-retry.
  if (status === null) {
    return false;
  }
  if (status === 408 || status === 429) {
    return false;
  }
  return status >= 400 && status < 500;
}

/**
 * Drain the offline write outbox. Returns a stable object so callers in
 * tests can introspect state without triggering re-drains.
 *
 * Callers: mount exactly once near the shell root. Multiple mounts would
 * each install their own listeners and cause redundant drains. The drain
 * itself is idempotent per-entry (a 2xx response removes the entry; a
 * concurrent enqueue of the same `client_id` overwrites rather than
 * duplicates), so duplicate listeners are not correctness-critical — just
 * wasteful.
 */
export function useOutboxDrain() {
  const queryClient = useQueryClient();
  const session = useAppSelector(selectSession);
  const accessToken = session?.access_token ?? null;
  // Guard so a slow fetch response arriving after unmount doesn't mutate
  // IDB. The listener effects also short-circuit on cancelled.
  const drainingRef = useRef(false);

  useEffect(() => {
    // TODO(mobile): the PWA binds `window.addEventListener('online')`
    // and `document.addEventListener('visibilitychange')` to trigger
    // a drain pass. RN equivalents are `NetInfo.addEventListener` +
    // `AppState.addEventListener('change')`. M6 (outbox rewrite) wires
    // those. For now we still run a single drain pass on mount so a
    // user who published-while-offline and then opens the app online
    // gets their queued posts sent — but without the online / focus
    // listeners, a long-running session that regains connectivity
    // won't auto-flush until the user re-mounts this hook.
    const g = globalThis as typeof globalThis & {
      window?: { addEventListener?: unknown; removeEventListener?: unknown };
      document?: { addEventListener?: unknown; removeEventListener?: unknown; visibilityState?: string };
    };

    let cancelled = false;

    const runDrain = async () => {
      // Hard guards: no session → no Authorization header → every call
      // 401s. Skip entirely and wait for the session effect to re-fire
      // this hook via the `accessToken` dependency.
      if (!accessToken) {
        return;
      }
      // Re-entrance guard: don't start a second pass while the first is
      // still walking the queue. This prevents e.g. a visibilitychange
      // firing mid-`online` drain from kicking off a parallel pass that
      // would race the IDB writes.
      if (drainingRef.current) {
        return;
      }
      drainingRef.current = true;

      try {
        const pending = await listPendingPosts();
        for (const entry of pending) {
          if (cancelled) {
            return;
          }
          // Skip 4xx-marked entries — they're semantic failures that need
          // user action. A manual "Retry now" on the pending-posts screen
          // clears `last_failure_permanent` by calling `enqueuePendingPost`
          // with the same `client_id`, which overwrites the row.
          if (entry.last_failure_permanent) {
            continue;
          }
          try {
            const result = await createPost(accessToken, entry.payload);
            if (cancelled) {
              return;
            }
            await removePendingPost(entry.client_id);
            // Nudge the post caches — both "all posts" lists and the
            // user's own posts list may now need to reflect the newly
            // published post. We don't navigate (the user might be
            // anywhere in the app); just freshen the data.
            void queryClient.invalidateQueries({ queryKey: ['posts'] });
            // Also drop the post-detail cache so a subsequent visit to
            // `/posts/{id}` reloads from the server rather than from a
            // stale cache key.
            void queryClient.invalidateQueries({ queryKey: ['post', result.post_id] });
          } catch (error) {
            const status = readHttpStatusFromError(error);
            const permanent = isPermanentFailure(status);
            const message = error instanceof Error ? error.message : String(error);
            await markPendingPostAttempt(entry.client_id, message, {
              permanent,
            });
            // On transient failure we stop the current pass (exponential
            // backoff = wait for the next trigger). On permanent failure
            // we continue the walk because other entries may still send.
            if (!permanent) {
              return;
            }
          }
        }
      } finally {
        drainingRef.current = false;
      }
    };

    // Run once on mount — picks up anything queued while the user was
    // offline in a previous session.
    void runDrain();

    const handleOnline = () => {
      void runDrain();
    };

    const handleVisibilityChange = () => {
      if (g.document && g.document.visibilityState === 'visible') {
        void runDrain();
      }
    };

    if (
      typeof g.window !== 'undefined' &&
      typeof g.window.addEventListener === 'function'
    ) {
      (g.window.addEventListener as (t: string, h: () => void) => void)('online', handleOnline);
    }
    if (
      typeof g.document !== 'undefined' &&
      typeof g.document.addEventListener === 'function'
    ) {
      (g.document.addEventListener as (t: string, h: () => void) => void)(
        'visibilitychange',
        handleVisibilityChange,
      );
    }

    return () => {
      cancelled = true;
      (g.window?.removeEventListener as ((t: string, h: () => void) => void) | undefined)?.(
        'online',
        handleOnline,
      );
      (g.document?.removeEventListener as ((t: string, h: () => void) => void) | undefined)?.(
        'visibilitychange',
        handleVisibilityChange,
      );
    };
    // `accessToken` is a stable string-or-null for a given session; the
    // hook reruns the setup when the user signs in/out, which is the
    // correct moment to re-check the queue anyway.
  }, [accessToken, queryClient]);
}
