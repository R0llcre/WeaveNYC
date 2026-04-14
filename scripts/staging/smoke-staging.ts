import process from "node:process";

import {
  captureChecked,
  fetchJson,
  forbiddenEnvHits,
  isHealthyProbeStatus,
  missingEnvKeys,
  optionalEnv,
  readEnvProfiles,
  readRuntimeContracts,
  requiredEnv,
  writeScratchJson,
  workspaceRoot
} from "./lib.js";

type SmokeReport = {
  generated_at: string;
  profile: string;
  mode: "local" | "remote";
  gatewayUrl: string;
  checks: Array<{
    runtime: string;
    url: string;
    status: number;
    paths: Array<{ path: string; status: number }>;
  }>;
  delegatedSmoke?: {
    realApi: boolean;
    p2p: boolean;
  };
};

function assertHealthyChecks(checks: SmokeReport["checks"]) {
  const failures = checks.flatMap((check) =>
    check.paths
      .filter((path) => !isHealthyProbeStatus(path.status))
      .map((path) => `${check.runtime} ${path.path} -> ${path.status}`),
  );

  if (failures.length > 0) {
    throw new Error(`Staging smoke detected unhealthy probes: ${failures.join(", ")}`);
  }
}

async function main() {
  const profile = process.env.WEAVENYC_DEPLOY_PROFILE?.trim() || "staging";
  const runtimeContracts = readRuntimeContracts();
  const envProfiles = readEnvProfiles();
  const profileSpec = envProfiles.profiles[profile];
  if (!profileSpec) {
    throw new Error(`Unknown smoke profile: ${profile}`);
  }

  const gatewayUrl = requiredEnv("WEAVENYC_STAGING_API_GATEWAY_URL");
  const pwaUrl = requiredEnv("WEAVENYC_STAGING_PWA_URL");
  const anchorAdminUrl = requiredEnv("WEAVENYC_STAGING_ANCHOR_ADMIN_URL");
  const mode: "local" | "remote" = optionalEnv("WEAVENYC_STAGING_SMOKE_MODE") === "remote" ? "remote" : "local";
  const requiredSmokeUrls = runtimeContracts.runtimes.map((runtime) => runtime.smokeUrlEnv);

  const missing = missingEnvKeys(requiredSmokeUrls, process.env);
  const forbidden = forbiddenEnvHits(profileSpec.forbidden?.runtime ?? [], process.env);

  if (missing.length > 0) {
    throw new Error(`Missing required env for staging smoke: ${missing.join(", ")}`);
  }
  if (forbidden.length > 0) {
    throw new Error(`Forbidden env values detected for staging smoke: ${forbidden.join(", ")}`);
  }

  const runtimeUrls = runtimeContracts.runtimes
    .map((runtime) => ({
      runtime,
      url: requiredEnv(runtime.smokeUrlEnv)
    }))
    .filter(({ url }) => Boolean(url));

  const checks: SmokeReport["checks"] = [];
  for (const { runtime, url } of runtimeUrls) {
    const responses: Array<{ path: string; status: number }> = [];
    for (const path of runtime.healthPaths) {
      const { response } = await fetchJson(new URL(path, `${url!.replace(/\/$/, "")}/`).toString());
      responses.push({ path, status: response.status });
    }
    checks.push({
      runtime: runtime.name,
      url: url!,
      status: responses[0]?.status ?? 0,
      paths: responses
    });
  }

  const gatewayTargets = ["/healthz", "/readyz", "/versionz", "/docs"];
  const gatewayChecks: Array<{ path: string; status: number }> = [];
  for (const path of gatewayTargets) {
    const { response } = await fetchJson(new URL(path, `${gatewayUrl.replace(/\/$/, "")}/`).toString());
    gatewayChecks.push({ path, status: response.status });
  }
  checks.unshift({
    runtime: "api-gateway",
    url: gatewayUrl,
    status: gatewayChecks[0]?.status ?? 0,
    paths: gatewayChecks
  });

  const { response: pwaResponse } = await fetchJson(pwaUrl, undefined, 10_000);
  const { response: adminResponse } = await fetchJson(anchorAdminUrl, undefined, 10_000);
  checks.push(
    { runtime: "pwa", url: pwaUrl, status: pwaResponse.status, paths: [{ path: "/", status: pwaResponse.status }] },
    { runtime: "anchor-admin", url: anchorAdminUrl, status: adminResponse.status, paths: [{ path: "/", status: adminResponse.status }] }
  );

  const report: SmokeReport = {
    generated_at: new Date().toISOString(),
    profile,
    mode,
    gatewayUrl,
    checks,
    delegatedSmoke: {
      realApi: optionalEnv("WEAVENYC_STAGING_RUN_REAL_API_SMOKE") !== "0",
      p2p: optionalEnv("WEAVENYC_STAGING_RUN_P2P_SMOKE") === "1"
    }
  };

  const reportPath = writeScratchJson("smoke-report.json", report);

  assertHealthyChecks(report.checks);

  if (report.delegatedSmoke?.realApi) {
    await spawnRealSmoke(gatewayUrl);
  }

  if (report.delegatedSmoke?.p2p) {
    await spawnP2PSmoke(gatewayUrl);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath,
        report
      },
      null,
      2
    )
  );
}

async function spawnRealSmoke(gatewayUrl: string) {
  await captureChecked(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["test:smoke:real"],
    {
      cwd: workspaceRoot,
      env: {
        WEAVENYC_API_BASE_URL: gatewayUrl,
        WEAVENYC_SMOKE_EXTERNAL_STARTUP_GRACE_MS: "0"
      }
    }
  );
}

async function spawnP2PSmoke(gatewayUrl: string) {
  await captureChecked(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["test:smoke:p2p"],
    {
      cwd: workspaceRoot,
      env: {
        WEAVENYC_API_BASE_URL: gatewayUrl,
        WEAVENYC_SMOKE_EXTERNAL_STARTUP_GRACE_MS: "0",
        WEAVENYC_P2P_SMOKE_STRICT: "1"
      }
    }
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
