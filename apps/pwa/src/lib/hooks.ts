'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from "@tanstack/react-query";
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
  loadP2PEventCursor,
  loadP2PKeyMaterial,
  loadP2PSyncState,
  saveP2PEventCursor,
  saveP2PKeyMaterial,
  saveP2PSyncState,
} from '@/lib/persistence';
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
        void saveP2PEventCursor({
          communityId,
          since: delta.next_since,
          updatedAt: delta.server_time,
        });

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
