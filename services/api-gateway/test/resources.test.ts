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
