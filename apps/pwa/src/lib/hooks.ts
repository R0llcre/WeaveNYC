'use client';

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
  updatePost,
} from "@/lib/api";
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
  UpdatePostInput,
} from "@/lib/types";
import type { AppDispatch, RootState } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

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
