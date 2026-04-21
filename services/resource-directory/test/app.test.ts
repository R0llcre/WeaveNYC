import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResourceDirectoryConfig } from "../src/config.js";
import { buildResourceDirectoryApp } from "../src/app.js";
import { StubGeocoder } from "../src/lib/geocoding.js";

/**
 * Tests the Cloud Run sidecar's internal search-resources route end-to-end
 * (through Fastify, through the ResourceQueryRepository, through a hand-
 * rolled pg Pool fake). The regression this file locks in is A5 P0.5:
 *
 *   Before the fix, the sidecar called
 *   `queryRepository.searchResources(input, { lat: null, lng: null })` with
 *   nulls hardcoded. With no lat/lng the haversine radius filter collapsed
 *   to "zip string exact match" and a Farmingdale (11735) user never saw a
 *   Bethpage (11714) pantry 2 miles away. The fix now geocodes the caller's
 *   ZIP the same way the monolith path does.
 */

const INTERNAL_SECRET = "weavenyc-dev-internal-service-jwt-secret";
const INTERNAL_ISSUER = "weavenyc-api-gateway:internal";

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signInternalToken(audience: string) {
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlJson({
    iss: INTERNAL_ISSUER,
    aud: audience,
    scope: "internal_service",
    request_id: "test-request",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const signature = createHmac("sha256", INTERNAL_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

function createTestConfig(): ResourceDirectoryConfig {
  return {
    env: "test",
    server: { host: "127.0.0.1", port: 0 },
    databaseUrl: "postgres://test:test@127.0.0.1:5432/test",
    internalJwt: {
      issuer: INTERNAL_ISSUER,
      secret: INTERNAL_SECRET,
    },
    sentry: { dsn: null, tracesSampleRate: 0 },
    runtime: {
      serviceName: "resource-directory-service",
      version: "0.1.0-test",
    },
  };
}

/**
 * Vitest's module-level mock intercepts `new Pool(...)` inside
 * buildResourceDirectoryApp so the test never touches a real DB. The
 * `mockRowsRef` hook lets each test swap its dataset without rebuilding
 * the mock.
 */
const mockRowsRef: { current: unknown[] } = { current: [] };
vi.mock("pg", () => {
  class Pool {
    constructor() {}
    async query() {
      return { rows: mockRowsRef.current };
    }
    async end() {}
    connect() {
      throw new Error("connect not used by query path");
    }
  }
  return { Pool };
});

describe("resource-directory sidecar — /internal/v1/resource-directory/search-resources", () => {
  const apps: Array<{ close: () => Promise<unknown> }> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()!.close();
    }
  });

  it("rejects requests without an internal service token", async () => {
    mockRowsRef.current = [];
    const app = await buildResourceDirectoryApp({
      config: createTestConfig(),
      geocoder: new StubGeocoder({}),
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/resource-directory/search-resources",
      payload: { zip: "11735" },
    });

    expect(response.statusCode).toBe(401);
  });

  it("returns a neighboring-ZIP pantry within 10 miles (A5 P0.5 regression guard)", async () => {
    mockRowsRef.current = [
      // Same ZIP as the requester.
      {
        provider_id: "11111111-1111-4111-8111-111111111111",
        source: "cfc_active",
        source_ref: "cfc_active:1",
        name: "Farmingdale Pantry",
        type: "pantry",
        address_text: "1 Main St",
        city: "Farmingdale",
        state: "NY",
        zip: "11735",
        phone: null,
        hours_json: {},
        languages: ["en"],
        eligibility_notes: null,
        lat: 40.7326,
        lng: -73.4454,
        geo_precision: "street",
        dataset_version: "cfc_active_v1",
        source_label: "CFC",
        source_url: "https://example.com/cfc",
      },
      // Neighboring ZIP (~2 miles away) — this is the row that the broken
      // sidecar was silently filtering out because lat/lng was null.
      {
        provider_id: "22222222-2222-4222-8222-222222222222",
        source: "island_harvest",
        source_ref: "ih:2",
        name: "Bethpage Pantry",
        type: "pantry",
        address_text: "2 Broadway",
        city: "Bethpage",
        state: "NY",
        zip: "11714",
        phone: null,
        hours_json: {},
        languages: ["en"],
        eligibility_notes: null,
        lat: 40.7443,
        lng: -73.4821,
        geo_precision: "street",
        dataset_version: "island_harvest_v1",
        source_label: "Island Harvest",
        source_url: "https://example.com/island",
      },
      // Far-away ZIP (Buffalo) — should NOT be returned regardless.
      {
        provider_id: "33333333-3333-4333-8333-333333333333",
        source: "island_harvest",
        source_ref: "ih:3",
        name: "Buffalo Pantry",
        type: "pantry",
        address_text: "1 Elm St",
        city: "Buffalo",
        state: "NY",
        zip: "14201",
        phone: null,
        hours_json: {},
        languages: ["en"],
        eligibility_notes: null,
        lat: 42.8864,
        lng: -78.8784,
        geo_precision: "street",
        dataset_version: "island_harvest_v1",
        source_label: "Island Harvest",
        source_url: "https://example.com/island",
      },
    ];

    const geocoder = new StubGeocoder({
      "zip:11735": { lat: 40.7326, lng: -73.4454, geoPrecision: "zip_centroid" },
    });

    const app = await buildResourceDirectoryApp({
      config: createTestConfig(),
      geocoder,
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/resource-directory/search-resources",
      headers: {
        authorization: `Bearer ${signInternalToken("resource-directory-service")}`,
      },
      payload: { zip: "11735" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      items: Array<{ name: string; zip: string; distanceMiles: number | null }>;
    };
    const names = body.items.map((item) => item.name);
    expect(names).toContain("Farmingdale Pantry");
    expect(names).toContain("Bethpage Pantry");
    expect(names).not.toContain("Buffalo Pantry");

    // The neighbor must carry a populated distance — the whole point of the
    // fix is that lat/lng actually flow through to the haversine calculation.
    const neighbor = body.items.find((item) => item.zip === "11714");
    expect(neighbor).toBeDefined();
    expect(neighbor!.distanceMiles).not.toBeNull();
    expect(neighbor!.distanceMiles!).toBeLessThan(10);
  });

  // A5 P0 bonus — when the geocoder can't resolve the requester's ZIP
  // the sidecar tags the response with noResultsInArea: true so the
  // PWA can render a specific empty state.
  it("marks noResultsInArea when the geocoder returns null lat/lng", async () => {
    mockRowsRef.current = [];

    const app = await buildResourceDirectoryApp({
      config: createTestConfig(),
      // Empty stub → geocodeZip falls through to the unknown branch.
      geocoder: new StubGeocoder({}),
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/internal/v1/resource-directory/search-resources",
      headers: {
        authorization: `Bearer ${signInternalToken("resource-directory-service")}`,
      },
      payload: { zip: "99999" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      items: unknown[];
      noResultsInArea?: boolean;
    };
    expect(body.items).toHaveLength(0);
    expect(body.noResultsInArea).toBe(true);
  });
});
