import type { FastifyInstance } from 'fastify';

export async function loadCurrentActor(app: FastifyInstance, userId: string) {
  return app.userStore.getAuthUserById(userId);
}

export function isAnchorForCommunity(actor: { role: string; communityIds: string[] }, communityId: string) {
  return actor.role === 'anchor' && actor.communityIds.includes(communityId);
}
