export const DEFAULT_API_BASE_URL = "http://localhost:4000";

export const API_ENDPOINTS = {
  healthz: "/healthz",
  readyz: "/readyz",
  anonymousSession: "/v1/auth/anonymous",
  me: "/v1/me"
} as const;
