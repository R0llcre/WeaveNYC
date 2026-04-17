import { healthcheckResponseSchema } from "@weavenyc/shared";

export const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type HealthStatus = {
  ok: boolean;
  endpoint: string;
  status: number | null;
  detail: string;
};

export type AdminUser = {
  user_id?: string;
  id?: string;
  email?: string;
  name?: string;
  level?: string;
  role?: string;
  community_id?: string;
  anchor_community_id?: string;
  community_ids?: string[];
  [key: string]: unknown;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user?: AdminUser;
};

export type AnchorActivateResponse = {
  activation_id: string;
  community?: {
    community_id?: string;
    name?: string;
    join_policy?: string;
    center_zip?: string;
  };
  otpauth_uri?: string;
  recovery_codes?: string[];
  expires_in_seconds?: number;
};

export type AnchorActivationConfirmResponse = {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  user?: AdminUser;
};

export type AnchorSessionStartResponse = {
  challenge_id: string;
  expires_in_seconds?: number;
};

export type AnchorSessionVerifyResponse = AnchorActivationConfirmResponse & {
  issued_via?: string;
};

export type AnchorSessionRecoveryResponse = AnchorActivationConfirmResponse & {
  issued_via?: string;
  remaining_attempts?: number;
};

export type AnchorSessionRecoveryErrorBody = {
  message?: string;
  remaining_attempts?: number;
  retry_after_seconds?: number;
};

export type OtpStartResponse = {
  challenge_id: string;
  expires_in_seconds?: number;
};

export type OtpVerifyResponse = AnchorActivationConfirmResponse & {
  issued_via?: string;
};

export type MagicLinkStartResponse = {
  challenge_id: string;
  expires_in_seconds?: number;
};

export type MagicLinkVerifyResponse = AnchorActivationConfirmResponse & {
  issued_via?: string;
};

export type AdminDashboardResponse = {
  posts_this_week_request_count: number;
  posts_this_week_offer_count: number;
  accepted_contacts_this_week_count: number;
  reports_this_week_count: number;
  pending_post_review_count: number;
  pending_report_count: number;
};

export type ReviewQueueItem = {
  post_id?: string;
  report_id?: string;
  community_id?: string;
  title?: string;
  body?: string;
  category?: string;
  risk_level?: string;
  status?: string;
  priority?: string;
  reporter_alias?: string;
  target_type?: string;
  target_summary?:
    | string
    | {
        title?: string;
        body_preview?: string | null;
        related_user_id?: string | null;
      };
  created_at?: string;
  notes?: string;
  [key: string]: unknown;
};

export type ReviewQueueResponse = {
  items?: ReviewQueueItem[];
  cursor?: string | null;
  next_cursor?: string | null;
};

export type ReviewDecisionResponse = {
  post_id?: string;
  report_id?: string;
  status?: string;
  decision?: string;
  resolved_at?: string;
  moderation_action_id?: string;
};

