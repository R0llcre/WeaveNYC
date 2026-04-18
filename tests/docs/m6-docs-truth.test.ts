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

describe("M7 closeout and M8 planning docs truth", () => {
  it("keeps main-first M7 closeout and M8 pending truth aligned", () => {
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
    const closeoutM7 = readText("docs/28_M7_Closeout.md");

    assert.equal(
      packageJson.scripts?.["test:smoke:p2p"],
      "tsx scripts/run-p2p-smoke.ts",
      "package.json should expose the P2P smoke command",
    );

    mustContain(readme, "main = M7 completed (canonical baseline)", "README");
    mustContain(readme, "M8 = pending (next phase)", "README");

    mustContain(baseline, "| `M7` | `completed` |", "Execution baseline");
    mustContain(baseline, "| `M8` | `pending` |", "Execution baseline");
    mustContain(baseline, "`M8 = pending (Pilot Readiness)`", "Execution baseline");

    mustContain(plan, "`M7` 已完成", "Implementation plan");
    mustContain(plan, "`M8` 是当前下一阶段", "Implementation plan");

    mustContain(backlog, "`main = M7 completed`", "Backlog");
    mustContain(backlog, "`M8 pending`", "Backlog");
    mustContain(backlog, "Epic E13: Staging Truth 收口（M7）— Status: `Completed (M7)`", "Backlog");
    mustContain(backlog, "Epic E14: Pilot Readiness & Operational Hardening（M8）— Status: `Pending (M8)`", "Backlog");

    mustContain(apiSpec, "`main` 的 canonical surface 已覆盖 M0-M7", "API spec");
    mustContain(apiSpec, "M8", "API spec");

    mustContain(testing, "`pnpm test:smoke:p2p`", "Testing strategy");
    mustContain(testing, "`main = M7 completed`", "Testing strategy");
    mustContain(testing, "`M8 Pilot Readiness`", "Testing strategy");
    mustContain(testing, "staging gate", "Testing strategy");

    mustContain(opsRunbook, "`main` 当前已是 `M7 completed`", "Ops runbook");
    mustContain(opsRunbook, "当前可执行 staging truth", "Ops runbook");

    mustContain(deploymentGuide, "当前可执行 staging truth", "Deployment guide");
    mustContain(deploymentGuide, "`main = M7 completed`", "Deployment guide");
    mustContain(deploymentGuide, "`M8 Pilot Readiness`", "Deployment guide");

    mustContain(guide, "`pnpm test:smoke:p2p`", "Contribution guide");
    mustContain(guide, "packages/p2p", "Contribution guide");
    mustContain(guide, "`M7 completed`", "Contribution guide");
    mustContain(guide, "`M8 Pilot Readiness`", "Contribution guide");

    mustContain(closeoutM7, "状态：`M7 completed`", "M7 closeout");
    mustContain(closeoutM7, "`M8 Pilot Readiness`", "M7 closeout");
  });
});
