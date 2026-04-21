import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { communitySyncEventSchema } from "../src/validators/p2p";
import { p2pEventTypes } from "../src/enums";

// P8.9 (P1) wire-format compat. The fixture is an explicit, frozen snapshot
// of the M6-v1 event envelopes the server emitted as of merge-PR #39 / #40.
// Any schema change that breaks these fixtures forces an explicit update to
// the fixture file (and therefore a conscious decision about the wire
// contract), rather than silently shipping a drift. Per the 8-agent audit
// (P8 finding 9), this file IS the compat contract.

type FixtureFile = {
  comment: string;
  events: unknown[];
};

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "__fixtures__/m6-v1-events.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf-8")) as FixtureFile;

describe("frozen m6-v1 event envelopes still parse against current schema", () => {
  it("loads the fixture file with an events array", () => {
    expect(Array.isArray(fixture.events)).toBe(true);
    expect(fixture.events.length).toBeGreaterThan(0);
  });

  it("covers every known p2pEventType exactly once", () => {
    const eventTypesInFixture = new Set(
      fixture.events.map((event) => {
        const record = event as { event_type?: string };
        return record.event_type;
      }),
    );
    for (const expected of p2pEventTypes) {
      expect(eventTypesInFixture.has(expected)).toBe(true);
    }
    // Any drift (fixture loses coverage for a type) is a test failure so the
    // author has to rewrite the fixture rather than silently downgrade it.
    expect(eventTypesInFixture.size).toBe(p2pEventTypes.length);
  });

  for (let index = 0; index < 8; index += 1) {
    it(`parses frozen fixture event #${index} through communitySyncEventSchema`, () => {
      const event = fixture.events[index];
      expect(event).toBeDefined();
      const parsed = communitySyncEventSchema.parse(event);
      expect(parsed.event_type).toBeDefined();
      // Round-trip: parse must not drop fields from the wire envelope's
      // discriminated union (subtle schema regressions would fail here).
      expect(parsed.community_id).toBe((event as { community_id: string }).community_id);
      expect(parsed.aggregate_id).toBe((event as { aggregate_id: string }).aggregate_id);
    });
  }

  it("rejects a malformed envelope (sanity check — schema still works)", () => {
    expect(() =>
      communitySyncEventSchema.parse({
        ...fixture.events[0],
        event_type: "post.unknown-subtype",
      }),
    ).toThrow();
  });
});
