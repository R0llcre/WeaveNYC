import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";

function readText(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function mustContain(text: string, needle: string, label: string) {
  assert.ok(text.includes(needle), `${label} is missing expected text: ${needle}`);
}

describe("M7 docs truth", () => {
  it("keeps main-first M6 closeout and branch-local M7 staging truth aligned", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const readme = readText("README.md");
    const baseline = readText("docs/00_Execution_Baseline.md");
    const plan = readText("docs/13_Implementation_Plan.md");
    const backlog = readText("docs/14_Backlog.md");
    const apiSpec = readText("docs/09_API_Spec.md");
    const testing = readText("docs/12_Testing_Strategy.md");
    const opsRunbook = readText("docs/11_Ops_Runbook.md");
    const deploymentGuide = readText("docs/19_Deployment_Guide.md");
    const guide = readText("docs/16_Contribution_Guide.md");

    assert.equal(
      packageJson.scripts?.["test:smoke:p2p"],
      "tsx scripts/run-p2p-smoke.ts",
      "package.json should expose the P2P smoke command",
    );

    mustContain(readme, "main = M6 completed (canonical baseline)", "README");
    mustContain(readme, "feature/m7-staging-rehearsal = M7 in progress", "README");

    mustContain(baseline, "| `M6` | `completed` |", "Execution baseline");
    mustContain(baseline, "| `M7` | `in_progress_on_branch` |", "Execution baseline");
    mustContain(baseline, "`feature/m7-staging-rehearsal = M7 in progress`", "Execution baseline");

    mustContain(plan, "`M7` 是当前 branch-local 执行阶段", "Implementation plan");
    mustContain(plan, "`pnpm test:smoke:p2p`", "Implementation plan");

    mustContain(backlog, "`M7 in progress on branch`", "Backlog");
    mustContain(backlog, "Epic E13: Staging Truth 收口（M7）", "Backlog");

    mustContain(apiSpec, "`main` 的 canonical surface 已覆盖 M0-M6", "API spec");
    mustContain(apiSpec, "`feature/m7-staging-rehearsal` 只承接 staging truth 收口，不新增用户端 HTTP product surface", "API spec");

    mustContain(testing, "`pnpm test:smoke:p2p`", "Testing strategy");
    mustContain(testing, "`main = M6 completed`", "Testing strategy");
    mustContain(testing, "`feature/m7-staging-rehearsal`", "Testing strategy");
    mustContain(testing, "staging truth 收口", "Testing strategy");

    mustContain(opsRunbook, "`main` 当前已是 `M6 completed`", "Ops runbook");
    mustContain(opsRunbook, "当前可执行 staging truth", "Ops runbook");

    mustContain(deploymentGuide, "当前可执行 staging truth", "Deployment guide");
    mustContain(deploymentGuide, "production / canary / multi-cloud / full observability 都下沉为 appendix 或 future notes", "Deployment guide");

    mustContain(guide, "`pnpm test:smoke:p2p`", "Contribution guide");
    mustContain(guide, "packages/p2p", "Contribution guide");
    mustContain(guide, "独立 smoke", "Contribution guide");
  });
});
