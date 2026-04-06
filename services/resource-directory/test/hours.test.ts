import { describe, expect, it } from "vitest";

import { isOpenNow, isOpenToday, parseTimeWindows, toWeeklyHours } from "../src/lib/hours.js";

describe("hours parsing", () => {
  it("parses multiple daily windows and preserves them in weekly output", () => {
    const parsed = parseTimeWindows("09:00AM-12:00PM/02:00PM-05:00PM");

    expect(parsed).toHaveLength(2);
    expect(parsed.map((entry) => ({
      opensAt: entry.opensAt,
      closesAt: entry.closesAt
    }))).toEqual([
      { opensAt: "09:00AM", closesAt: "12:00PM" },
      { opensAt: "02:00PM", closesAt: "05:00PM" }
    ]);

    expect(
      toWeeklyHours({
        mon: "09:00AM-12:00PM/02:00PM-05:00PM"
      })[0]
    ).toEqual({
      day: "mon",
      windows: [
        { opensAt: "09:00AM", closesAt: "12:00PM" },
        { opensAt: "02:00PM", closesAt: "05:00PM" }
      ],
      closed: false
    });
  });

  it("uses any parsed window when computing open-now and open-today", () => {
    const hours = {
      mon: "09:00AM-12:00PM/02:00PM-05:00PM"
    };

    expect(isOpenToday(hours, new Date("2026-04-06T15:00:00Z"))).toBe(true);
    expect(isOpenNow(hours, new Date("2026-04-06T15:00:00Z"))).toBe(true);
    expect(isOpenNow(hours, new Date("2026-04-06T17:00:00Z"))).toBe(false);
    expect(isOpenNow(hours, new Date("2026-04-06T19:30:00Z"))).toBe(true);
  });
});
