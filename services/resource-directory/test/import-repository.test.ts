import { describe, expect, it } from "vitest";

import { ImportCompletenessError, ResourceImportRepository } from "../src/lib/repository.js";
import type { NormalizedResourceRecord } from "../src/types.js";

type ActiveRow = {
  provider_id: string;
  source_ref: string;
  content_hash: string | null;
  source: string;
  status: "active" | "inactive";
};

class FakeImportClient {
  constructor(private readonly pool: FakeImportPool) {}

  async query(sql: string, params: unknown[] = []) {
    if (
      sql.includes("select provider_id, source_ref, content_hash") &&
      sql.includes("from resource_providers")
    ) {
      const source = String(params[0]);
      return {
        rows: Array.from(this.pool.activeRows.values()).filter(
          (row) => row.source === source && row.status === "active",
        ),
      };
    }

    if (
      sql.includes("update resource_providers") &&
      sql.includes("set status = 'inactive'")
    ) {
      const source = String(params[0]);
      for (const [key, row] of this.pool.activeRows.entries()) {
        if (row.source === source && row.status === "active") {
          this.pool.activeRows.set(key, { ...row, status: "inactive" });
        }
      }
      return { rows: [] };
    }

    if (sql.includes("insert into dataset_versions")) {
      const source = String(params[1]);
      const datasetVersion = String(params[2]);
      this.pool.datasetVersions.set(`${source}:${datasetVersion}`, {
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

      this.pool.activeRows.set(`${source}:${sourceRef}`, {
        provider_id: providerId,
        source_ref: sourceRef,
        content_hash: contentHash,
        source,
        status: "active",
      });

      return { rows: [] };
    }

    return { rows: [] };
  }

  release() {}
}

class FakeImportPool {
  readonly activeRows = new Map<string, ActiveRow>();
  readonly datasetVersions = new Map<string, { source: string; datasetVersion: string }>();
  readonly client = new FakeImportClient(this);

  async query(sql: string, params: unknown[] = []) {
    // Top-level `pool.query(...)` is called by the completeness guard before
    // the transaction opens. Routes the same way as the client so tests share
    // a single source-of-truth for what "active rows exist for source X" means.
    if (
      sql.includes("select count(*)") &&
      sql.includes("from resource_providers")
    ) {
      const source = String(params[0]);
      const count = Array.from(this.activeRows.values()).filter(
        (row) => row.source === source && row.status === "active",
      ).length;
      return { rows: [{ count }] };
    }

    return this.client.query(sql, params);
  }

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

    const firstProviderId = pool.activeRows.get("cfc_active:cfc_active:stable-provider")?.provider_id;

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

    const secondProviderId = pool.activeRows.get("cfc_active:cfc_active:stable-provider")?.provider_id;

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

    expect(pool.datasetVersions.has("cfc_active:shared-version")).toBe(true);
    expect(pool.datasetVersions.has("island_harvest:shared-version")).toBe(true);
  });

  // A5 P0.2 — completeness guard regression suite. See ImportCompletenessError
  // for the pilot-blocker this locks in: a partial fetch (e.g. upstream timed
  // out mid-page) used to silently mark 90% of rows inactive.
  it("refuses an import batch that shrinks to < 50% of the previous active count", async () => {
    const pool = new FakeImportPool();
    const repository = new ResourceImportRepository(pool as never);

    const records100: NormalizedResourceRecord[] = Array.from({ length: 100 }, (_, index) => ({
      ...baseRecord,
      sourceRef: `cfc_active:stable-${index}`,
    }));

    await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "cfc_active_v1",
      records: records100,
    });

    const activeAfterFirst = Array.from(pool.activeRows.values()).filter(
      (row) => row.status === "active",
    ).length;
    expect(activeAfterFirst).toBe(100);

    const records10: NormalizedResourceRecord[] = Array.from({ length: 10 }, (_, index) => ({
      ...baseRecord,
      sourceRef: `cfc_active:stable-${index}`,
    }));

    await expect(
      repository.importDataset({
        source: "cfc_active",
        sourceLabel: "CFC",
        sourceUrl: "https://example.com/cfc",
        datasetVersion: "cfc_active_v2",
        records: records10,
      }),
    ).rejects.toBeInstanceOf(ImportCompletenessError);

    // DB state unchanged: 100 active rows still visible, none marked
    // inactive by a partial transaction — the guard fires BEFORE the
    // wipe-and-replace path touches the table.
    const activeAfterRefusal = Array.from(pool.activeRows.values()).filter(
      (row) => row.status === "active",
    ).length;
    expect(activeAfterRefusal).toBe(100);
  });

  it("allows the same 10-record batch through when force: true is passed", async () => {
    const pool = new FakeImportPool();
    const repository = new ResourceImportRepository(pool as never);

    const records100: NormalizedResourceRecord[] = Array.from({ length: 100 }, (_, index) => ({
      ...baseRecord,
      sourceRef: `cfc_active:stable-${index}`,
    }));

    await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "cfc_active_v1",
      records: records100,
    });

    const records10: NormalizedResourceRecord[] = Array.from({ length: 10 }, (_, index) => ({
      ...baseRecord,
      sourceRef: `cfc_active:stable-${index}`,
    }));

    const summary = await repository.importDataset(
      {
        source: "cfc_active",
        sourceLabel: "CFC",
        sourceUrl: "https://example.com/cfc",
        datasetVersion: "cfc_active_v2",
        records: records10,
      },
      { force: true },
    );

    expect(summary.recordCount).toBe(10);
    const activeAfter = Array.from(pool.activeRows.values()).filter(
      (row) => row.status === "active",
    ).length;
    expect(activeAfter).toBe(10);
  });

  it("does not trigger the guard on the first import when no prior rows exist", async () => {
    const pool = new FakeImportPool();
    const repository = new ResourceImportRepository(pool as never);

    const summary = await repository.importDataset({
      source: "cfc_active",
      sourceLabel: "CFC",
      sourceUrl: "https://example.com/cfc",
      datasetVersion: "cfc_active_v1",
      records: [baseRecord],
    });

    expect(summary.recordCount).toBe(1);
    expect(Array.from(pool.activeRows.values()).filter((row) => row.status === "active")).toHaveLength(1);
  });
});
