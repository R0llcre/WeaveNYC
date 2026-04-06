import { randomUUID } from "node:crypto";

import { otpChallengeTtlSeconds, magicLinkChallengeTtlSeconds, otpMaxAttempts } from "@weavenyc/shared";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

import {
  anonymousAuthRequestSchema,
  anonymousAuthResponseSchema,
  errorResponseSchema,
  magicLinkStartRequestSchema,
  magicLinkStartResponseSchema,
  magicLinkVerifyRequestSchema,
  otpStartRequestSchema,
  otpStartResponseSchema,
  otpVerifyRequestSchema,
  refreshSessionRequestSchema
} from "../contracts.js";
import {
  buildStoredRefreshSession,
  type StoredIdentityChallenge
} from "../lib/refresh-token-store.js";
import { createOpaqueRefreshToken, signAccessToken } from "../lib/tokens.js";
import {
  type AuthAbuseStore,
  createOtpCode,
  generateIdentitySalt,
  hashEmailIdentity,
  hashPhoneAbuseKey,
  hashPhoneIdentity,
  maskEmailAddress,
  maskPhoneNumber,
  normalizeEmail,
  normalizePhoneNumber
} from "../lib/identity.js";
import {
  createMagicLinkToken,
  StubEmailLinkProvider,
  StubSmsProvider
} from "../lib/verification-providers.js";
import type { AuthenticatedUserRecord } from "../types.js";

type AnonymousAuthBody = {
  device_id: string;
};

type RefreshSessionBody = {
  refresh_token: string;
};

type OtpStartBody = {
  phone: string;
};

type OtpVerifyBody = {
  challenge_id: string;
  code: string;
};

type MagicLinkStartBody = {
  email: string;
};

type MagicLinkVerifyBody = {
  challenge_id: string;
  token: string;
};

const smsProvider = new StubSmsProvider();
const emailProvider = new StubEmailLinkProvider("http://localhost:3000");

