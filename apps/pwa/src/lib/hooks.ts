'use client';

import { useMutation, useQuery } from "@tanstack/react-query";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";

import {
  getResource,
  refreshSession,
  searchResources,
  startMagicLink,
  startOtp,
  verifyMagicLink,
  verifyOtp,
} from "@/lib/api";
import type {
  MagicLinkStartInput,
  MagicLinkVerifyInput,
  OtpStartInput,
  OtpVerifyInput,
  ResourceQueryInput,
} from "@/lib/types";
import type { AppDispatch, RootState } from "@/lib/store";

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
