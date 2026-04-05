export type UserLevel = "anonymous" | "verified" | "anchor";

export type Role = "user" | "anchor";

export type AnonymousSessionUser = {
  user_id: string;
  level: UserLevel;
};

export type AnonymousSessionRequest = {
  device_id: string;
};

export type AnonymousSessionResponse = {
  access_token: string;
  refresh_token: string;
  user: AnonymousSessionUser;
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
  ok: true;
  service: "api-gateway";
  timestamp: string;
};

export type ReadinessResponse =
  | {
      ok: true;
      checks: {
        postgres: true;
        redis: true;
      };
      timestamp: string;
    }
  | {
      ok: false;
      checks: {
        postgres: boolean;
        redis: boolean;
      };
      timestamp: string;
    };

export type MeResponse = {
  user_id: string;
  level: UserLevel;
  role: Role;
  community_ids: string[];
};
