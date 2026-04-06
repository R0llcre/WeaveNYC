export type UserLevel = "anonymous" | "verified" | "anchor";

export type Role = "user" | "anchor";

export type AnonymousSessionUser = {
  user_id: string;
  level: UserLevel;
};

export type AuthenticatedSessionUser = {
  user_id: string;
  level: UserLevel;
  role: Role;
  community_ids: string[];
};

export type AnonymousSessionRequest = {
  device_id: string;
};

export type RefreshSessionRequest = {
  refresh_token: string;
};

export type AuthSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: AnonymousSessionUser;
  issued_via?: "anonymous" | "otp" | "magic_link" | "refresh";
  fallback?: boolean;
};

export type AnonymousSessionResponse = AuthSessionResponse;

export type OtpStartRequest = {
  phone: string;
};

export type OtpStartResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "sms";
  expires_in_seconds: number;
  fallback: boolean;
  demo_code?: string;
};

export type OtpVerifyRequest = {
  challenge_id: string;
  code: string;
};

export type MagicLinkStartRequest = {
  email: string;
};

export type MagicLinkStartResponse = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "email";
  expires_in_seconds: number;
  fallback: boolean;
  demo_token?: string;
  demo_url?: string;
};

export type MagicLinkVerifyRequest = {
  challenge_id: string;
  token: string;
};

export type JwtClaims = {
  sub: string;
  level: UserLevel;
  role: Role;
  community_ids: string[];
  iat?: number;
  exp?: number;
};

export type EndpointName = "/healthz" | "/readyz";

export type EndpointProbe = {
  endpoint: EndpointName;
  ok: boolean;
  statusCode: number | null;
  detail: string;
};

export type HealthResponse = {
  status: "ok";
  service: "api-gateway";
  timestamp: string;
};

export type ReadinessDependency = {
  name: "postgres" | "redis";
  status: "ok" | "degraded" | "unavailable";
  latency_ms?: number;
  detail?: string;
};

export type ReadinessResponse = {
  status: "ok" | "degraded" | "unavailable";
  service: "api-gateway";
  timestamp: string;
  checks: ReadinessDependency[];
};

export type MeResponse = {
  user: AuthenticatedSessionUser;
};

export type ErrorResponse = {
  message: string;
};

export type ResourceType = "pantry" | "kitchen" | "market" | "benefits" | "other";

export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

export type ResourceHoursEntry = {
  day: string;
  windows: Array<{
    opens_at: string;
    closes_at: string;
  }>;
  closed: boolean;
};

export type ResourceSummary = {
  provider_id: string;
  name: string;
  type: ResourceType;
  address: string;
  city: string | null;
  state: string | null;
  zip: string;
  phone: string | null;
  languages: string[];
  source: string;
  source_label: string | null;
  notes: string | null;
  distance_miles: number | null;
  is_open_today: boolean;
  is_open_now: boolean;
  geo_precision: GeoPrecision;
  directions_url: string;
};

export type ResourceDetail = ResourceSummary & {
  weekly_hours: ResourceHoursEntry[];
  source_url: string | null;
};

export type ResourceListResponse = {
  items: ResourceSummary[];
  next_cursor: string | null;
  source_mode: "api" | "fixture";
};

export type ResourceSearchRequest = {
  zip: string;
  open_now?: boolean;
  today?: boolean;
  type?: ResourceType;
  limit?: number;
  cursor?: string | null;
};
