import { describe, expect, it } from "vitest";

import { ResourceImportRepository } from "../src/lib/repository.js";
import type { NormalizedResourceRecord } from "../src/types.js";

type ActiveRow = {
  provider_id: string;
  source_ref: string;
  content_hash: string | null;
  source: string;
};

class FakeImportClient {
  readonly activeRows = new Map<string, ActiveRow>();
  readonly datasetVersions = new Map<string, { source: string; datasetVersion: string }>();

  async query(sql: string, params: unknown[] = []) {
    if (
      sql.includes("select provider_id, source_ref, content_hash") &&
      sql.includes("from resource_providers")
    ) {
      const source = String(params[0]);
      return {
        rows: Array.from(this.activeRows.values()).filter((row) => row.source === source)
      };
    }

    if (sql.includes("insert into dataset_versions")) {
      const source = String(params[1]);
      const datasetVersion = String(params[2]);
      this.datasetVersions.set(`${source}:${datasetVersion}`, {
        source,
        datasetVersion
      });
      return { rows: [] };
    }

    if (sql.includes("insert into resource_providers")) {
      const providerId = String(params[0]);
      const source = String(params[1]);
      const sourceRef = String(params[2]);
      const contentHash = String(params[16] ?? "");

      this.activeRows.set(`${source}:${sourceRef}`, {
        provider_id: providerId,
        source_ref: sourceRef,
        content_hash: contentHash,
        source
      });

      return { rows: [] };
    }

    return { rows: [] };
  }

  release() {}
}

class FakeImportPool {
  readonly client = new FakeImportClient();

  async connect() {
    return this.client;
  }

  async end() {}
}

const baseRecord: NormalizedResourceRecord = {
  source: "cfc_active",
  sourceRef: "cfc_active:stable-provider",
  name: "Stable Pantry",
  type: "pantry",
  addressText: "1 Main St",
  city: "Farmingdale",
  state: "NY",
  zip: "11735",
  phone: "516-555-0101",
  hoursJson: {
    mon: "09:00AM-12:00PM"
  },
  languages: ["en"],
  eligibilityNotes: "Official listing",
  lat: 40.73,
  lng: -73.44,
  geoPrecision: "street",
  sourceUrl: "https://example.com/cfc"
};

describe("ResourceImportRepository", () => {
  it("keeps provider IDs stable across new dataset versions for the same source_ref", async () => {
    const pool = new FakeImportPool();
    const repository = new ResourceImportRepository(pool as never);

    await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "cfc_active_v1",
      records: [baseRecord]
    });

    const firstProviderId = pool.client.activeRows.get("cfc_active:cfc_active:stable-provider")?.provider_id;

    await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "cfc_active_v2",
      records: [
        {
          ...baseRecord,
          name: "Stable Pantry Updated"
        }
      ]
    });

    const secondProviderId = pool.client.activeRows.get("cfc_active:cfc_active:stable-provider")?.provider_id;

    expect(firstProviderId).toBeDefined();
    expect(secondProviderId).toBe(firstProviderId);
  });

  it("tracks explicit dataset versions per source without cross-source collisions", async () => {
    const pool = new FakeImportPool();
    const repository = new ResourceImportRepository(pool as never);

    await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "shared-version",
      records: [baseRecord]
    });

    await repository.importDataset({
      source: "island_harvest",
      sourceLabel: "Island Harvest",
      sourceUrl: "https://example.com/island",
      datasetVersion: "shared-version",
      records: [
        {
          ...baseRecord,
          source: "island_harvest",
          sourceRef: "island_harvest:stable-provider",
          sourceUrl: "https://example.com/island"
        }
      ]
    });

    expect(pool.client.datasetVersions.has("cfc_active:shared-version")).toBe(true);
    expect(pool.client.datasetVersions.has("island_harvest:shared-version")).toBe(true);
  });
});
