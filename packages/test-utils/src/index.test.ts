import { describe, expect, it } from "vitest";

import { fixedIsoTimestamp } from "./index";

describe("@weavenyc/test-utils", () => {
  it("returns a deterministic timestamp", () => {
    expect(fixedIsoTimestamp()).toBe("2026-04-04T12:00:00.000Z");
  });
});
