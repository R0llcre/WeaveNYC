import { describe, expect, it } from "vitest";

import { usdaSnap, type UsdaSnapFeature } from "../../public-ingest/sources/usda-snap";
import { assertNoPersonPii } from "../../public-ingest/pii";

const SAMPLE_FEATURES: UsdaSnapFeature[] = [
  {
    attributes: {
      OBJECTID: 9001,
      Store_Name: "C-Town Supermarket",
      Address: "4010 103rd Street",
      City: "Corona",
      State: "NY",
      Zip5: "11368",
      Latitude: 40.7499,
      Longitude: -73.8639,
    },
    geometry: { x: -73.8639, y: 40.7499 },
  },
  {
    attributes: {
      OBJECTID: 9002,
      Store_Name: "Key Food Corona",
      Address: "104-18 Roosevelt Avenue",
      City: "Corona",
      State: "NY",
      Zip5: "11368",
      Latitude: 40.7471,
      Longitude: -73.8611,
    },
    geometry: { x: -73.8611, y: 40.7471 },
  },
  {
    attributes: {
      OBJECTID: 9003,
      Store_Name: "Bravo Supermarket",
      Address: "838 Hunts Point Avenue",
      City: "Bronx",
      State: "NY",
      Zip5: "10474",
      Latitude: 40.8126,
      Longitude: -73.8861,
    },
    geometry: { x: -73.8861, y: 40.8126 },
  },
];

describe("usda-snap source", () => {
  it("normalizes ArcGIS features into ResourceProviderSeed shape", () => {
    const rows = usdaSnap.normalize(SAMPLE_FEATURES);
    expect(rows).toHaveLength(3);
    const first = rows[0]!;
    expect(first.source).toBe("usda_snap");
    expect(first.type).toBe("snap_retailer");
    expect(first.zip).toBe("11368");
    expect(first.sourceLabel).toBe("USDA FNS SNAP Retailer Locator");
    expect(first.lat).toBe(40.7499);
    expect(first.lng).toBe(-73.8639);
    expect(first.geoPrecision).toBe("street");
  });

  it("produces a stable contentHash for the same input", () => {
    const a = usdaSnap.normalize(SAMPLE_FEATURES).map((row) => row.contentHash);
    const b = usdaSnap.normalize(SAMPLE_FEATURES).map((row) => row.contentHash);
    expect(a).toEqual(b);
    expect(a.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it("passes assertNoPersonPii for all rows", () => {
    const rows = usdaSnap.normalize(SAMPLE_FEATURES);
    for (const row of rows) {
      expect(() => assertNoPersonPii(row)).not.toThrow();
    }
  });

  it("advertises attribution", () => {
    const attribution = usdaSnap.attribution();
    expect(attribution.sourceLabel).toBe("USDA FNS SNAP Retailer Locator");
    expect(attribution.datasetVersion).toMatch(/^usda_snap_\d{4}-W\d{2}$/);
  });

  it("reads fixture when fromCache=true", async () => {
    const raw = await usdaSnap.fetch({ fromCache: true });
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(10);
  });
});
