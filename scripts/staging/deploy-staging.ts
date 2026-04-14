import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

import {
  ensureScratchDir,
  forbiddenEnvHits,
  flattenEnvGroups,
  missingEnvKeys,
  optionalEnv,
  readEnvProfiles,
  readRuntimeContracts,
  requiredEnv,
  writeScratchJson,
  workspaceRoot
} from "./lib.js";

type DeployReport = {
  profile: string;
  mode: "plan" | "apply";
  generated_at: string;
  git_sha: string | null;
  serviceArtifactList: Array<{
    name: string;
    class: string;
    provider: string;
    artifactPath: string;
    artifactExists: boolean;
    buildCommand: string;
    serveCommand: string;
  }>;
  serviceEnvList: Array<{
    name: string;
    smokeUrlEnv: string;
  }>;
  appArtifactList: Array<{
    name: string;
    class: string;
    provider: string;
    artifactPath: string;
    artifactExists: boolean;
    buildCommand: string;
    serveCommand: string;
  }>;
  appEnvList: Array<{
    name: string;
    smokeUrlEnv: string;
  }>;
  env: {
    missing: string[];
    forbidden: string[];
  };
  hookUrl: string | null;
  hookStatus?: number;
};

async function main() {
  const profile = process.env.WEAVENYC_DEPLOY_PROFILE?.trim() || "staging";
  const mode: "plan" | "apply" = optionalEnv("WEAVENYC_STAGING_DEPLOY_MODE") === "apply" ? "apply" : "plan";
  const runtimeContracts = readRuntimeContracts();
  const envProfiles = readEnvProfiles();
  const profileSpec = envProfiles.profiles[profile];

  if (!profileSpec) {
    throw new Error(`Unknown deploy profile: ${profile}`);
  }

  const requiredGroups = mode === "apply" ? ["runtime", "deploy", "integrations", "cloud"] : [];
  const requiredKeys = flattenEnvGroups(profileSpec.groups, requiredGroups);
  const missing = missingEnvKeys(requiredKeys, process.env);
  const forbidden = forbiddenEnvHits(profileSpec.forbidden?.runtime ?? [], process.env);

  if (missing.length > 0) {
    throw new Error(`Missing required env for ${profile} (${mode}): ${missing.join(", ")}`);
  }

  if (forbidden.length > 0) {
    throw new Error(`Forbidden env values detected for ${profile}: ${forbidden.join(", ")}`);
  }

  const currentRuntimes = runtimeContracts.runtimes.filter((runtime) => runtime.class === "current");
  const allRuntimeArtifacts = runtimeContracts.runtimes.map((runtime) => ({
    name: runtime.name,
    class: runtime.class,
    provider: runtime.provider,
    artifactPath: runtime.artifactPath,
    artifactExists: runtime.repoPresenceRequired ? existsSync(resolve(workspaceRoot, runtime.artifactPath)) : false,
    buildCommand: runtime.buildCommand,
    serveCommand: runtime.serveCommand
  }));
  const allRuntimeEnv = runtimeContracts.runtimes.map((runtime) => ({
    name: runtime.name,
    smokeUrlEnv: runtime.smokeUrlEnv
  }));
  const serviceNames = new Set([
    "api-gateway",
    "posts-service",
    "match-service",
    "chat-service",
    "resource-directory-service",
    "notifications-service"
  ]);
  const report: DeployReport = {
    profile,
    mode,
    generated_at: new Date().toISOString(),
    git_sha: process.env.GITHUB_SHA ?? null,
    serviceArtifactList: allRuntimeArtifacts.filter((runtime) => serviceNames.has(runtime.name)),
    serviceEnvList: allRuntimeEnv.filter((runtime) => serviceNames.has(runtime.name)),
    appArtifactList: allRuntimeArtifacts.filter((runtime) => !serviceNames.has(runtime.name)),
    appEnvList: allRuntimeEnv.filter((runtime) => !serviceNames.has(runtime.name)),
    env: {
      missing: [],
      forbidden: []
    },
    hookUrl: optionalEnv("WEAVENYC_STAGING_DEPLOY_HOOK_URL") ?? null
  };

  const artifactMissing = currentRuntimes
    .map((runtime) => ({
      name: runtime.name,
      artifactExists: runtime.repoPresenceRequired ? existsSync(resolve(workspaceRoot, runtime.artifactPath)) : false
    }))
    .filter((runtime) => !runtime.artifactExists)
    .map((runtime) => runtime.name);
  if (artifactMissing.length > 0) {
    throw new Error(`Expected deployable artifacts are missing: ${artifactMissing.join(", ")}`);
  }

  ensureScratchDir();
  const reportPath = writeScratchJson("deploy-plan.json", report);
  const serviceArtifactListPath = writeScratchJson("service-runtime-artifacts.json", report.serviceArtifactList);
  const serviceEnvListPath = writeScratchJson("service-runtime-env.json", report.serviceEnvList);
  const appArtifactListPath = writeScratchJson("app-artifacts.json", report.appArtifactList);
  const appEnvListPath = writeScratchJson("app-env.json", report.appEnvList);

  if (mode === "apply") {
    const hookUrl = requiredEnv("WEAVENYC_STAGING_DEPLOY_HOOK_URL");
    const hookResponse = await fetch(hookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(report)
    });
    report.hookStatus = hookResponse.status;
    if (!hookResponse.ok) {
      throw new Error(`Staging deploy hook returned ${hookResponse.status}`);
    }
    writeScratchJson("deploy-plan.json", report);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath,
        serviceArtifactListPath,
        serviceEnvListPath,
        appArtifactListPath,
        appEnvListPath,
        report
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
