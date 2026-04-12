"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  DEFAULT_API_BASE_URL,
  type AdminUser,
  type AuthSession,
  decodeJwtPayload,
  extractCommunityIds,
  getPrimaryCommunityId,
  isRecord,
  normalizeAuthSession,
  readString,
  readStringArray,
} from "@/lib/api";

const REFRESH_TOKEN_STORAGE_KEY = "weavenyc.anchor-admin.refresh-token";
const LAST_ACTIVE_STORAGE_KEY = "weavenyc.anchor-admin.last-active-at";
const SELECTED_COMMUNITY_STORAGE_KEY = "weavenyc.anchor-admin.community-id";
const IDLE_TIMEOUT_MS = 4 * 60 * 60 * 1000;

type AuthStatus = "hydrating" | "signed_out" | "signed_in";

type AuthContextValue = {
  status: AuthStatus;
  user: AdminUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  communityIds: string[];
  selectedCommunityId: string | null;
  primaryCommunityId: string | null;
  isAuthenticated: boolean;
  isVerified: boolean;
  isAnchor: boolean;
  sessionClaims: Record<string, unknown> | null;
  sessionLabel: string;
  signInWithTokens: (
    session: AuthSession,
    options?: { selectedCommunityId?: string | null },
  ) => void;
  signOut: (options?: { redirectToLogin?: boolean; reason?: string }) => void;
  refreshSession: () => Promise<AuthSession | null>;
  requestJson: <T>(
    path: string,
    options?: RequestOptions,
  ) => Promise<T>;
  selectCommunity: (communityId: string) => void;
  touchActivity: () => void;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  retryOn401?: boolean;
};

class ApiRequestError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.body = body;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredLastActive(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(LAST_ACTIVE_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStoredCommunityId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(SELECTED_COMMUNITY_STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

function persistSession(session: AuthSession, selectedCommunityId: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, session.refreshToken);
  window.sessionStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(Date.now()));

  if (selectedCommunityId) {
    window.sessionStorage.setItem(SELECTED_COMMUNITY_STORAGE_KEY, selectedCommunityId);
  }
}

function clearStoredSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.sessionStorage.removeItem(LAST_ACTIVE_STORAGE_KEY);
  window.sessionStorage.removeItem(SELECTED_COMMUNITY_STORAGE_KEY);
}

