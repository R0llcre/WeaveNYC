import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { NotificationsServiceError, type InternalServiceClaims } from '../types.js';

export const internalServiceClaimsSchema = z.object({
  sub: z.string().min(1),
  scope: z.literal('internal_service'),
  aud: z.literal('notifications-service'),
  iss: z.string().min(1),
  request_id: z.string().min(1).optional(),
  actor: z
    .object({
      sub: z.string().min(1),
      level: z.enum(['anonymous', 'verified', 'anchor']),
      role: z.enum(['user', 'anchor']),
      community_ids: z.array(z.string().min(1)),
      anchor_community_id: z.string().min(1).optional(),
      mfa_verified_at: z.string().min(1).optional(),
      status: z.enum(['active', 'suspended', 'deleted']).optional(),
    })
    .optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
});

export async function authenticateInternalService(request: FastifyRequest, reply: FastifyReply) {
  try {
    const claims = await request.jwtVerify({
      allowedAud: 'notifications-service',
    });
    const parsed = internalServiceClaimsSchema.safeParse(claims);
    if (!parsed.success) {
      throw new NotificationsServiceError('Invalid internal service token', 'forbidden', 403);
    }

    return parsed.data satisfies InternalServiceClaims;
  } catch (error) {
    if (error instanceof NotificationsServiceError) {
      reply.code(error.statusCode);
      return reply.send({ message: error.message });
    }

    reply.code(401);
    return reply.send({ message: 'Missing or invalid internal service token' });
  }
}

export function mintInternalServiceToken(
  app: {
    jwt: { sign(payload: InternalServiceClaims, options?: Record<string, unknown>): string };
    config?: { internalJwt: { issuer: string } };
  },
  input?: Partial<Pick<InternalServiceClaims, 'sub' | 'actor'>>,
) {
  return app.jwt.sign(
    {
      sub: input?.sub ?? 'api-gateway',
      scope: 'internal_service',
      aud: 'notifications-service',
      iss: app.config?.internalJwt.issuer ?? 'weavenyc-api-gateway:internal',
      actor: input?.actor,
    },
    {
      algorithm: 'HS256',
      expiresIn: '5m',
    },
  );
}
