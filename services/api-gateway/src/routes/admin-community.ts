import {
  announcementCreateRequestSchema as announcementCreateBodyValidator,
  announcementUpdateRequestSchema as announcementUpdateBodyValidator,
  communityRulesSchema as communityRulesValidator,
} from "@weavenyc/shared";
import { PostsServiceError } from "@weavenyc/posts";
import type { FastifyPluginAsync } from "fastify";

import {
  adminDashboardResponseSchema,
  announcementCreateRequestSchema,
  adminAnnouncementsQuerySchema,
  announcementParamsSchema,
  announcementSchema,
  announcementUpdateRequestSchema,
  announcementsResponseSchema,
  communityParamsSchema,
  communityRulesResponseSchema,
  communityRulesUpdateRequestSchema,
  errorResponseSchema,
} from "../contracts.js";
import { isAnchorForCommunity, loadCurrentActor } from "../lib/require-anchor.js";

type CommunityParams = {
  community_id: string;
};

type AnnouncementParams = CommunityParams & {
  announcement_id: string;
};

type AnnouncementQuery = {
  include_deleted?: boolean;
};

export const adminCommunityRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: CommunityParams }>(
    "/v1/admin/communities/:community_id/dashboard",
    {
      schema: {
        summary: "Load anchor dashboard metrics for a community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        response: {
          200: adminDashboardResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can access this dashboard" };
        }

        return await app.postsService.getAdminDashboard({
          actor,
          communityId: request.params.community_id,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.get<{ Params: CommunityParams }>(
    "/v1/admin/communities/:community_id/rules",
    {
      schema: {
        summary: "Load community moderation rules",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        response: {
          200: communityRulesResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can access community rules" };
        }

        return await app.postsService.getCommunityRules({
          actor,
          communityId: request.params.community_id,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.put<{ Params: CommunityParams }>(
    "/v1/admin/communities/:community_id/rules",
    {
      schema: {
        summary: "Update community moderation rules",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        body: communityRulesUpdateRequestSchema,
        response: {
          200: communityRulesResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can update community rules" };
        }

        const parsed = communityRulesValidator
          .omit({ community_id: true, updated_at: true })
          .parse(request.body);

        return await app.postsService.updateCommunityRules({
          actor,
          communityId: request.params.community_id,
          rules: parsed,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.get<{ Params: CommunityParams; Querystring: AnnouncementQuery }>(
    "/v1/admin/communities/:community_id/announcements",
    {
      schema: {
        summary: "List admin-visible announcements for a community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        querystring: adminAnnouncementsQuerySchema,
        response: {
          200: announcementsResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can access community announcements" };
        }

        return await app.postsService.listAnnouncements({
          actor,
          communityId: request.params.community_id,
          includeDeleted: request.query.include_deleted ?? true,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.post<{ Params: CommunityParams }>(
    "/v1/admin/communities/:community_id/announcements",
    {
      schema: {
        summary: "Create an announcement for a community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        body: announcementCreateRequestSchema,
        response: {
          200: announcementSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can publish announcements" };
        }

        const body = announcementCreateBodyValidator.parse(request.body);
        return await app.postsService.createAnnouncement({
          actor,
          communityId: request.params.community_id,
          request: body,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.patch<{ Params: AnnouncementParams }>(
    "/v1/admin/communities/:community_id/announcements/:announcement_id",
    {
      schema: {
        summary: "Update an announcement for a community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: announcementParamsSchema,
        body: announcementUpdateRequestSchema,
        response: {
          200: announcementSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can update announcements" };
        }

        const body = announcementUpdateBodyValidator.parse(request.body);
        return await app.postsService.updateAnnouncement({
          actor,
          communityId: request.params.community_id,
          announcementId: request.params.announcement_id,
          request: body,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.delete<{ Params: AnnouncementParams }>(
    "/v1/admin/communities/:community_id/announcements/:announcement_id",
    {
      schema: {
        summary: "Soft-delete an announcement for a community",
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: announcementParamsSchema,
        response: {
          200: announcementSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        if (!isAnchorForCommunity(actor, request.params.community_id)) {
          reply.code(403);
          return { message: "Only anchors can delete announcements" };
        }

        return await app.postsService.deleteAnnouncement({
          actor,
          communityId: request.params.community_id,
          announcementId: request.params.announcement_id,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );

  app.get<{ Params: CommunityParams }>(
    "/v1/communities/:community_id/announcements",
    {
      schema: {
        summary: "List active announcements for the current community",
        tags: ["community"],
        security: [{ bearerAuth: [] }],
        params: communityParamsSchema,
        response: {
          200: announcementsResponseSchema,
          403: errorResponseSchema,
        },
      },
      preHandler: [app.authenticate],
    },
    async (request, reply) => {
      try {
        const actor = await loadCurrentActor(app, request.user.sub);
        if (!actor) {
          reply.code(404);
          return { message: "User not found" };
        }

        return await app.postsService.listAnnouncements({
          actor,
          communityId: request.params.community_id,
          includeDeleted: false,
        });
      } catch (error) {
        return replyWithPostsError(reply, error);
      }
    },
  );
};

function replyWithPostsError(reply: { code(statusCode: number): unknown }, error: unknown) {
  if (error instanceof PostsServiceError) {
    const statusCode =
      error.code === "not_found"
        ? 404
        : error.code === "membership_required" || error.code === "verified_required" || error.code === "forbidden"
          ? 403
          : 400;
    reply.code(statusCode);
    return { message: error.message };
  }

  throw error;
}
