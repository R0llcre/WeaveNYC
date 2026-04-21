import { describe, expect, it } from "vitest";

import { assertNoPersonPii } from "../../public-ingest/pii";
import type { ResourceProviderSeed } from "../../public-ingest/types";

function makeSeed(overrides: Partial<ResourceProviderSeed> = {}): ResourceProviderSeed {
  return {
    source: "foodhelp_nyc",
    sourceRef: "foodhelp_nyc:test",
    name: "St. Kilian Parish Pantry",
    type: "pantry",
    addressText: "140 Elizabeth Street, Farmingdale, NY 11735",
    city: "Farmingdale",
    state: "NY",
    zip: "11735",
    phone: "(516) 756-9656",
    hoursJson: null,
    languages: ["en"],
    eligibilityNotes: "Open Mon-Fri.",
    lat: null,
    lng: null,
    geoPrecision: "zip_centroid",
    contentHash: "x",
    datasetVersion: "foodhelp_nyc_2026-W17",
    sourceLabel: "NYC HRA Food Help NYC",
    sourceUrl: "https://finder.nyc.gov/foodhelp/",
    ...overrides,
  };
}

describe("assertNoPersonPii", () => {
  it("allows organization names with honorifics (St., Saint, Our Lady)", () => {
    expect(() => assertNoPersonPii(makeSeed({ name: "St. Kilian Parish Pantry" }))).not.toThrow();
    expect(() => assertNoPersonPii(makeSeed({ name: "Our Lady of Sorrows Community Kitchen" }))).not.toThrow();
    expect(() => assertNoPersonPii(makeSeed({ name: "Saint Nick's Community Pantry" }))).not.toThrow();
  });

  it("flags 'Contact: John Doe' in eligibility notes", () => {
    expect(() =>
      assertNoPersonPii(
        makeSeed({ eligibilityNotes: "Contact: John Doe before visiting." })
      )
    ).toThrow(/PII check failed/);
  });

  it("flags 'Ask for Maria' phrasing", () => {
    expect(() =>
      assertNoPersonPii(makeSeed({ eligibilityNotes: "Ask for Maria at the front desk." }))
    ).toThrow(/PII check failed/);
  });

  it("flags personal gmail addresses", () => {
    expect(() =>
      assertNoPersonPii(makeSeed({ eligibilityNotes: "Email mariasmith@gmail.com to arrange pickup." }))
    ).toThrow(/PII check failed/);
  });

  it("allows rows with no sensitive content", () => {
    expect(() => assertNoPersonPii(makeSeed())).not.toThrow();
  });
});
