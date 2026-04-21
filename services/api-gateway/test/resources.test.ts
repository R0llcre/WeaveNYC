import { afterEach, describe, expect, it } from "vitest";

import type { ResourceDirectoryService } from "../src/lib/resource-directory.js";
import { createTestApp } from "./helpers.js";

describe("GET /v1/resources", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it("returns nearby resources for a valid ZIP", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=11735&limit=3"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(3);
    expect(body.items[0].provider_id).toBeTruthy();
  });

  it("rejects malformed ZIP values", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=1173"
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  // A5 P0.4 — /v1/resources and /v1/resources/:id are un-authenticated.
  // Rate-limit keys on request.ip so unauthenticated scrapers can't
  // siphon the full directory without drawing attention. 60/min is the
  // contract; we assert the limit kicks in (429) after that many
  // requests from a single IP, and that x-ratelimit-* headers surface
  // so legitimate clients can self-throttle.
  it("surfaces x-ratelimit-* headers and enforces 60/min on search", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=11735&limit=1",
      remoteAddress: "198.51.100.7",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBeDefined();
    expect(Number(response.headers["x-ratelimit-limit"])).toBe(60);
    expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("returns 429 once the per-IP search budget is exhausted", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const ip = "198.51.100.8";
    // Fire 61 requests — the 61st must be blocked.
    let lastStatus = 200;
    for (let i = 0; i < 61; i += 1) {
      const response = await app.inject({
        method: "GET",
        url: "/v1/resources?zip=11735&limit=1",
        remoteAddress: ip,
      });
      lastStatus = response.statusCode;
      if (lastStatus === 429) {
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });

  // A5 P0 bonus — when the sidecar can't geocode the ZIP, it surfaces
  // `noResultsInArea: true` so the gateway can include
  // `no_results_in_area: true` in the response. The PWA renders a
  // distinct empty state from this signal (vs. silently showing an
  // empty list).
  it("surfaces no_results_in_area when the sidecar reports an unresolved ZIP", async () => {
    const resourceDirectory: ResourceDirectoryService = {
      async searchResources() {
        return {
          items: [],
          nextCursor: null,
          sourceMode: "api",
          noResultsInArea: true,
        };
      },
      async getResourceDetail() {
        return null;
      },
      async close() {},
    };

    const { app } = await createTestApp({ resourceDirectory });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=99999",
      remoteAddress: "198.51.100.10",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(0);
    expect(body.no_results_in_area).toBe(true);
  });

  it("omits no_results_in_area on happy-path responses (payload compatibility)", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=11735&limit=1",
      remoteAddress: "198.51.100.11",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.no_results_in_area).toBeUndefined();
  });

  it("rejects tampered cursors", async () => {
    const resourceDirectory: ResourceDirectoryService = {
      async searchResources() {
        const error = new Error("Invalid cursor");
        error.name = "InvalidCursorError";
        throw error;
      },
      async getResourceDetail() {
        return null;
      },
      async close() {},
    };

    const { app } = await createTestApp({ resourceDirectory });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=11735&cursor=abc"
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      message: "Cursor is not valid",
    });
  });
});

describe("GET /v1/resources/:provider_id", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((entry) => entry.close()));
  });

  it("returns a resource detail payload", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const listResponse = await app.inject({
      method: "GET",
      url: "/v1/resources?zip=11735&limit=1"
    });
    const providerId = listResponse.json().items[0].provider_id;

    const detailResponse = await app.inject({
      method: "GET",
      url: `/v1/resources/${providerId}?zip=11735`
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().weekly_hours).toBeTruthy();
    expect(detailResponse.json().requested_provider_id).toBeNull();
  });

  it("rejects malformed detail zip values", async () => {
    const { app } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources/77777777-7777-4777-8777-777777777777?zip=1173"
    });

    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("returns canonical source fields and requested_provider_id for aliased detail lookups", async () => {
    const resourceDirectory: ResourceDirectoryService = {
      async searchResources() {
        return {
          items: [],
          nextCursor: null,
          sourceMode: "api",
        };
      },
      async getResourceDetail() {
        return {
          providerId: "11111111-1111-4111-8111-111111111111",
          requestedProviderId: "22222222-2222-4222-8222-222222222222",
          name: "Canonical Pantry",
          type: "pantry",
          address: "1 Main St",
          city: "Farmingdale",
          state: "NY",
          zip: "11735",
          phone: "516-555-0100",
          languages: ["en"],
          source: "cfc_active",
          sourceLabel: "NYC HRA Community Food Connection",
          sourceUrl: "https://example.com/cfc",
          sourceDatasetVersion: "cfc_active_20260405T101500Z",
          notes: "Canonical merged record",
          distanceMiles: 0.2,
          isOpenToday: true,
          isOpenNow: false,
          geoPrecision: "street",
          weeklyHours: [
            {
              day: "mon",
              windows: [{ opensAt: "09:00AM", closesAt: "12:00PM" }],
              closed: false
            },
          ],
        };
      },
      async close() {},
    };

    const { app } = await createTestApp({ resourceDirectory });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/resources/22222222-2222-4222-8222-222222222222?zip=11735"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      provider_id: "11111111-1111-4111-8111-111111111111",
      requested_provider_id: "22222222-2222-4222-8222-222222222222",
      source: "cfc_active",
      source_dataset_version: "cfc_active_20260405T101500Z",
    });
    expect(response.json().weekly_hours[0]).toMatchObject({
      day: "mon",
      windows: [{ opens_at: "09:00AM", closes_at: "12:00PM" }],
      closed: false,
    });
  });
});
