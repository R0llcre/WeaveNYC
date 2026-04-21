import { describe, expect, it, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// P8 finding 10 (P1): assert that `/v1/*` requests are NEVER routed through
// the service worker's cache layer. A future regression that narrows the
// predicate and silently permits `/v1/` caching would break offline-sync
// invariants and risk leaking Authorization-tagged responses into the
// Cache Storage API, where they'd survive logout.
//
// The predicate lives as a classic-script module at
// `apps/pwa/public/sw-predicate.js` so that `sw.js` (which can only
// `importScripts(...)`, not ESM-import) and Node's `require()` both pick
// up the exact same implementation.

type SwPredicateModule = {
  isCacheableStaticRequest(request: Request): boolean;
  CORE_ASSETS: string[];
  STATIC_DESTINATIONS: Set<string>;
};

let predicate: SwPredicateModule;

beforeAll(() => {
  const here = dirname(fileURLToPath(import.meta.url));
  const predicatePath = resolve(here, "../../public/sw-predicate.js");
  // The predicate file is a UMD-style classic script — `self` is treated as
  // `globalThis` so attaching `isCacheableStaticRequest` to it doesn't blow up
  // in Node.
  const nodeRequire = createRequire(import.meta.url);
  predicate = nodeRequire(predicatePath) as SwPredicateModule;
});

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("service-worker isCacheableStaticRequest predicate", () => {
  it("allows /_next/static/ JS bundles (cacheable)", () => {
    const request = makeRequest("https://weavenyc.org/_next/static/foo.js");
    expect(predicate.isCacheableStaticRequest(request)).toBe(true);
  });

  it("blocks /v1/communities/:id/sync (must always hit network — auth + freshness)", () => {
    const request = makeRequest(
      "https://weavenyc.org/v1/communities/44444444-4444-4444-8444-444444444444/sync",
    );
    expect(predicate.isCacheableStaticRequest(request)).toBe(false);
  });

  it("blocks /v1/communities/:id/bootstrap (must always hit network — short-lived WS tokens)", () => {
    const request = makeRequest(
      "https://weavenyc.org/v1/communities/44444444-4444-4444-8444-444444444444/bootstrap",
    );
    expect(predicate.isCacheableStaticRequest(request)).toBe(false);
  });

  it("blocks any /v1/ path as a belt-and-suspenders rule", () => {
    const paths = [
      "/v1/auth/anonymous",
      "/v1/posts",
      "/v1/posts/11111111-1111-4111-8111-111111111101",
      "/v1/admin/report_queue",
      "/v1/ws/p2p?token=abc",
    ];
    for (const path of paths) {
      const request = makeRequest(`https://weavenyc.org${path}`);
      expect(predicate.isCacheableStaticRequest(request)).toBe(false);
    }
  });

  it("blocks requests that carry an Authorization header even if they look static", () => {
    const request = makeRequest("https://weavenyc.org/_next/static/foo.js", {
      headers: { authorization: "Bearer leaked-jwt" },
    });
    expect(predicate.isCacheableStaticRequest(request)).toBe(false);
  });

  it("allows core PWA shell assets by exact pathname match", () => {
    for (const asset of ["/", "/manifest.webmanifest", "/icons/app-icon.svg", "/icons/maskable-icon.svg"]) {
      const request = makeRequest(`https://weavenyc.org${asset}`);
      expect(predicate.isCacheableStaticRequest(request)).toBe(true);
    }
  });

  it("allows any /icons/ asset", () => {
    const request = makeRequest("https://weavenyc.org/icons/bookmark.svg");
    expect(predicate.isCacheableStaticRequest(request)).toBe(true);
  });

  it("blocks an unknown top-level request (default-deny for anything non-static)", () => {
    const request = makeRequest("https://weavenyc.org/some-other-api-route");
    expect(predicate.isCacheableStaticRequest(request)).toBe(false);
  });
});
