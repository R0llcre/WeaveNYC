import {
  communityAccessResolveRequestSchema as communityAccessResolveBodySchema,
  joinCommunityRequestSchema as joinCommunityBodySchema,
} from '@weavenyc/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  communityAccessResolveRequestSchema,
  communityAccessResolveResponseSchema,
  errorResponseSchema,
  joinCommunityRequestSchema,
  joinCommunityResponseSchema,
} from '../contracts.js';
import { hashClientIpAddress } from '../lib/identity.js';
import { signCommunityJoinToken, verifyCommunityJoinToken, joinTokenTtlSeconds } from '../lib/join-tokens.js';
import { loadCurrentActor } from '../lib/require-anchor.js';
import { PostsServiceError } from '@weavenyc/posts';

type ResolveBody = {
  invite_code?: string;
  qr_token?: string;
};

type JoinParams = {
  community_id: string;
};

type JoinBody = {
  join_token: string;
};

export const communityAccessRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: ResolveBody }>(
    '/v1/community-access/resolve',
    {
      schema: {
        summary: 'Resolve an invite code or QR token into a join preview',
        tags: ['communities'],
        security: [{ bearerAuth: [] }],
        body: communityAccessResolveRequestSchema,
        response: {
          200: communityAccessResolveResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const parsed = communityAccessResolveBodySchema.parse(request.body);
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: 'User not found' };
        }

        // F4-A Fix #2: invite-code brute-force guard. The sibling
        // `/v1/auth/anchor/activate` path already has a `checkAnchorActivateAttempt`
        // bucket (auth.ts) — without a matching one here, an anonymous-auth
        // token could grind invite codes uncapped. Keyed on (userId, ipHash)
        // so a user rotating IPs is still throttled per-user, and a pool of
        // userIds from the same IP is still capped by the IP component. 10/h.
        const ipHash = hashClientIpAddress(request.ip, app.config.identityHashPepper);
        const rateDecision = await app.authAbuseStore.checkCommunityAccessResolve(
          actor.userId,
          ipHash,
        );
        if (!rateDecision.allowed) {
          reply
            .code(429)
            .header('retry-after', String(Math.max(rateDecision.retryAfterSeconds, 1)));
          return {
            message: `Too many community access attempts. Retry in ${rateDecision.retryAfterSeconds}s.`,
          };
        }

        const resolved = await app.postsService.resolveCommunityAccess({
          userId: actor.userId,
          inviteCode: parsed.invite_code,
          qrToken: parsed.qr_token,
        });
        const joinToken = signCommunityJoinToken(app, {
          userId: actor.userId,
          communityId: resolved.community.community_id,
          entry: resolved.entry,
        });

        return {
          community: resolved.community,
          join_token: joinToken,
          entry: resolved.entry,
          expires_in_seconds: joinTokenTtlSeconds,
        };
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );

  app.post<{ Params: JoinParams; Body: JoinBody }>(
    '/v1/communities/:community_id/join',
    {
      schema: {
        summary: 'Join a community using a resolved join token',
        tags: ['communities'],
        security: [{ bearerAuth: [] }],
        body: joinCommunityRequestSchema,
        response: {
          200: joinCommunityResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      const parsed = joinCommunityBodySchema.parse(request.body);
      const claims = verifyCommunityJoinToken(app, parsed.join_token);
      if (!claims || claims.sub !== request.user.sub || claims.community_id !== request.params.community_id) {
        reply.code(400);
        return { message: 'Join token is not valid' };
      }

      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: 'User not found' };
        }

        return await app.postsService.joinCommunity({
          userId: actor.userId,
          communityId: request.params.community_id,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    }
  );
};

function replyWithPostsError(
  reply: { code(statusCode: number): unknown },
  error: unknown
) {
  if (error instanceof PostsServiceError) {
    const statusCode =
      error.code === 'not_found'
        ? 404
        : error.code === 'membership_required' || error.code === 'verified_required'
          ? 403
          : 400;
    reply.code(statusCode);
    return {
      message: error.message,
    };
  }

  throw error;
}
