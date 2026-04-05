import { describe, expect, it } from "vitest";

import { getDatabaseUrl } from "../src/env";

describe("@weavenyc/db env", () => {
  it("reads DATABASE_URL from process.env", () => {
    process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo";

    expect(getDatabaseUrl()).toBe("postgres://demo:demo@localhost:5432/demo");
  });
});