function parseErrorPayload(payload: unknown): string {
  if (!isRecord(payload)) {
    return "Request failed";
  }

  const message = readString(payload, "message", "error", "detail");
  if (message) {
    return message;
  }

  const errors = readStringArray(payload, "errors");
  if (errors && errors.length > 0) {
    return errors[0];
  }

  return "Request failed";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  if (!raw) {
    return null;
  }

  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function normalizeSelectedCommunityId(
  session: AuthSession,
  explicitCommunityId?: string | null,
): string | null {
  const tokenClaims = decodeJwtPayload(session.accessToken);
  const candidate =
    explicitCommunityId ??
    getPrimaryCommunityId(session.user, tokenClaims) ??
    readStoredCommunityId();

  return candidate && candidate.trim().length > 0 ? candidate : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>("hydrating");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );
  const [sessionClaims, setSessionClaims] = useState<Record<string, unknown> | null>(
    null,
  );

  const communityIds = useMemo(
    () => extractCommunityIds(user, sessionClaims),
    [sessionClaims, user],
  );

  const primaryCommunityId = communityIds[0] ?? null;
  const sessionLevel =
    (typeof sessionClaims?.level === "string" ? sessionClaims.level : undefined) ??
    user?.level ??
    null;
  const sessionRole =
    (typeof sessionClaims?.role === "string" ? sessionClaims.role : undefined) ??
    user?.role ??
    null;
  const isAuthenticated = status === "signed_in" && Boolean(accessToken);
  const isVerified = isAuthenticated && (sessionLevel === "verified" || sessionLevel === "anchor");
  const isAnchor = isAuthenticated && sessionLevel === "anchor";
  const sessionLabel = useMemo(() => {
    if (!isAuthenticated) {
      return "No session";
    }

    const role = sessionRole ?? sessionLevel ?? "unknown";
    const suffix = selectedCommunityId ? ` · ${selectedCommunityId}` : "";
    return `${role}${suffix}`;
  }, [isAuthenticated, selectedCommunityId, sessionLevel, sessionRole]);

  const setSessionState = useCallback(
    (session: AuthSession, explicitCommunityId?: string | null) => {
      const claims = decodeJwtPayload(session.accessToken);
      const nextCommunityId = normalizeSelectedCommunityId(session, explicitCommunityId);

      setAccessToken(session.accessToken);
      setRefreshToken(session.refreshToken);
      setUser(session.user ?? null);
      setSessionClaims(claims);
      setSelectedCommunityId(nextCommunityId);
      setStatus("signed_in");
      persistSession(session, nextCommunityId);
    },
    [],
  );

  const signOut = useCallback(
    (options?: { redirectToLogin?: boolean; reason?: string }) => {
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
      setSessionClaims(null);
      setSelectedCommunityId(null);
      setStatus("signed_out");
      clearStoredSession();

      if (options?.redirectToLogin ?? true) {
        const query = options?.reason ? `?reason=${encodeURIComponent(options.reason)}` : "";
        router.replace(`/login${query}`);
      }
    },
    [router],
  );

  const touchActivity = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.sessionStorage.setItem(LAST_ACTIVE_STORAGE_KEY, String(Date.now()));
  }, []);

  const refreshSession = useCallback(
    async (tokenOverride?: string): Promise<AuthSession | null> => {
      const token = tokenOverride ?? refreshToken;
      if (!token) {
        return null;
      }

      try {
        const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/auth/refresh`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ refresh_token: token }),
        });
        const payload = await parseResponseBody(response);

        if (!response.ok) {
          throw new ApiRequestError(
            parseErrorPayload(payload),
            response.status,
            payload,
          );
        }

        const session = normalizeAuthSession(payload);
        if (!session) {
          throw new ApiRequestError(
            "Refresh response was missing tokens",
            response.status,
            payload,
          );
        }

        setSessionState(session);
        return session;
      } catch {
        signOut({ redirectToLogin: pathname !== "/login", reason: "session" });
        return null;
      }
    },
    [pathname, refreshToken, setSessionState, signOut],
  );

  const requestJson = useCallback(
    async <T,>(
      path: string,
      options: RequestOptions = {},
      retryState = { attemptedRefresh: false, token: accessToken },
    ): Promise<T> => {
      const headers = new Headers(options.headers);
      const method = options.method ?? (options.body ? "POST" : "GET");

      if (options.body !== undefined && !(options.body instanceof FormData)) {
        headers.set("content-type", "application/json");
      }

      if (options.auth !== false && retryState.token) {
        headers.set("authorization", `Bearer ${retryState.token}`);
      }

      touchActivity();

      const response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
        method,
        headers,
        body:
          options.body === undefined
            ? undefined
            : options.body instanceof FormData
              ? options.body
              : JSON.stringify(options.body),
        cache: "no-store",
      });
      const payload = await parseResponseBody(response);

      if (response.status === 401 && options.auth !== false && !retryState.attemptedRefresh) {
        const refreshed = await refreshSession();
        if (refreshed) {
          return requestJson<T>(
            path,
            options,
            { attemptedRefresh: true, token: refreshed.accessToken },
          );
        }
      }

      if (!response.ok) {
        throw new ApiRequestError(
          parseErrorPayload(payload),
          response.status,
          payload,
        );
      }

      return payload as T;
    },
    [accessToken, refreshSession, touchActivity],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const refresh = window.sessionStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    const lastActiveAt = readStoredLastActive();
    const now = Date.now();

    if (!refresh) {
      setStatus("signed_out");
      return;
    }

    if (lastActiveAt !== null && now - lastActiveAt > IDLE_TIMEOUT_MS) {
      signOut({ redirectToLogin: true, reason: "idle" });
      return;
    }

    setRefreshToken(refresh);
    setSelectedCommunityId(readStoredCommunityId());
    void refreshSession(refresh);
  }, [refreshSession, signOut]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const syncCommunity = () => {
      const candidate =
        selectedCommunityId ??
        getPrimaryCommunityId(user, sessionClaims) ??
        readStoredCommunityId();

      if (candidate) {
        window.sessionStorage.setItem(SELECTED_COMMUNITY_STORAGE_KEY, candidate);
      }
    };

    syncCommunity();
  }, [isAuthenticated, selectedCommunityId, sessionClaims, user]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    const update = () => touchActivity();
    const idleCheck = window.setInterval(() => {
      const lastActive = readStoredLastActive();
      if (lastActive === null) {
        return;
      }

      if (Date.now() - lastActive > IDLE_TIMEOUT_MS) {
        signOut({ redirectToLogin: true, reason: "idle" });
      }
    }, 60_000);

    window.addEventListener("pointerdown", update, { passive: true });
    window.addEventListener("keydown", update);
    window.addEventListener("focus", update);

    return () => {
      window.clearInterval(idleCheck);
      window.removeEventListener("pointerdown", update);
      window.removeEventListener("keydown", update);
      window.removeEventListener("focus", update);
    };
  }, [isAuthenticated, signOut, touchActivity]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (communityIds.length === 0) {
      return;
    }

    if (!selectedCommunityId || !communityIds.includes(selectedCommunityId)) {
      setSelectedCommunityId(communityIds[0]);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(SELECTED_COMMUNITY_STORAGE_KEY, communityIds[0]);
      }
    }
  }, [communityIds, isAuthenticated, selectedCommunityId]);

  const signInWithTokens = useCallback(
    (session: AuthSession, options?: { selectedCommunityId?: string | null }) => {
      setSessionState(session, options?.selectedCommunityId ?? null);
    },
    [setSessionState],
  );

  const selectCommunity = useCallback((communityId: string) => {
    const next = communityId.trim();
    setSelectedCommunityId(next.length > 0 ? next : null);
    if (typeof window !== "undefined") {
      if (next.length > 0) {
        window.sessionStorage.setItem(SELECTED_COMMUNITY_STORAGE_KEY, next);
      } else {
        window.sessionStorage.removeItem(SELECTED_COMMUNITY_STORAGE_KEY);
      }
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      accessToken,
      refreshToken,
      communityIds,
      selectedCommunityId,
      primaryCommunityId,
      isAuthenticated,
      isVerified,
      isAnchor,
      sessionClaims,
      sessionLabel,
      signInWithTokens,
      signOut,
      refreshSession,
      requestJson,
      selectCommunity,
      touchActivity,
    }),
    [
      accessToken,
      communityIds,
      isAnchor,
      isAuthenticated,
      isVerified,
      primaryCommunityId,
      refreshSession,
      requestJson,
      selectCommunity,
      selectedCommunityId,
      sessionClaims,
      sessionLabel,
      signInWithTokens,
      signOut,
      status,
      touchActivity,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}

export { ApiRequestError };
