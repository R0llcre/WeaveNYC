import type { FastifyPluginAsync } from "fastify";

import type { ResourceListItem } from "@weavenyc/resource-directory";

import {
  errorResponseSchema,
  resourceDetailSchema,
  resourceDetailQuerySchema,
  resourceListResponseSchema,
  resourcesQuerySchema
} from "../contracts.js";

type ResourcesQuery = {
  zip: string;
  open_now?: boolean;
  today?: boolean;
  type?: "pantry" | "kitchen" | "market" | "benefits" | "other";
  limit?: number;
  cursor?: string;
};

type ResourceDetailParams = {
  provider_id: string;
};

type ResourceDetailQuery = {
  zip?: string;
};

export const resourceRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: ResourcesQuery }>(
    "/v1/resources",
    {
      schema: {
        summary: "Search official resource providers near a ZIP code",
        tags: ["resources"],
        querystring: resourcesQuerySchema,
        response: {
          200: resourceListResponseSchema,
          400: errorResponseSchema
        }
      },
      config: {
        // A5 P0.4 — the /v1/resources search path is un-authenticated by
        // design (anon PWA users must be able to find a pantry) so the only
        // abuse deterrent is IP-based throttling. 60/min/IP = one request
        // per second, which is well above what the PWA does (~1-5 per
        // session) and well below what's useful for scraping a full
        // directory. `@fastify/rate-limit` surfaces x-ratelimit-* headers so
        // legitimate clients can self-throttle.
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.ip,
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await app.resourceDirectory.searchResources({
          zip: request.query.zip,
          openNow: request.query.open_now,
          today: request.query.today,
          type: request.query.type,
          limit: request.query.limit,
          cursor: request.query.cursor ?? null
        });

        // A5 P0 bonus — only surface the hint when the sidecar / monolith
        // actually set it. Keeping it out of the payload by default
        // preserves the existing response shape for happy-path callers.
        const body: {
          items: ReturnType<typeof toResourceSummary>[];
          next_cursor: string | null;
          source_mode: typeof result.sourceMode;
          no_results_in_area?: boolean;
        } = {
          items: result.items.map((item) => toResourceSummary(item)),
          next_cursor: result.nextCursor,
          source_mode: result.sourceMode,
        };
        if (result.noResultsInArea) {
          body.no_results_in_area = true;
        }
        return body;
      } catch (error) {
        if (error instanceof Error && error.name === "InvalidCursorError") {
          reply.code(400);
          return {
            message: "Cursor is not valid"
          };
        }

        throw error;
      }
    }
  );

  app.get<{ Params: ResourceDetailParams; Querystring: ResourceDetailQuery }>(
    "/v1/resources/:provider_id",
    {
      schema: {
        summary: "Get the detail view for a resource provider",
        tags: ["resources"],
        querystring: resourceDetailQuerySchema,
        response: {
          200: resourceDetailSchema,
          404: errorResponseSchema
        }
      },
      config: {
        // Detail lookup is 2x the search limit — a user opening a few
        // detail cards per search is expected, and the downstream DB cost
        // is smaller than a list scan.
        rateLimit: {
          max: 120,
          timeWindow: "1 minute",
          keyGenerator: (request) => request.ip,
        },
      },
    },
    async (request, reply) => {
      const item = await app.resourceDirectory.getResourceDetail(
        request.params.provider_id,
        request.query.zip
      );

      if (!item) {
        reply.code(404);
        return {
          message: "Resource provider not found"
        };
      }

      return {
        ...toResourceSummary(item),
        weekly_hours: item.weeklyHours.map((entry) => ({
          day: entry.day,
          windows: entry.windows.map((window) => ({
            opens_at: window.opensAt,
            closes_at: window.closesAt
          })),
          closed: entry.closed
        })),
        source_url: item.sourceUrl,
        requested_provider_id: item.requestedProviderId ?? null
      };
    }
  );
};

function toResourceSummary(item: ResourceListItem) {
  return {
    provider_id: item.providerId,
    name: item.name,
    type: item.type,
    address: item.address,
    city: item.city,
    state: item.state,
    zip: item.zip,
    phone: item.phone,
    languages: item.languages,
    source: item.source,
    source_label: item.sourceLabel,
    source_dataset_version: item.sourceDatasetVersion ?? null,
    notes: item.notes,
    distance_miles: item.distanceMiles,
    is_open_today: item.isOpenToday,
    is_open_now: item.isOpenNow,
    geo_precision: item.geoPrecision,
    directions_url: buildDirectionsUrl(item.address, item.city, item.state, item.zip)
  };
}

function buildDirectionsUrl(address: string, city: string | null, state: string | null, zip: string) {
  const query = [address, city, state, zip].filter(Boolean).join(", ");
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`;
}
