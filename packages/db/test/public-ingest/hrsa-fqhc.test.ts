import { describe, expect, it } from "vitest";

import { hrsaFqhc, type HrsaFqhcFeature } from "../../public-ingest/sources/hrsa-fqhc";
import { assertNoPersonPii } from "../../public-ingest/pii";

const SAMPLE_FEATURES: HrsaFqhcFeature[] = [
  {
    attributes: {
      OBJECTID: 8001,
      Site_ID: "NY-TEST-1",
      Site_Name: "Urban Health Plan Inc - Bella Vista Health Center",
      Site_Address: "890 Garrison Avenue",
      Site_City: "Bronx",
      Site_State_Abbreviation: "NY",
      State_Name: "New York",
      Site_Postal_Code: "10474",
      Site_Telephone_Number: "(718) 589-2440",
      Latitude: 40.8144,
      Longitude: -73.8920,
    },
    geometry: { x: -73.8920, y: 40.8144 },
  },
  {
    attributes: {
      OBJECTID: 8002,
      Site_ID: "NY-TEST-2",
      Site_Name: "Charles B. Wang Community Health Center - Flushing",
      Site_Address: "136-26 37th Avenue",
      Site_City: "Flushing",
      Site_State_Abbreviation: "NY",
      State_Name: "New York",
      Site_Postal_Code: "11354",
      Site_Telephone_Number: "(212) 379-6988",
      Latitude: 40.7590,
      Longitude: -73.8306,
    },
    geometry: { x: -73.8306, y: 40.7590 },
  },
  {
    attributes: {
      OBJECTID: 8003,
      Site_ID: "NY-TEST-3",
      Site_Name: "William F. Ryan Community Health Center",
      Site_Address: "110 West 97th Street",
      Site_City: "New York",
      Site_State_Abbreviation: "NY",
      State_Name: "New York",
      Site_Postal_Code: "10025",
      Site_Telephone_Number: "(212) 749-1820",
      Latitude: 40.7944,
      Longitude: -73.9678,
    },
    geometry: { x: -73.9678, y: 40.7944 },
  },
];

describe("hrsa-fqhc source", () => {
  it("normalizes ArcGIS features into ResourceProviderSeed shape", () => {
    const rows = hrsaFqhc.normalize(SAMPLE_FEATURES);
    expect(rows).toHaveLength(3);
    const first = rows[0]!;
    expect(first.source).toBe("hrsa_fqhc");
    expect(first.type).toBe("fqhc");
    expect(first.zip).toBe("10474");
    expect(first.sourceLabel).toBe("HRSA Health Center Service Delivery Sites");
    expect(first.state).toBe("NY");
    expect(first.eligibilityNotes).toContain("Federally Qualified Health Center");
  });

  it("produces a stable contentHash for the same input", () => {
    const a = hrsaFqhc.normalize(SAMPLE_FEATURES).map((row) => row.contentHash);
    const b = hrsaFqhc.normalize(SAMPLE_FEATURES).map((row) => row.contentHash);
    expect(a).toEqual(b);
    expect(a.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it("passes assertNoPersonPii for all rows", () => {
    const rows = hrsaFqhc.normalize(SAMPLE_FEATURES);
    for (const row of rows) {
      expect(() => assertNoPersonPii(row)).not.toThrow();
    }
  });

  it("advertises attribution", () => {
    const attribution = hrsaFqhc.attribution();
    expect(attribution.sourceLabel).toBe("HRSA Health Center Service Delivery Sites");
    expect(attribution.datasetVersion).toMatch(/^hrsa_fqhc_\d{4}-W\d{2}$/);
  });

  it("reads fixture when fromCache=true", async () => {
    const raw = await hrsaFqhc.fetch({ fromCache: true });
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(10);
  });
});