export type AnnouncementItem = {
  announcement_id?: string;
  community_id?: string;
  title?: string;
  body?: string;
  status?: string;
  pinned?: boolean;
  is_pinned?: boolean;
  pin_strategy?: string;
  published_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type AnnouncementListResponse = {
  items?: AnnouncementItem[];
  cursor?: string | null;
};

export type CommunityRules = {
  review_categories: string[];
  auto_hide_report_threshold: number;
  keyword_blocklist: string[];
  language_preferences: string[];
  announcement_pin_strategy: string;
};

export type CommunityRulesResponse = CommunityRules & {
  community_id?: string;
  updated_at?: string;
};

export type ApiErrorPayload = {
  message: string;
  status: number;
  body: unknown;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readString(
  value: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return undefined;
}

export function readNumber(
  value: Record<string, unknown>,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function readBoolean(
  value: Record<string, unknown>,
  ...keys: string[]
): boolean | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }
  return undefined;
}

export function readStringArray(
  value: Record<string, unknown>,
  ...keys: string[]
): string[] | undefined {
  for (const key of keys) {
    const candidate = value[key];
    if (
      Array.isArray(candidate) &&
      candidate.every((item) => typeof item === "string")
    ) {
      return candidate.filter((item) => item.trim().length > 0);
    }
  }
  return undefined;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }

  return Buffer.from(padded, "base64").toString("utf8");
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractCommunityIds(
  user: AdminUser | null | undefined,
  fallbackClaims?: Record<string, unknown> | null,
): string[] {
  const ids = new Set<string>();

  const add = (candidate: unknown) => {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      ids.add(candidate);
    }
  };

  if (user) {
    add(user.community_id);
    add(user.anchor_community_id);
    for (const communityId of user.community_ids ?? []) {
      add(communityId);
    }
  }

  if (fallbackClaims) {
    add(readString(fallbackClaims, "community_id", "anchor_community_id"));
    const communityIds = readStringArray(fallbackClaims, "community_ids");
    for (const communityId of communityIds ?? []) {
      add(communityId);
    }
  }

  return Array.from(ids);
}

export function getPrimaryCommunityId(
  user: AdminUser | null | undefined,
  fallbackClaims?: Record<string, unknown> | null,
): string | null {
  return extractCommunityIds(user, fallbackClaims)[0] ?? null;
}

export function normalizeAuthSession(
  payload: unknown,
): AuthSession | null {
  if (!isRecord(payload)) {
    return null;
  }

  const accessToken = readString(payload, "access_token", "accessToken");
  const refreshToken = readString(payload, "refresh_token", "refreshToken");

  if (!accessToken || !refreshToken) {
    return null;
  }

  const user = isRecord(payload.user) ? (payload.user as AdminUser) : undefined;

  return {
    accessToken,
    refreshToken,
    user,
  };
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export class AnchorRecoveryError extends Error {
  status: number;
  remainingAttempts: number | null;
  retryAfterSeconds: number | null;
  body: unknown;

  constructor(
    message: string,
    status: number,
    remainingAttempts: number | null,
    retryAfterSeconds: number | null,
    body: unknown,
  ) {
    super(message);
    this.name = "AnchorRecoveryError";
    this.status = status;
    this.remainingAttempts = remainingAttempts;
    this.retryAfterSeconds = retryAfterSeconds;
    this.body = body;
  }
}

export async function submitAnchorRecoveryCode(
  accessToken: string,
  input: { communityId: string; recoveryCode: string },
): Promise<AnchorSessionRecoveryResponse> {
  const response = await fetch(
    `${DEFAULT_API_BASE_URL}/v1/auth/anchor/session/recovery`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        community_id: input.communityId,
        recovery_code: input.recoveryCode.trim().toUpperCase(),
      }),
      cache: "no-store",
    },
  );

  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText.length > 0) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const remainingAttempts = isRecord(payload)
      ? readNumber(payload, "remaining_attempts") ?? null
      : null;
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10)
      : null;
    const message =
      (isRecord(payload) ? readString(payload, "message", "detail", "error") : null) ??
      `Recovery request failed with status ${response.status}`;
    throw new AnchorRecoveryError(
      message,
      response.status,
      remainingAttempts,
      Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
      payload,
    );
  }

  return (payload ?? {}) as AnchorSessionRecoveryResponse;
}

export async function fetchHealth(endpoint: string): Promise<HealthStatus> {
  try {
    const response = await fetch(`${DEFAULT_API_BASE_URL}${endpoint}`, {
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    const parsed = healthcheckResponseSchema.safeParse(payload);

    return {
      ok: response.ok,
      endpoint,
      status: response.status,
      detail: parsed.success
        ? `${parsed.data.service} ${parsed.data.status}`
        : response.ok
          ? "reachable"
          : `responded with ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      endpoint,
      status: null,
      detail: error instanceof Error ? error.message : "request failed",
    };
  }
}
