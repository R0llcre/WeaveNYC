/**
 * Demo preflight (B5/B6).
 *
 * Runs in <90 seconds. Verifies the production demo stack is ready for
 * the 30-minute class session. Emits a single-line status summary on
 * success or a one-line failure reason, and writes a JSON file at
 * `packages/db/seed/generated/demo-fresh-timestamps.json` so relative
 * timestamps ("3 days ago") stay fresh.
 *
 *  Steps
 *  -----
 *    1. Parallel ping of 4 production origins (pwa, gateway, resource-dir,
 *       notify). Each must respond 200 within 2 000 ms.
 *    2. Seed-freshness check: fetch `/v1/resources?zip=11368&limit=1` from
 *       the gateway; a 200 with at least one item means the Queens seed
 *       is loaded.
 *    3. Regenerate `demo-fresh-timestamps.json` using `Date.now()` -
 *       offset so relative timestamps don't look stale.
 *
 *  Output
 *  ------
 *    Default quiet mode:
 *      GREEN 45s
 *      RED: step 1 (https://api.weavenyc.org/readyz → 503 in 812ms)
 *    `--verbose` streams each step's status:
 *      [step 1] PING https://weavenyc.org ... 200 in 118ms
 *      [step 1] PING https://api.weavenyc.org/readyz ... 200 in 212ms
 *      [step 2] RESOURCES (zip=11368) ... 200 (1 item)
 *      [step 3] TIMESTAMPS ... wrote packages/db/seed/generated/demo-fresh-timestamps.json
 *
 * Exit code: 0 GREEN, 1 RED.
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const VERBOSE = process.argv.includes("--verbose");

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

const PING_TARGETS = [
  "https://weavenyc.org",
  "https://api.weavenyc.org/readyz",
  "https://resource-dir.weavenyc.org/readyz",
  "https://notify.weavenyc.org/healthz"
] as const;

const RESOURCES_URL = "https://api.weavenyc.org/v1/resources?zip=11368&limit=1";

const PING_TIMEOUT_MS = 2_000;
const RESOURCES_TIMEOUT_MS = 4_000;

type Verdict =
  | { ok: true }
  | { ok: false; reason: string };

function log(msg: string): void {
  if (VERBOSE) {
    console.log(msg);
  }
}

async function timedFetch(url: string, timeoutMs: number): Promise<{
  status: number;
  latencyMs: number;
  body?: unknown;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const latencyMs = Date.now() - t0;
    let body: unknown;
    // We only try to parse JSON for the resources-directory probe so the
    // four health checks stay cheap (no payload parse on 200).
    if (url === RESOURCES_URL) {
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
    }
    return { status: res.status, latencyMs, body };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Step 1 — parallel health pings.
 */
async function step1Pings(): Promise<Verdict> {
  const results = await Promise.all(
    PING_TARGETS.map(async (url) => {
      try {
        const res = await timedFetch(url, PING_TIMEOUT_MS);
        log(`[step 1] PING ${url} ... ${res.status} in ${res.latencyMs}ms`);
        if (res.status !== 200) {
          return { url, ok: false, reason: `${res.status} in ${res.latencyMs}ms` };
        }
        if (res.latencyMs > PING_TIMEOUT_MS) {
          return { url, ok: false, reason: `${res.latencyMs}ms > ${PING_TIMEOUT_MS}ms` };
        }
        return { url, ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log(`[step 1] PING ${url} ... FAIL ${msg}`);
        return { url, ok: false, reason: msg };
      }
    })
  );

  const firstFail = results.find((r) => !r.ok);
  if (firstFail && !firstFail.ok) {
    return {
      ok: false,
      reason: `step 1 (${firstFail.url} → ${firstFail.reason})`
    };
  }
  return { ok: true };
}

/**
 * Step 2 — seed freshness probe.
 */
async function step2Resources(): Promise<Verdict> {
  try {
    const res = await timedFetch(RESOURCES_URL, RESOURCES_TIMEOUT_MS);
    if (res.status !== 200) {
      log(`[step 2] RESOURCES ${RESOURCES_URL} ... ${res.status}`);
      return {
        ok: false,
        reason: `step 2 (resources ${res.status})`
      };
    }
    const items = extractItems(res.body);
    log(`[step 2] RESOURCES (zip=11368) ... 200 (${items} item${items === 1 ? "" : "s"})`);
    if (items < 1) {
      return {
        ok: false,
        reason: "step 4 (resources empty) timeout"
      };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`[step 2] RESOURCES ... FAIL ${msg}`);
    return {
      ok: false,
      reason: `step 2 (${msg})`
    };
  }
}

function extractItems(body: unknown): number {
  if (body && typeof body === "object") {
    const rec = body as Record<string, unknown>;
    if (Array.isArray(rec.items)) {
      return rec.items.length;
    }
    if (Array.isArray(rec.results)) {
      return rec.results.length;
    }
    if (Array.isArray(rec.data)) {
      return rec.data.length;
    }
  }
  if (Array.isArray(body)) {
    return body.length;
  }
  return 0;
}

/**
 * Step 3 — rewrite demo-fresh-timestamps.json so the PWA's relative
 * timestamp formatter never shows a stale "3 days ago" after a long gap
 * between preflight and live demo.
 */
async function step3Timestamps(): Promise<Verdict> {
  const now = Date.now();
  const rel = {
    generatedAt: now,
    // Posts referenced by scene-3 / scene-5 of the demo deck.
    marisolOffer: now - 4 * 60 * 60 * 1_000, // 4h ago
    dwayneRequest: now - 26 * 60 * 60 * 1_000, // ~yesterday
    jorgeRequest: now - 2 * 60 * 60 * 1_000, // 2h ago
    skylerOffer: now - 45 * 60 * 1_000, // 45m ago — fresh enough to be "new"
    // Scene-6 live block: the Skyler ↔ Dwayne conversation last activity
    // should read "a few minutes ago" when the instructor demos the block.
    skylerDwayneLastActivity: now - 6 * 60 * 1_000
  };
  const outPath = path.join(
    REPO_ROOT,
    "packages",
    "db",
    "seed",
    "generated",
    "demo-fresh-timestamps.json"
  );
  try {
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, JSON.stringify(rel, null, 2) + "\n", "utf8");
    log(`[step 3] TIMESTAMPS ... wrote ${path.relative(REPO_ROOT, outPath)}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `step 3 (timestamp write failed: ${msg})`
    };
  }
}

async function main(): Promise<void> {
  const t0 = Date.now();

  const s1 = await step1Pings();
  if (!s1.ok) {
    console.log(`RED: ${s1.reason}`);
    process.exit(1);
  }
  const s2 = await step2Resources();
  if (!s2.ok) {
    console.log(`RED: ${s2.reason}`);
    process.exit(1);
  }
  const s3 = await step3Timestamps();
  if (!s3.ok) {
    console.log(`RED: ${s3.reason}`);
    process.exit(1);
  }
  const elapsedSec = Math.round((Date.now() - t0) / 1_000);
  console.log(`GREEN ${elapsedSec}s`);
  process.exit(0);
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`RED: unexpected (${msg})`);
  process.exit(1);
});
