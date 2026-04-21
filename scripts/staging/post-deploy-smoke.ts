/**
 * Post-deploy smoke verification for the `weavenyc-api-gateway` runtime.
 *
 * Purpose: guard against silent no-op deploys. On 2026-04-20 we discovered
 * the App Runner service had been silently redeploying a 4-day-old
 * `:v0.1.5` image on every workflow run, because the deploy step only
 * called `aws apprunner start-deployment` without updating the service's
 * configured ImageIdentifier. `/healthz` kept returning 200 while stale
 * code served real traffic.
 *
 * This script is the last step in `.github/workflows/deploy-api.yml` and
 * asserts that the container actually restarted + actually runs the
 * build we think we shipped. If either assertion fails, the workflow
 * fails and surfaces the stale-deploy condition loudly.
 *
 * Asserts:
 *   1. GET /metrics.json -> uptime_seconds < MAX_UPTIME_SECONDS (default
 *      300). A fresh rollout restarts the App Runner task; uptime jumps
 *      back near zero. If uptime stays hours-old, the deploy was a no-op.
 *   2. GET /metrics (Prometheus text) exposes the P2P counter names
 *      introduced in PR #39: `p2p_sync_events_total`,
 *      `p2p_sync_errors_total`, `p2p_active_connections`. Their presence
 *      proves the currently-running build is at least as new as #39 —
 *      i.e. the image rolled.
 *
 * Environment:
 *   WEAVENYC_API_BASE_URL    Base URL for the gateway. Defaults to
 *                            https://api.weavenyc.org.
 *   WEAVENYC_MAX_UPTIME_S    Optional override for the uptime assertion
 *                            ceiling (seconds). Defaults to 300.
 *
 * Exit codes:
 *   0  all assertions passed
 *   1  any assertion failed, or a network/parse error made verification
 *      impossible
 */
import process from "node:process";

type MetricsJson = {
  service?: string;
  version?: string;
  uptime_seconds?: number;
  node_env?: string;
  timestamp?: string;
};

type AssertionResult = {
  name: string;
  ok: boolean;
  detail: string;
};

const DEFAULT_BASE_URL = "https://api.weavenyc.org";
const DEFAULT_MAX_UPTIME_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const REQUIRED_P2P_METRIC_NAMES = [
  "p2p_sync_events_total",
  "p2p_sync_errors_total",
  "p2p_active_connections",
] as const;

function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? DEFAULT_BASE_URL).trim();
  if (value.length === 0) {
    return DEFAULT_BASE_URL;
  }
  return value.replace(/\/$/, "");
}

function parseMaxUptime(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_MAX_UPTIME_SECONDS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPTIME_SECONDS;
  }
  return parsed;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function assertUptimeUnder(
  baseUrl: string,
  maxSeconds: number,
): Promise<AssertionResult> {
  const url = `${baseUrl}/metrics.json`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return {
        name: "uptime_seconds < ceiling",
        ok: false,
        detail: `GET ${url} -> HTTP ${response.status}`,
      };
    }
    const body = (await response.json()) as MetricsJson;
    const uptime = body.uptime_seconds;
    if (typeof uptime !== "number" || !Number.isFinite(uptime)) {
      return {
        name: "uptime_seconds < ceiling",
        ok: false,
        detail: `missing or non-numeric uptime_seconds in response: ${JSON.stringify(body).slice(0, 300)}`,
      };
    }
    if (uptime >= maxSeconds) {
      return {
        name: "uptime_seconds < ceiling",
        ok: false,
        detail: `uptime_seconds=${uptime} >= ${maxSeconds}s — container did NOT restart recently, deploy was likely a silent no-op`,
      };
    }
    return {
      name: "uptime_seconds < ceiling",
      ok: true,
      detail: `uptime_seconds=${uptime} < ${maxSeconds}s (container rolled)`,
    };
  } catch (error) {
    return {
      name: "uptime_seconds < ceiling",
      ok: false,
      detail: `GET ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function assertP2pMetricsPresent(baseUrl: string): Promise<AssertionResult> {
  const url = `${baseUrl}/metrics`;
  try {
    const response = await fetchWithTimeout(url, { headers: { accept: "text/plain" } });
    if (!response.ok) {
      return {
        name: "p2p_* metrics present",
        ok: false,
        detail: `GET ${url} -> HTTP ${response.status}`,
      };
    }
    const text = await response.text();
    const missing = REQUIRED_P2P_METRIC_NAMES.filter((name) => !text.includes(name));
    if (missing.length > 0) {
      return {
        name: "p2p_* metrics present",
        ok: false,
        detail: `missing counters in /metrics body: ${missing.join(", ")} — running image is older than PR #39`,
      };
    }
    return {
      name: "p2p_* metrics present",
      ok: true,
      detail: `found ${REQUIRED_P2P_METRIC_NAMES.join(", ")}`,
    };
  } catch (error) {
    return {
      name: "p2p_* metrics present",
      ok: false,
      detail: `GET ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function main(): Promise<void> {
  const baseUrl = normalizeBaseUrl(process.env.WEAVENYC_API_BASE_URL);
  const maxUptimeSeconds = parseMaxUptime(process.env.WEAVENYC_MAX_UPTIME_S);

  console.log(`[post-deploy-smoke] target: ${baseUrl}`);
  console.log(`[post-deploy-smoke] uptime ceiling: ${maxUptimeSeconds}s`);

  const results: AssertionResult[] = [
    await assertUptimeUnder(baseUrl, maxUptimeSeconds),
    await assertP2pMetricsPresent(baseUrl),
  ];

  for (const result of results) {
    const marker = result.ok ? "OK" : "FAIL";
    console.log(`[post-deploy-smoke] ${marker}: ${result.name} — ${result.detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `[post-deploy-smoke] ${failed.length} assertion(s) failed — deploy is NOT verified. ` +
        `This often means the App Runner service is still pointing at a stale ImageIdentifier.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[post-deploy-smoke] all assertions passed — the new api-gateway build is live at ${baseUrl}.`,
  );
}

void main().catch((error) => {
  console.error(`[post-deploy-smoke] unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
