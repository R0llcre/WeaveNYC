import { afterEach, describe, expect, it } from "vitest";

import { createResourceDirectoryRuntime } from "../src/runtime.js";

describe("resource directory runtime", () => {
  const runtimes: Array<ReturnType<typeof createResourceDirectoryRuntime>> = [];

  afterEach(async () => {
    while (runtimes.length > 0) {
      await runtimes.pop()!.close();
    }
  });

  it("exposes health, readiness, version, and metrics endpoints", async () => {
    const runtime = createResourceDirectoryRuntime({
      port: 0,
      readinessCheck: async () => [{ name: "postgres", status: "ok" }],
    });
    runtimes.push(runtime);

    await runtime.listen();
    const baseUrl = runtime.baseUrl();

    await expect(fetch(`${baseUrl}/healthz`).then((response) => response.json())).resolves.toMatchObject({
      status: "ok",
      service: "resource-directory-service",
    });

    await expect(fetch(`${baseUrl}/readyz`).then((response) => response.json())).resolves.toMatchObject({
      status: "ok",
      service: "resource-directory-service",
    });

    await expect(fetch(`${baseUrl}/versionz`).then((response) => response.json())).resolves.toMatchObject({
      status: "ok",
      service: "resource-directory-service",
    });

    await expect(fetch(`${baseUrl}/metrics`).then((response) => response.text())).resolves.toContain(
      'weavenyc_runtime_up{service="resource-directory-service"',
    );
  });
});
