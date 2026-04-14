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

describe("M6 docs truth", () => {
  it("keeps branch-local M6 status and smoke coverage aligned", () => {
    const packageJson = JSON.parse(readText("package.json")) as {
      scripts?: Record<string, string>;
    };
    const readme = readText("README.md");
    const baseline = readText("docs/00_Execution_Baseline.md");
    const plan = readText("docs/13_Implementation_Plan.md");
    const backlog = readText("docs/14_Backlog.md");
    const apiSpec = readText("docs/09_API_Spec.md");
    const p2pDesign = readText("docs/07_P2P_Node_Design.md");
    const dataModel = readText("docs/08_Data_Model.md");
    const testing = readText("docs/12_Testing_Strategy.md");
    const guide = readText("docs/16_Contribution_Guide.md");

    assert.equal(
      packageJson.scripts?.["test:smoke:p2p"],
      "tsx scripts/run-p2p-smoke.ts",
      "package.json should expose the P2P smoke command",
    );

    mustContain(readme, "feature/m6-p2p-sync = M6 in progress", "README");
    mustContain(readme, "Branch-local M6 overlay smoke: `pnpm test:smoke:p2p`", "README");

    mustContain(baseline, "| `M6` | `in_progress_on_branch` |", "Execution baseline");
    mustContain(baseline, "`feature/m6-p2p-sync = M6 in progress`", "Execution baseline");

    mustContain(plan, "`M6` 是当前 branch-local 执行阶段", "Implementation plan");
    mustContain(plan, "`pnpm test:smoke:p2p`", "Implementation plan");

    mustContain(backlog, "`M6 in progress on branch`", "Backlog");
    mustContain(backlog, "E11-S4: P2P smoke harness and docs truth", "Backlog");

    mustContain(apiSpec, "## 8) M6 Branch Additions: P2P Contracts (In Progress)", "API spec");
    mustContain(apiSpec, "`GET /v1/communities/{community_id}/sync?since=<cursor-or-ISO>&limit=<n>`", "API spec");
    assert.ok(!apiSpec.includes("Future Appendix B: P2P Message Schemas"), "API spec should no longer frame M6 as a future appendix");

    mustContain(p2pDesign, "authoritative write path", "P2P node design");
    mustContain(p2pDesign, "M6 不做 P2P 聊天或 message sync", "P2P node design");

    mustContain(dataModel, "community_sync_events", "Data model");
    mustContain(dataModel, "p2p_event_cursor", "Data model");

    mustContain(testing, "`pnpm test:smoke:p2p`", "Testing strategy");
    mustContain(testing, "不并入当前 `main` 默认 close gate", "Testing strategy");
    mustContain(testing, "HTTP post write -> `post.published` replay", "Testing strategy");
    mustContain(testing, "announcement publish -> `announcement.published` replay", "Testing strategy");
    mustContain(testing, "post report create -> `report.created` replay", "Testing strategy");
    mustContain(testing, "anchor report decision -> `moderation.decision` replay", "Testing strategy");
    mustContain(testing, "empty / unseen catch-up", "Testing strategy");
    mustContain(testing, "不再只是 shape-only scaffold", "Testing strategy");
    mustContain(testing, "现有浏览器用例不直接覆盖 M6 的 `/bootstrap`、`/sync`、worker 双端同步或断线恢复", "Testing strategy");
    assert.ok(!testing.includes("WEAVENYC_P2P_SMOKE_STRICT"), "Testing strategy should not mention the removed skip-mode env var");
    assert.ok(!testing.includes("device A publish post -> device B sees synced cache"), "Testing strategy should not overclaim browser E2E sync coverage");

    mustContain(guide, "`pnpm test:smoke:p2p`", "Contribution guide");
    mustContain(guide, "packages/p2p", "Contribution guide");
    mustContain(guide, "独立 smoke，不并入 `main` 默认 gate", "Contribution guide");

    assert.ok(
      !p2pDesign.includes("detail_text?") &&
        !p2pDesign.includes("conversation_id?") &&
        !p2pDesign.includes("affected_user_id?"),
      "P2P node design should not document stale overlay-only fields",
    );
    assert.ok(
      apiSpec.includes('"aggregate_id": "ma_..."') &&
        !apiSpec.includes('"affected_user_id": null') &&
        !apiSpec.includes('"conversation_id": null'),
      "API spec should show the current moderation overlay example",
    );
  });
});
