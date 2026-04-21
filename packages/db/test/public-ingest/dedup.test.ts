import { describe, expect, it } from "vitest";

import { dedupe, foldKey } from "../../public-ingest/dedup";
import type { ResourceProviderSeed } from "../../public-ingest/types";

function makeSeed(overrides: Partial<ResourceProviderSeed> = {}): ResourceProviderSeed {
  return {
    source: "foodhelp_nyc",
    sourceRef: "foodhelp_nyc:1",
    name: "Corona Community Action Network Pantry",
    type: "pantry",
    addressText: "39-25 104th Street, Corona, NY 11368",
    city: "Corona",
    state: "NY",
    zip: "11368",
    phone: "(718) 478-8100",
    hoursJson: null,
    languages: ["en", "es"],
    eligibilityNotes: null,
    lat: 40.7489,
    lng: -73.8627,
    geoPrecision: "street",
    contentHash: "x",
    datasetVersion: "foodhelp_nyc_2026-W17",
    sourceLabel: "NYC HRA Food Help NYC",
    sourceUrl: "https://finder.nyc.gov/foodhelp/",
    ...overrides,
  };
}

describe("dedupe", () => {
  it("collapses exact same-name/zip/phone rows", () => {
    const a = makeSeed();
    const b = makeSeed({ sourceRef: "foodhelp_nyc:2" });
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it("keeps rows with distinct zips", () => {
    const a = makeSeed();
    const b = makeSeed({ zip: "10474", sourceRef: "foodhelp_nyc:2" });
    expect(dedupe([a, b])).toHaveLength(2);
  });

  it("folds despite punctuation differences in name", () => {
    const a = makeSeed({ name: "St. Kilian Pantry" });
    const b = makeSeed({ name: "St Kilian Pantry", sourceRef: "foodhelp_nyc:2" });
    // Both fold to the same key (punctuation stripped, case-folded).
    expect(foldKey(a)).toBe(foldKey(b));
    expect(dedupe([a, b])).toHaveLength(1);
  });

  it("prefers curated sources over public sources on conflict", () => {
    const publicRow = makeSeed({
      source: "foodhelp_nyc",
      sourceRef: "foodhelp_nyc:collision",
      eligibilityNotes: "public-feed copy",
    });
    const curatedRow = makeSeed({
      source: "cfc_active",
      sourceRef: "cfc_active:collision",
      eligibilityNotes: "curated copy",
    });
    // Order: public appears first, curated second — curated should still win.
    const result = dedupe([publicRow, curatedRow]);
    const winner = result[0]!;
    expect(winner.source).toBe("cfc_active");
    expect(winner.eligibilityNotes).toBe("curated copy");
  });

  it("leaves curated-first order alone when curated is first", () => {
    const publicRow = makeSeed({
      source: "foodhelp_nyc",
      sourceRef: "foodhelp_nyc:collision",
    });
    const curatedRow = makeSeed({
      source: "cfc_active",
      sourceRef: "cfc_active:collision",
    });
    const result = dedupe([curatedRow, publicRow]);
    const winner = result[0]!;
    expect(winner.source).toBe("cfc_active");
  });
});
