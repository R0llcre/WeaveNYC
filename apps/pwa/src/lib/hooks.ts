'use client';

import { useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

import {
  getResource,
  getPost,
  joinCommunity,
  listMyPosts,
  listPosts,
  refreshSession,
  resolveCommunityAccess,
  searchResources,
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
  CommunityAccessResolveInput,
  CreatePostInput,
  MagicLinkStartInput,
  MagicLinkVerifyInput,
  MyPostsInput,
  OtpStartInput,
  OtpVerifyInput,
  PostListInput,
  ResourceQueryInput,
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