export const authRoutes: FastifyPluginAsync = async (app) => {
  const authAbuseStore = getAuthAbuseStore(app);

  app.post<{ Body: AnonymousAuthBody }>(
    "/v1/auth/anonymous",
    {
      schema: {
        summary: "Create an anonymous authenticated session",
        tags: ["auth"],
        body: anonymousAuthRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const anonymousDecision = await authAbuseStore.checkAnonymousAuth(request.ip);
      if (!anonymousDecision.allowed) {
        reply.code(429);
        return {
          message: `Too many anonymous session attempts. Retry in ${anonymousDecision.retryAfterSeconds}s.`
        };
      }

      const user = await app.userStore.createAnonymousUser(request.body.device_id);
      return issueSessionResponse(app, user, "anonymous");
    }
  );

  app.post<{ Body: RefreshSessionBody }>(
    "/v1/auth/refresh",
    {
      schema: {
        summary: "Rotate a refresh token and mint a new session",
        tags: ["auth"],
        body: refreshSessionRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          401: errorResponseSchema,
          429: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const refreshInspection = await app.refreshTokenStore.inspectSession(request.body.refresh_token);
      if (refreshInspection.status === "active") {
        const refreshDecision = await authAbuseStore.checkRefreshAttempt(
          refreshInspection.session.userId
        );
        if (!refreshDecision.allowed) {
          reply.code(429);
          return {
            message: `Too many refresh attempts. Retry in ${refreshDecision.retryAfterSeconds}s.`
          };
        }
      }

      const nextRefreshToken = createOpaqueRefreshToken();
      const rotation = await app.refreshTokenStore.rotateSession(
        request.body.refresh_token,
        nextRefreshToken
      );

      if (rotation.status !== "rotated") {
        reply.code(401);
        return {
          message:
            rotation.status === "replayed"
              ? "Refresh token replay detected"
              : "Refresh token is not valid"
        };
      }

      return {
        access_token: signAccessToken(app, {
          userId: rotation.session.userId,
          level: rotation.session.level,
          role: rotation.session.role,
          status: "active",
          communityIds: rotation.session.communityIds
        }),
        refresh_token: nextRefreshToken,
        issued_via: "refresh",
        user: {
          user_id: rotation.session.userId,
          level: rotation.session.level
        }
      };
    }
  );

  app.post<{ Body: OtpStartBody }>(
    "/v1/auth/otp/start",
    {
      schema: {
        summary: "Start phone verification for the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: otpStartRequestSchema,
        response: {
          200: otpStartResponseSchema,
          400: errorResponseSchema,
          429: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      try {
        const normalizedPhone = normalizePhoneNumber(request.body.phone);
        const identitySalt = generateIdentitySalt();
        const identityHash = hashPhoneIdentity(
          normalizedPhone,
          identitySalt,
          app.config.identityHashPepper
        );
        const abuseHash = hashPhoneAbuseKey(
          normalizedPhone,
          app.config.identityHashPepper
        );
        const otpDecision = await authAbuseStore.checkOtpStart(request.user.sub, abuseHash);
        if (!otpDecision.allowed) {
          reply.code(429);
          return {
            message: `OTP temporarily unavailable. Retry in ${otpDecision.retryAfterSeconds}s.`
          };
        }

        const challengeId = randomUUID();
        const code = createOtpCode();
        const challenge: StoredIdentityChallenge = {
          challengeId,
          kind: "otp",
          userId: request.user.sub,
          identityHash,
          identitySalt,
          abuseHash,
          maskedDestination: maskPhoneNumber(normalizedPhone),
          codeOrToken: code,
          attemptsRemaining: otpMaxAttempts,
          expiresAt: Date.now() + otpChallengeTtlSeconds * 1000
        };

        await app.refreshTokenStore.createOtpChallenge(challenge);
        const delivery = await smsProvider.sendOtp({
          phone: normalizedPhone,
          code,
          challengeId
        });

        return {
          challenge_id: challengeId,
          masked_destination: challenge.maskedDestination,
          delivery_channel: "sms",
          expires_in_seconds: otpChallengeTtlSeconds,
          fallback: delivery.fallback,
          demo_code: delivery.demoCode
        };
      } catch (error) {
        reply.code(400);
        return {
          message: error instanceof Error ? error.message : "Unable to start OTP verification"
        };
      }
    }
  );

  app.post<{ Body: OtpVerifyBody }>(
    "/v1/auth/otp/verify",
    {
      schema: {
        summary: "Verify an OTP and upgrade the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: otpVerifyRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      const challengeResult = await app.refreshTokenStore.verifyChallenge({
        challengeId: request.body.challenge_id,
        kind: "otp",
        codeOrToken: request.body.code
      });

      if (challengeResult.status === "exhausted") {
        await authAbuseStore.activateOtpCooldown(
          challengeResult.challenge.abuseHash ?? challengeResult.challenge.identityHash
        );
        reply.code(400);
        return {
          message: "OTP challenge is not valid"
        };
      }

      if (challengeResult.status !== "verified" || challengeResult.challenge.userId !== request.user.sub) {
        reply.code(400);
        return {
          message: "OTP challenge is not valid"
        };
      }

      const user = await app.userStore.verifyUserPhone(
        request.user.sub,
        challengeResult.challenge.identityHash,
        challengeResult.challenge.identitySalt
      );

      if (!user) {
        reply.code(404);
        return {
          message: "User not found"
        };
      }

      await app.refreshTokenStore.revokeUserSessions(request.user.sub);
      return issueSessionResponse(app, user, "otp", true);
    }
  );

  app.post<{ Body: MagicLinkStartBody }>(
    "/v1/auth/magic-link/start",
    {
      schema: {
        summary: "Start magic-link fallback verification for the current session",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        body: magicLinkStartRequestSchema,
        response: {
          200: magicLinkStartResponseSchema,
          400: errorResponseSchema
        }
      },
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      try {
        const normalizedEmail = normalizeEmail(request.body.email);
        const identitySalt = generateIdentitySalt();
        const identityHash = hashEmailIdentity(
          normalizedEmail,
          identitySalt,
          app.config.identityHashPepper
        );
        const challengeId = randomUUID();
        const token = createMagicLinkToken();
        const challenge: StoredIdentityChallenge = {
          challengeId,
          kind: "magic_link",
          userId: request.user.sub,
          identityHash,
          identitySalt,
          abuseHash: null,
          maskedDestination: maskEmailAddress(normalizedEmail),
          codeOrToken: token,
          attemptsRemaining: 1,
          expiresAt: Date.now() + magicLinkChallengeTtlSeconds * 1000
        };

        await app.refreshTokenStore.createMagicLinkChallenge(challenge);
        const delivery = await emailProvider.sendMagicLink({
          email: normalizedEmail,
          challengeId,
          token
        });

        return {
          challenge_id: challengeId,
          masked_destination: challenge.maskedDestination,
          delivery_channel: "email",
          expires_in_seconds: magicLinkChallengeTtlSeconds,
          fallback: delivery.fallback,
          demo_token: delivery.demoToken,
          demo_url: delivery.demoUrl
        };
      } catch (error) {
        reply.code(400);
        return {
          message: error instanceof Error ? error.message : "Unable to start magic-link verification"
        };
      }
    }
  );

  app.post<{ Body: MagicLinkVerifyBody }>(
    "/v1/auth/magic-link/verify",
    {
      schema: {
        summary: "Verify a magic-link challenge and upgrade the current session",
        tags: ["auth"],
        body: magicLinkVerifyRequestSchema,
        response: {
          200: anonymousAuthResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema
        }
      }
    },
    async (request, reply) => {
      const challengeResult = await app.refreshTokenStore.verifyChallenge({
        challengeId: request.body.challenge_id,
        kind: "magic_link",
        codeOrToken: request.body.token
      });

      if (challengeResult.status !== "verified") {
        reply.code(400);
        return {
          message: "Magic-link challenge is not valid"
        };
      }

      const user = await app.userStore.verifyUserEmail(
        challengeResult.challenge.userId,
        challengeResult.challenge.identityHash,
        challengeResult.challenge.identitySalt
      );

      if (!user) {
        reply.code(404);
        return {
          message: "User not found"
        };
      }

      await app.refreshTokenStore.revokeUserSessions(challengeResult.challenge.userId);
      return issueSessionResponse(app, user, "magic_link", true);
    }
  );
};

function getAuthAbuseStore(app: FastifyInstance): AuthAbuseStore {
  return (app as FastifyInstance & { authAbuseStore: AuthAbuseStore }).authAbuseStore;
}

async function issueSessionResponse(
  app: FastifyInstance,
  user: AuthenticatedUserRecord,
  issuedVia: "anonymous" | "otp" | "magic_link" | "refresh",
  fallback?: boolean
) {
  const refreshToken = createOpaqueRefreshToken();
  await app.refreshTokenStore.createSession(
    refreshToken,
    buildStoredRefreshSession({
      userId: user.userId,
      level: user.level,
      role: user.role,
      communityIds: user.communityIds
    })
  );

  return {
    access_token: signAccessToken(app, user),
    refresh_token: refreshToken,
    issued_via: issuedVia,
    fallback,
    user: {
      user_id: user.userId,
      level: user.level
    }
  };
}
