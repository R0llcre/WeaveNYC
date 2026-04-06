import type { CommunityAccessEntry } from '@weavenyc/shared';
import { communityJoinTokenTtlSeconds as joinTokenTtlSeconds } from '@weavenyc/shared';
import type { FastifyInstance } from 'fastify';

import type { CommunityJoinTokenClaims } from '../types.js';

export function signCommunityJoinToken(
  app: FastifyInstance,
  input: { userId: string; communityId: string; entry: CommunityAccessEntry }
) {
  return app.jwt.sign(
    {
      sub: input.userId,
      community_id: input.communityId,
      entry: input.entry,
      scope: 'community_join',
    } satisfies CommunityJoinTokenClaims,
    {
      algorithm: 'RS256',
      expiresIn: `${joinTokenTtlSeconds}s`,
      iss: app.config.jwt.issuer,
    }
  );
}

export function verifyCommunityJoinToken(app: FastifyInstance, token: string) {
  try {
    const claims = app.jwt.verify<CommunityJoinTokenClaims>(token);
    if (claims.scope !== 'community_join') {
      return null;
    }

    return claims;
  } catch {
    return null;
  }
}

export { joinTokenTtlSeconds };
