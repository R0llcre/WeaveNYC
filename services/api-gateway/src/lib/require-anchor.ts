import type { FastifyInstance } from 'fastify';

export async function loadCurrentActor(app: FastifyInstance, userId: string) {
  return app.userStore.getAuthUserById(userId);
}

export function isAnchorForCommunity(
  actor: { role: string; anchorCommunityId?: string | null },
  communityId: string,
) {
  return actor.role === 'anchor' && actor.anchorCommunityId === communityId;
}
