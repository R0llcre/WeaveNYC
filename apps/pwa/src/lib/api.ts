import {
  anonymousAuthResponseSchema,
  healthcheckResponseSchema,
} from "@weavenyc/shared";

import type { AnonymousSessionResponse, EndpointProbe } from '@/lib/types';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
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

export async function probeEndpoint(endpoint: '/healthz' | '/readyz'): Promise<EndpointProbe> {
  try {
    const response = await fetch(`${getApiBaseUrl()}${endpoint}`, {
      cache: 'no-store',
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
      detail: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function createAnonymousSession(): Promise<AnonymousSessionResponse> {
  const response = await fetch(`${getApiBaseUrl()}/v1/auth/anonymous`, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      device_id: getOrCreateDeviceId(),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anonymous session request failed: HTTP ${response.status} ${message}`.trim());
  }

  return anonymousAuthResponseSchema.parse(await response.json());
}

export type { AnonymousSessionResponse } from '@/lib/types';
