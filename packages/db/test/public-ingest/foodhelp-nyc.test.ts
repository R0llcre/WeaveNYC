import { describe, expect, it } from "vitest";

import { foodhelpNyc, type FoodhelpNycRaw } from "../../public-ingest/sources/foodhelp-nyc";
import { assertNoPersonPii } from "../../public-ingest/pii";

const SAMPLE_ROWS: FoodhelpNycRaw[] = [
  {
    id: "test-1",
    name: "Corona Community Action Network Pantry",
    service_type: "Food Pantry",
    address: "39-25 104th Street",
    city: "Corona",
    zip_code: "11368",
    phone: "(718) 478-8100",
    hours: "Mon-Fri 9am-1pm",
    eligibility: "Open to Queens residents.",
    languages_spoken: "English, Spanish",
    latitude: "40.7489",
    longitude: "-73.8627",
  },
  {
    id: "test-2",
    name: "Masbia of Queens Soup Kitchen",
    service_type: "Soup Kitchen",
    address: "105-47 64th Road",
    city: "Forest Hills",
    zip_code: "11375",
    phone: "(718) 972-4446",
    hours: "Tue/Thu 4-7pm",
    eligibility: "Open to all.",
    languages_spoken: "English",
    latitude: "40.7238",
    longitude: "-73.8445",
  },
  {
    id: "test-3",
    name: "Project Hospitality Mobile Pantry",
    service_type: "Mobile Pantry",
    address: "100 Park Avenue",
    city: "Staten Island",
    zip_code: "10302",
    phone: "(718) 448-1544",
    hours: "Wed 10am-2pm",
    eligibility: "SI residents.",
    languages_spoken: "English, Spanish",
    latitude: "40.6368",
    longitude: "-74.1354",
  },
];

describe("foodhelp-nyc source", () => {
  it("normalizes upstream rows into ResourceProviderSeed shape", () => {
    const rows = foodhelpNyc.normalize(SAMPLE_ROWS);
    expect(rows).toHaveLength(3);
    const first = rows[0]!;
    const second = rows[1]!;
    const third = rows[2]!;
    expect(first.source).toBe("foodhelp_nyc");
    expect(first.sourceRef).toBe("foodhelp_nyc:test-1");
    expect(first.type).toBe("pantry");
    expect(first.zip).toBe("11368");
    expect(first.sourceLabel).toBe("NYC HRA Food Help NYC");
    expect(first.sourceUrl).toBe("https://finder.nyc.gov/foodhelp/");
    expect(first.geoPrecision).toBe("street");
    expect(first.languages).toEqual(["en", "es"]);
    expect(second.type).toBe("soup_kitchen");
    expect(third.type).toBe("mobile_pantry");
  });

  it("produces a stable contentHash for the same input", () => {
    const a = foodhelpNyc.normalize(SAMPLE_ROWS).map((row) => row.contentHash);
    const b = foodhelpNyc.normalize(SAMPLE_ROWS).map((row) => row.contentHash);
    expect(a).toEqual(b);
    for (const hash of a) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("passes assertNoPersonPii for all rows", () => {
    const rows = foodhelpNyc.normalize(SAMPLE_ROWS);
    for (const row of rows) {
      expect(() => assertNoPersonPii(row)).not.toThrow();
    }
  });

  it("advertises attribution with sourceLabel + sourceUrl + datasetVersion", () => {
    const attribution = foodhelpNyc.attribution();
    expect(attribution.sourceLabel).toBe("NYC HRA Food Help NYC");
    expect(attribution.sourceUrl).toBe("https://finder.nyc.gov/foodhelp/");
    expect(attribution.datasetVersion).toMatch(/^foodhelp_nyc_\d{4}-W\d{2}$/);
  });

  it("reads checked-in fixture when fromCache=true (no network)", async () => {
    const raw = await foodhelpNyc.fetch({ fromCache: true });
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(10);
  });
});
