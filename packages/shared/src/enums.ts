export const userLevels = ["anonymous", "verified", "anchor"] as const;
export type UserLevel = (typeof userLevels)[number];

export const userRoles = ["user", "anchor"] as const;
export type UserRole = (typeof userRoles)[number];
