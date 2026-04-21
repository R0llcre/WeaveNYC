import { describe, expect, it } from "vitest";

import { dftaSeniorMeals, type DftaSeniorMealsRaw } from "../../public-ingest/sources/dfta-senior-meals";
import { assertNoPersonPii } from "../../public-ingest/pii";

const SAMPLE_ROWS: DftaSeniorMealsRaw[] = [
  {
    program_id: "T-1",
    program_name: "Corona Senior Center",
    program_type: "Senior Center",
    address: "104-05 Northern Boulevard",
    city: "Corona",
    zip_code: "11368",
    phone: "(718) 478-2500",
    hours: "Mon-Fri 9am-4pm",
    eligibility: "Age 60+.",
    languages_spoken: "English, Spanish",
    latitude: "40.7534",
    longitude: "-73.8712",
  },
  {
    program_id: "T-2",
    program_name: "Citymeals on Wheels - Manhattan",
    program_type: "Home Delivered Meal",
    address: "355 Lexington Avenue",
    city: "New York",
    zip_code: "10017",
    phone: "(212) 687-1234",
    hours: "Daily 9am-1pm",
    eligibility: "Homebound seniors 60+.",
    languages_spoken: "English, Spanish, Chinese",
    latitude: "40.7513",
    longitude: "-73.9770",
  },
  {
    program_id: "T-3",
    program_name: "Irrelevant Youth Program",
    program_type: "After School",
    address: "1 Main Street",
    city: "New York",
    zip_code: "10001",
    phone: "(212) 555-0000",
    hours: "Mon-Fri",
    eligibility: "Youth",
    languages_spoken: "English",
    latitude: "40.75",
    longitude: "-74.0",
  },
];

describe("dfta-senior-meals source", () => {
  it("normalizes upstream rows into ResourceProviderSeed shape + filters non-senior programs", () => {
    const rows = dftaSeniorMeals.normalize(SAMPLE_ROWS);
    // Third row is "After School" and must be filtered out.
    expect(rows).toHaveLength(2);
    const first = rows[0]!;
    const second = rows[1]!;
    expect(first.source).toBe("nyc_dfta_senior_meals");
    expect(first.type).toBe("senior_meal_site");
    expect(first.zip).toBe("11368");
    expect(first.sourceLabel).toContain("DFTA");
    expect(second.sourceRef).toContain("T-2");
  });

  it("produces a stable contentHash for the same input", () => {
    const a = dftaSeniorMeals.normalize(SAMPLE_ROWS).map((row) => row.contentHash);
    const b = dftaSeniorMeals.normalize(SAMPLE_ROWS).map((row) => row.contentHash);
    expect(a).toEqual(b);
    expect(a.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it("passes assertNoPersonPii for all rows", () => {
    const rows = dftaSeniorMeals.normalize(SAMPLE_ROWS);
    for (const row of rows) {
      expect(() => assertNoPersonPii(row)).not.toThrow();
    }
  });

  it("advertises attribution", () => {
    const attribution = dftaSeniorMeals.attribution();
    expect(attribution.sourceLabel).toContain("DFTA");
    expect(attribution.datasetVersion).toMatch(/^nyc_dfta_senior_meals_\d{4}-W\d{2}$/);
  });

  it("reads fixture when fromCache=true", async () => {
    const raw = await dftaSeniorMeals.fetch({ fromCache: true });
    expect(Array.isArray(raw)).toBe(true);
    expect(raw.length).toBeGreaterThanOrEqual(10);
  });
});
