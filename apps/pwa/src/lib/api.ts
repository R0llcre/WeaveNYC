import {
  anonymousAuthResponseSchema,
  healthcheckResponseSchema,
  magicLinkStartResponseSchema,
  magicLinkVerifyResponseSchema,
  otpStartResponseSchema,
  otpVerifyResponseSchema,
  refreshSessionResponseSchema,
  resourceDetailSchema,
  resourceListResponseSchema,
} from "@weavenyc/shared";

import type {
  AnonymousSessionResponse,
  EndpointProbe,
  MagicLinkStartInput,
  MagicLinkStartResult,
  MagicLinkVerifyInput,
  OtpStartInput,
  OtpStartResult,
  OtpVerifyInput,
  ResourceDetail,
  ResourceQueryInput,
  ResourcesResponse,
} from "@/lib/types";

const DEFAULT_API_BASE_URL = "http://localhost:4000";
const DEVICE_ID_STORAGE_KEY = "weavenyc.device_id";

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function getOrCreateDeviceId() {
  if (typeof window === "undefined") {
    return crypto.randomUUID();
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export async function probeEndpoint(endpoint: "/healthz" | "/readyz"): Promise<EndpointProbe> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const parsed = healthcheckResponseSchema.safeParse(payload);

    return {
      endpoint,
      ok: response.ok,
      statusCode: response.status,
      detail: parsed.success
        ? `${parsed.data.service} ${parsed.data.status}`
        : response.ok
          ? `HTTP ${response.status}`
          : `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      statusCode: null,
      detail: error instanceof Error ? error.message : "Network error",
    };
  }
}

export async function createAnonymousSession(): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/anonymous",
    {
      method: "POST",
      body: JSON.stringify({
        device_id: getOrCreateDeviceId(),
      }),
    },
    anonymousAuthResponseSchema,
  );
}

export async function refreshSession(refreshToken: string): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify({
        refresh_token: refreshToken,
      }),
    },
    refreshSessionResponseSchema,
  );
}

export async function startOtp(accessToken: string, input: OtpStartInput): Promise<OtpStartResult> {
  return requestJson(
    "/v1/auth/otp/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        phone: input.phone,
      }),
    },
    otpStartResponseSchema,
  );
}

export async function verifyOtp(accessToken: string, input: OtpVerifyInput): Promise<AnonymousSessionResponse> {
  return requestJson(
    "/v1/auth/otp/verify",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        challenge_id: input.challengeId,
        code: input.code,
      }),
    },
    otpVerifyResponseSchema,
  );
}

export async function startMagicLink(
  accessToken: string,
  input: MagicLinkStartInput,
): Promise<MagicLinkStartResult> {
  return requestJson(
    "/v1/auth/magic-link/start",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email: input.email,
      }),
    },
    magicLinkStartResponseSchema,
  );
}

export async function verifyMagicLink(
  accessToken: string | null | undefined,
  input: MagicLinkVerifyInput,
): Promise<AnonymousSessionResponse> {
  const headers = accessToken
    ? {
        Authorization: `Bearer ${accessToken}`,
      }
    : undefined;

  return requestJson(
    "/v1/auth/magic-link/verify",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        challenge_id: input.challengeId,
        token: input.token,
      }),
    },
    magicLinkVerifyResponseSchema,
  );
}

export async function searchResources(input: ResourceQueryInput): Promise<ResourcesResponse> {
  const params = new URLSearchParams({
    zip: input.zip,
  });

  if (input.openNow) {
    params.set("open_now", "true");
  }

  if (input.today) {
    params.set("today", "true");
  }

  if (input.type && input.type !== "all") {
    params.set("type", input.type);
  }

  if (input.limit) {
    params.set("limit", String(input.limit));
  }

  if (input.cursor) {
    params.set("cursor", input.cursor);
  }

  return requestJson(`/v1/resources?${params.toString()}`, {}, resourceListResponseSchema);
}

export async function getResource(providerId: string, zip?: string): Promise<ResourceDetail> {
  const suffix = zip ? `?zip=${encodeURIComponent(zip)}` : "";
  return requestJson(`/v1/resources/${providerId}${suffix}`, {}, resourceDetailSchema);
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  schema: { parse(input: unknown): T },
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers,
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`${path} failed: HTTP ${response.status} ${message}`.trim());
  }

  return schema.parse(await response.json());
}

export type { AnonymousSessionResponse, ResourceDetail, ResourcesResponse } from '@/lib/types';
