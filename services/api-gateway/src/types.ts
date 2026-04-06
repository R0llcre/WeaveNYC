export type UserLevel = 'anonymous' | 'verified' | 'anchor';

export type UserRole = 'user' | 'anchor';

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface AuthTokenClaims {
  sub: string;
  level: UserLevel;
  role: UserRole;
  community_ids: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUserRecord {
  userId: string;
  level: UserLevel;
  role: UserRole;
  status: UserStatus;
  communityIds: string[];
}

export interface StoredRefreshSession {
  userId: string;
  level: UserLevel;
  role: UserRole;
  communityIds: string[];
  familyId: string;
}
