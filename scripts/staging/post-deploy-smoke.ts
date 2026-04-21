/**
 * Post-deploy smoke verification — guards against silent no-op deploys across
 * every M8 pilot runtime (api-gateway, notifications, resource-directory,
 * anchor-admin, pwa).
 *
 * Background: on 2026-04-20 we discovered the App Runner service had been
 * silently redeploying a 4-day-old `:v0.1.5` image on every workflow run,
 * because the deploy step only called `aws apprunner start-deployment`
 * without updating the service's configured ImageIdentifier. `/healthz`
 * kept returning 200 while stale code served real traffic. A8 P0-6
 * extends the same "assert a FRESH container" gate to the other four
 * deploy workflows (`deploy-notify`, `deploy-resources`, `deploy-admin`,
 * `deploy-pwa`).
 *
 * This script is invoked as the last step of each deploy workflow and
 * asserts one of two freshness modes (selected via `MODE`):
 *
 *   uptime   — backend services (api-gateway, notifications,
 *              resource-directory). Asserts `GET /metrics.json ->
 *              uptime_seconds < MAX_UPTIME_SECONDS`. A fresh rollout
 *              restarts the container; uptime jumps back near zero.
 *
 *   cf-pages — Cloudflare Pages projects (anchor-admin, pwa). Asserts
 *              the Cloudflare `deployments` API returns a deployment
 *              whose `created_on` is within `MAX_AGE_SECONDS` AND whose
 *              `deployment_trigger.metadata.commit_hash` starts with the
 *              expected GITHUB_SHA prefix. We don't rely on CF's
 *              "production" badge alone because CF marks a deployment
 *              active before the edge caches propagate — instead we
 *              verify the commit hash the deployed JS bundle embeds.
 *
 * The original uptime-mode additionally asserts presence of the P2P
 * metric names introduced in PR #39 (`p2p_sync_events_total`,
 * `p2p_sync_errors_total`, `p2p_active_connections`) — those are
 * api-gateway-only signals. The assertion is scoped via
 * REQUIRE_P2P_METRICS (defaults to true when the target is the
 * api-gateway base URL, false otherwise).
 *
 * Environment:
 *   MODE                       "uptime" | "cf-pages". Required.
 *   TARGET_URL                 Base URL for uptime mode. Defaults to
 *                              https://api.weavenyc.org (api-gateway).
 *   MAX_UPTIME_SECONDS         Ceiling for uptime-mode assertion.
 *                              Defaults to 300s (5min).
 *   REQUIRE_P2P_METRICS        "true"|"false" (uptime mode only).
 *                              Defaults to auto-detect: true iff the
 *                              target host is `api.weavenyc.org`.
 *   CF_ACCOUNT_ID              Cloudflare account id (cf-pages mode).
 *   CF_API_TOKEN               Cloudflare API token with Pages read
 *                              permission (cf-pages mode).
 *   CF_PROJECT_NAME            Cloudflare Pages project name
 *                              (e.g. `weavenyc-pwa`, `weavenyc-anchor-admin`).
 *   EXPECTED_COMMIT_SHA        Expected git SHA (cf-pages mode). The
 *                              workflow passes `${{ github.sha }}`.
 *                              Matched case-insensitively as a prefix.
 *   MAX_AGE_SECONDS            Maximum age of the latest production
 *                              CF Pages deployment. Defaults to 300s.
 *
 * Exit codes:
 *   0  all assertions passed
 *   1  any assertion failed, or a network/parse/config error made
 *      verification impossible
 *
 * Back-compat env vars (still honored):
 *   WEAVENYC_API_BASE_URL      alias for TARGET_URL when MODE=uptime
 *   WEAVENYC_MAX_UPTIME_S      alias for MAX_UPTIME_SECONDS
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

type CfDeployment = {
  id?: string;
  environment?: string;
  created_on?: string;
  deployment_trigger?: {
    metadata?: {
      commit_hash?: string;
      commit_message?: string;
      branch?: string;
    };
  };
};

const DEFAULT_UPTIME_TARGET = "https://api.weavenyc.org";
const DEFAULT_MAX_UPTIME_SECONDS = 300;
const DEFAULT_MAX_AGE_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 15_000;
const REQUIRED_P2P_METRIC_NAMES = [
  "p2p_sync_events_total",
  "p2p_sync_errors_total",
  "p2p_active_connections",
] as const;

function normalizeBaseUrl(raw: string | undefined, fallback: string): string {
  const value = (raw ?? fallback).trim();
  if (value.length === 0) {
    return fallback;
  }
  return value.replace(/\/$/, "");
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return fallback;
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

async function fetchLatestProductionDeployment(
  accountId: string,
  projectName: string,
  apiToken: string,
): Promise<CfDeployment | null> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/pages/projects/${encodeURIComponent(projectName)}/deployments?env=production`;
  const response = await fetchWithTimeout(url, {
    headers: {
      authorization: `Bearer ${apiToken}`,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${url} -> HTTP ${response.status}`);
  }
  const parsed = (await response.json()) as { success?: boolean; result?: CfDeployment[]; errors?: unknown };
  if (parsed.success === false || !Array.isArray(parsed.result)) {
    throw new Error(`CF Pages deployments API reported failure: ${JSON.stringify(parsed.errors ?? parsed).slice(0, 300)}`);
  }
  const productionOnly = parsed.result.filter((entry) => entry.environment === "production");
  const source = productionOnly.length > 0 ? productionOnly : parsed.result;
  if (source.length === 0) {
    return null;
  }
  const sorted = [...source].sort((a, b) => {
    const at = a.created_on ? Date.parse(a.created_on) : 0;
    const bt = b.created_on ? Date.parse(b.created_on) : 0;
    return bt - at;
  });
  return sorted[0] ?? null;
}

async function assertCfPagesFreshness(params: {
  accountId: string;
  projectName: string;
  apiToken: string;
  expectedCommitSha: string;
  maxAgeSeconds: number;
}): Promise<AssertionResult[]> {
  try {
    const latest = await fetchLatestProductionDeployment(
      params.accountId,
      params.projectName,
      params.apiToken,
    );
    if (latest === null) {
      return [
        {
          name: "cf-pages latest deployment present",
          ok: false,
          detail: `no deployments returned for project ${params.projectName} in account ${params.accountId}`,
        },
      ];
    }

    const results: AssertionResult[] = [];

    const createdOn = latest.created_on;
    if (!createdOn) {
      results.push({
        name: "cf-pages created_on present",
        ok: false,
        detail: `deployment ${latest.id ?? "<unknown>"} has no created_on timestamp: ${JSON.stringify(latest).slice(0, 300)}`,
      });
    } else {
      const ageSeconds = (Date.now() - Date.parse(createdOn)) / 1000;
      if (!Number.isFinite(ageSeconds)) {
        results.push({
          name: "cf-pages deployment age < ceiling",
          ok: false,
          detail: `could not parse created_on=${createdOn}`,
        });
      } else if (ageSeconds < 0) {
        results.push({
          name: "cf-pages deployment age < ceiling",
          ok: false,
          detail: `deployment created_on=${createdOn} is in the future (clock skew?)`,
        });
      } else if (ageSeconds > params.maxAgeSeconds) {
        results.push({
          name: "cf-pages deployment age < ceiling",
          ok: false,
          detail: `latest production deployment is ${Math.round(ageSeconds)}s old (> ${params.maxAgeSeconds}s) — CF did NOT publish a new build, deploy was likely a silent no-op`,
        });
      } else {
        results.push({
          name: "cf-pages deployment age < ceiling",
          ok: true,
          detail: `age=${Math.round(ageSeconds)}s < ${params.maxAgeSeconds}s (fresh publish)`,
        });
      }
    }

    const actualSha = latest.deployment_trigger?.metadata?.commit_hash ?? "";
    const expectedPrefix = params.expectedCommitSha.toLowerCase().slice(0, 7);
    if (expectedPrefix.length === 0) {
      results.push({
        name: "cf-pages commit_hash matches",
        ok: false,
        detail: "EXPECTED_COMMIT_SHA is empty — workflow must pass github.sha",
      });
    } else if (!actualSha.toLowerCase().startsWith(expectedPrefix)) {
      results.push({
        name: "cf-pages commit_hash matches",
        ok: false,
        detail: `deployed commit_hash=${actualSha || "<missing>"} does not start with ${expectedPrefix} — deploy was likely a silent no-op`,
      });
    } else {
      results.push({
        name: "cf-pages commit_hash matches",
        ok: true,
        detail: `commit_hash=${actualSha} starts with ${expectedPrefix}`,
      });
    }

    return results;
  } catch (error) {
    return [
      {
        name: "cf-pages api reachable",
        ok: false,
        detail: `CF Pages verification failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }
}

async function runUptimeMode(): Promise<AssertionResult[]> {
  const baseUrl = normalizeBaseUrl(
    process.env.TARGET_URL ?? process.env.WEAVENYC_API_BASE_URL,
    DEFAULT_UPTIME_TARGET,
  );
  const maxUptime = parsePositiveInt(
    process.env.MAX_UPTIME_SECONDS ?? process.env.WEAVENYC_MAX_UPTIME_S,
    DEFAULT_MAX_UPTIME_SECONDS,
  );
  const autoDetectP2p = baseUrl.includes("api.weavenyc.org");
  const requireP2p = parseBoolean(process.env.REQUIRE_P2P_METRICS, autoDetectP2p);

  console.log(`[post-deploy-smoke] mode: uptime`);
  console.log(`[post-deploy-smoke] target: ${baseUrl}`);
  console.log(`[post-deploy-smoke] uptime ceiling: ${maxUptime}s`);
  console.log(`[post-deploy-smoke] require p2p_* metrics: ${requireP2p}`);

  const results: AssertionResult[] = [await assertUptimeUnder(baseUrl, maxUptime)];
  if (requireP2p) {
    results.push(await assertP2pMetricsPresent(baseUrl));
  }
  return results;
}

async function runCfPagesMode(): Promise<AssertionResult[]> {
  const accountId = process.env.CF_ACCOUNT_ID?.trim() ?? "";
  const apiToken = process.env.CF_API_TOKEN?.trim() ?? "";
  const projectName = process.env.CF_PROJECT_NAME?.trim() ?? "";
  const expectedCommitSha = process.env.EXPECTED_COMMIT_SHA?.trim() ?? "";
  const maxAgeSeconds = parsePositiveInt(
    process.env.MAX_AGE_SECONDS,
    DEFAULT_MAX_AGE_SECONDS,
  );

  console.log(`[post-deploy-smoke] mode: cf-pages`);
  console.log(`[post-deploy-smoke] project: ${projectName || "<missing>"}`);
  console.log(`[post-deploy-smoke] expected commit prefix: ${expectedCommitSha.slice(0, 7) || "<missing>"}`);
  console.log(`[post-deploy-smoke] max age: ${maxAgeSeconds}s`);

  const missing: string[] = [];
  if (accountId.length === 0) missing.push("CF_ACCOUNT_ID");
  if (apiToken.length === 0) missing.push("CF_API_TOKEN");
  if (projectName.length === 0) missing.push("CF_PROJECT_NAME");
  if (expectedCommitSha.length === 0) missing.push("EXPECTED_COMMIT_SHA");
  if (missing.length > 0) {
    return [
      {
        name: "cf-pages config complete",
        ok: false,
        detail: `missing required env: ${missing.join(", ")}`,
      },
    ];
  }

  return assertCfPagesFreshness({
    accountId,
    projectName,
    apiToken,
    expectedCommitSha,
    maxAgeSeconds,
  });
}

async function main(): Promise<void> {
  const mode = (process.env.MODE ?? "uptime").trim().toLowerCase();

  let results: AssertionResult[];
  if (mode === "uptime") {
    results = await runUptimeMode();
  } else if (mode === "cf-pages") {
    results = await runCfPagesMode();
  } else {
    console.error(`[post-deploy-smoke] unknown MODE=${mode}. Expected "uptime" or "cf-pages".`);
    process.exitCode = 1;
    return;
  }

  for (const result of results) {
    const marker = result.ok ? "OK" : "FAIL";
    console.log(`[post-deploy-smoke] ${marker}: ${result.name} — ${result.detail}`);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(
      `[post-deploy-smoke] ${failed.length} assertion(s) failed — deploy is NOT verified. ` +
        `Likely causes: stale ImageIdentifier (App Runner / Container Apps / Cloud Run), ` +
        `or CF Pages published an older commit than the workflow run.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[post-deploy-smoke] all assertions passed (mode=${mode}).`);
}

void main().catch((error) => {
  console.error(`[post-deploy-smoke] unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
