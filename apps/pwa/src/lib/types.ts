export type UserLevel = "anonymous" | "verified" | "anchor";
export type SupportedLanguage = "en" | "es" | "zh";
export type ResourceFilterType = "all" | "pantry" | "kitchen" | "market" | "benefits" | "other";
export type GeoPrecision = "exact" | "rooftop" | "street" | "zip_centroid" | "unknown";

export type AuthUser = {
  user_id: string;
  level: UserLevel;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  issued_via?: "anonymous" | "otp" | "magic_link" | "refresh";
  fallback?: boolean;
};

export type AnonymousSessionResponse = AuthSession;

export type EndpointProbe = {
  endpoint: "/healthz" | "/readyz";
  ok: boolean;
  statusCode: number | null;
  detail: string;
};

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
  type: Exclude<ResourceFilterType, "all">;
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
  is_open_now: boolean;
  is_open_today: boolean;
  geo_precision: GeoPrecision;
  directions_url: string;
};

export type ResourceDetail = ResourceSummary & {
  weekly_hours: ResourceHoursEntry[];
  source_url: string | null;
};

export type ResourcesResponse = {
  items: ResourceSummary[];
  next_cursor: string | null;
  source_mode: "api" | "fixture";
};

export type ResourceQueryInput = {
  zip: string;
  openNow?: boolean;
  today?: boolean;
  type?: ResourceFilterType;
  limit?: number;
  cursor?: string | null;
};

export type PreferencesState = {
  language: SupportedLanguage;
  zipCode: string;
  onboardingComplete: boolean;
  lowBandwidth: boolean;
  bookmarks: string[];
};

export type OtpStartInput = {
  phone: string;
};

export type OtpStartResult = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "sms";
  expires_in_seconds: number;
  fallback: boolean;
  demo_code?: string;
};

export type OtpVerifyInput = {
  challengeId: string;
  code: string;
};

export type MagicLinkStartInput = {
  email: string;
};

export type MagicLinkStartResult = {
  challenge_id: string;
  masked_destination: string;
  delivery_channel: "email";
  expires_in_seconds: number;
  fallback: boolean;
  demo_token?: string;
  demo_url?: string;
};

export type MagicLinkVerifyInput = {
  challengeId: string;
  token: string;
};
