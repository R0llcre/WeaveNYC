export const userLevels = ["anonymous", "verified", "anchor"] as const;
export const anchorSessionIssuedViaValues = ["anonymous", "otp", "magic_link", "refresh", "anchor_activate", "anchor_session"] as const;

export type UserLevel = (typeof userLevels)[number];

export type UserRole = "user" | "anchor";

export type SessionUser = {
  user_id: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
  anchor_community_id?: string;
  mfa_verified_at?: string;
};

export type AccessTokenPayload = {
  sub: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
  anchor_community_id?: string;
  mfa_verified_at?: string;
  iat?: number;
  exp?: number;
};

export const accessTokenTtlSeconds = 15 * 60;
export const refreshTokenTtlSeconds = 7 * 24 * 60 * 60;
export const otpChallengeTtlSeconds = 10 * 60;
export const magicLinkChallengeTtlSeconds = 15 * 60;
export const anchorActivationChallengeTtlSeconds = 10 * 60;
export const anchorSessionChallengeTtlSeconds = 5 * 60;
export const anchorSessionIdleTtlSeconds = 4 * 60 * 60;
export const communityJoinTokenTtlSeconds = 10 * 60;
export const otpCodeLength = 6;
export const otpMaxAttempts = 5;
export const otpCooldownSeconds = 60 * 60;
export const totpDigits = 6;
export const totpMaxAttempts = 5;
export const totpStepSeconds = 30;
export const totpAllowedSkewWindows = 1;
export const anonymousAuthWindowSeconds = 60 * 60;
export const anonymousAuthBurstLimit = 10;
export const refreshAuthWindowSeconds = 60 * 60;
export const refreshAuthBurstLimit = 30;
export const otpStartWindowSeconds = 60 * 60;
export const otpStartBurstLimit = 3;
export const accountDeleteWindowSeconds = 60 * 60;
export const accountDeleteBurstLimit = 3;
export const recoveryCodeWindowSeconds = 60 * 60;
export const recoveryCodeBurstLimit = 5;
export const authIdentityHashPepperEnvVar = "IDENTITY_HASH_PEPPER";
export const anchorTotpEncryptionKeyEnvVar = "ANCHOR_TOTP_ENCRYPTION_KEY";

export const authLevelRank: Record<UserLevel, number> = {
  anonymous: 1,
  verified: 2,
  anchor: 3,
};
