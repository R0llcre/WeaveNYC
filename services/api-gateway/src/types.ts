export type UserLevel = 'anonymous' | 'verified' | 'anchor';

export type UserRole = 'user' | 'anchor';

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface AuthTokenClaims {
  sub: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
  anchor_community_id?: string;
  mfa_verified_at?: string;
  iat?: number;
  exp?: number;
}

export interface CommunityJoinTokenClaims {
  sub: string;
  community_id: string;
  entry: "invite_code" | "qr_token";
  scope: "community_join";
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUserRecord {
  userId: string;
  level: UserLevel;
  role: UserRole;
  status: UserStatus;
  communityIds: string[];
  anchorCommunityId?: string | null;
  mfaVerifiedAt?: string;
}

export interface AnchorCommunityRecord {
  communityId: string;
  name: string;
  centerZip: string;
  joinPolicy: "invite_only" | "open";
}

export interface AnchorInviteRecord {
  inviteId: string;
  community: AnchorCommunityRecord;
  orgName: string;
}

export interface AnchorAdminRecord {
  anchorId: string;
  userId: string;
  communityId: string;
  orgName: string;
  status: "pending_activation" | "active" | "revoked";
  totpSecretCiphertext: string | null;
  recoveryCodesHashes: string[];
  activatedAt: string | null;
  lastMfaAt: string | null;
}

export interface StoredRefreshSession {
  userId: string;
  level: UserLevel;
  role: UserRole;
  communityIds: string[];
  familyId: string;
  anchorCommunityId?: string | null;
  mfaVerifiedAt?: string;
  lastActivityAt?: string;
}
