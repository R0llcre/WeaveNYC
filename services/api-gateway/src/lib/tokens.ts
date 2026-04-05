import { randomBytes } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { AuthTokenClaims, AuthenticatedUserRecord } from '../types.js';

export function createOpaqueRefreshToken(): string {
  return `rt_${randomBytes(32).toString('base64url')}`;
}

export function buildAccessTokenClaims(user: AuthenticatedUserRecord): AuthTokenClaims {
  return {
    sub: user.userId,
    level: user.level,
    role: user.role,
    community_ids: user.communityIds
  };
}

export function signAccessToken(app: FastifyInstance, user: AuthenticatedUserRecord): string {
  return app.jwt.sign(buildAccessTokenClaims(user), {
    algorithm: 'RS256',
    expiresIn: app.config.jwt.accessTokenTtl,
    iss: app.config.jwt.issuer
  });
}
