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
export const otpChallengeTtlSeconds = 10 * 60;
export const magicLinkChallengeTtlSeconds = 15 * 60;
export const otpCodeLength = 6;
export const otpMaxAttempts = 5;
export const otpCooldownSeconds = 60 * 60;
export const anonymousAuthWindowSeconds = 60 * 60;
export const anonymousAuthBurstLimit = 10;
export const refreshAuthWindowSeconds = 60 * 60;
export const refreshAuthBurstLimit = 30;
export const otpStartWindowSeconds = 60 * 60;
export const otpStartBurstLimit = 3;
export const authIdentityHashPepperEnvVar = "IDENTITY_HASH_PEPPER";

export const authLevelRank: Record<UserLevel, number> = {
  anonymous: 1,
  verified: 2,
  anchor: 3,
};
