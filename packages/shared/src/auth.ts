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
/**
 * Anchor activation brute-force guard (A4 P0-2). 5 attempts per hour per
 * authenticated user; invite-code entropy now comes from the fixture
 * generator (random base32), but this rate limit is defence-in-depth so
 * a compromised access token can't grind through a candidate list.
 */
export const anchorActivateWindowSeconds = 60 * 60;
export const anchorActivateBurstLimit = 5;
/**
 * Undelete endpoint IP bucket (A1 P1-11). Keyed on caller IP (hashed),
 * NOT the body `user_id` — the previous keying was trivially bypassed by
 * submitting a different `user_id` on each attempt. 20/hour/IP is
 * generous enough for a legitimate user mis-typing their token a few
 * times on multiple devices but blocks grind-through attacks.
 */
export const undeleteRequestWindowSeconds = 60 * 60;
export const undeleteRequestBurstLimit = 20;
/**
 * Community-access resolve bucket (F4-A Fix #2). `/v1/community-access/resolve`
 * lets a caller turn an invite code or QR token into a join preview — without
 * this bucket the sibling anchor-activate path had `checkAnchorActivateAttempt`
 * but resolve had nothing, so an anonymous-auth token could grind through
 * invite codes uncapped. 10/hour keyed on the (userId, ipHash) pair matches
 * the grain of `checkUndeleteRequest` — a user rotating IPs can still be
 * throttled per-user, and an attacker rotating userIds from a single IP is
 * still capped by the IP component.
 */
export const communityAccessResolveWindowSeconds = 60 * 60;
export const communityAccessResolveBurstLimit = 10;
/**
 * Anchor MFA step-up freshness window for destructive writes (A4 P0-3).
 * Access tokens live 15 min; anchor sessions can live 4 h (idle TTL).
 * Destructive writes (post approve, report decide, announcement
 * publish/delete, rules overwrite, user suspend, anchor revoke) require
 * a TOTP re-verification newer than this window — the primary JWT
 * `mfa_verified_at` claim is NOT trusted by itself; we cross-check DB
 * `anchors.last_mfa_at`.
 */
export const anchorMfaStepUpMaxAgeSeconds = 15 * 60;
export const authIdentityHashPepperEnvVar = "IDENTITY_HASH_PEPPER";
export const anchorTotpEncryptionKeyEnvVar = "ANCHOR_TOTP_ENCRYPTION_KEY";

export const authLevelRank: Record<UserLevel, number> = {
  anonymous: 1,
  verified: 2,
  anchor: 3,
};
