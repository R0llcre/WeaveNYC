import { describe, expect, it } from "vitest";

import { ingestAllPublicSources } from "../../public-ingest";

describe("ingestAllPublicSources (fromCache, offline)", () => {
  it("produces a deduped, non-empty result when reading only from fixtures", async () => {
    const result = await ingestAllPublicSources({ fromCache: true, dryRun: true });
    expect(result.sources.length).toBe(4);
    expect(result.totalRows).toBeGreaterThanOrEqual(40);
    expect(result.uniqueRows).toBeGreaterThan(0);
    expect(result.uniqueRows).toBeLessThanOrEqual(result.totalRows);

    const sourceIds = result.sources.map((s) => s.sourceId);
    expect(sourceIds).toContain("foodhelp_nyc");
    expect(sourceIds).toContain("usda_snap");
    expect(sourceIds).toContain("nyc_dfta_senior_meals");
    expect(sourceIds).toContain("hrsa_fqhc");

    for (const row of result.rows) {
      expect(row.zip).toMatch(/^\d{5}$/);
      expect(row.source.length).toBeGreaterThan(0);
      expect(row.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.state).toBe("NY");
    }
  });

  it("honors include filter", async () => {
    const result = await ingestAllPublicSources({
      fromCache: true,
      dryRun: true,
      include: ["usda_snap"],
    });
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0]!.sourceId).toBe("usda_snap");
    expect(result.rows.every((row) => row.source === "usda_snap")).toBe(true);
  });
});
