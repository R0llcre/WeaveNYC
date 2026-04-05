export const userLevels = ["anonymous", "verified", "anchor"] as const;

export type UserLevel = (typeof userLevels)[number];

export type UserRole = "user" | "anchor";

export type SessionUser = {
  user_id: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
};

export type AccessTokenPayload = {
  sub: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
  iat?: number;
  exp?: number;
};

export const accessTokenTtlSeconds = 15 * 60;
export const refreshTokenTtlSeconds = 7 * 24 * 60 * 60;

export const authLevelRank: Record<UserLevel, number> = {
  anonymous: 1,
  verified: 2,
  anchor: 3,
};
