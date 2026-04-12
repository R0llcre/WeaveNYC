import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readText(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

function mustContain(text: string, needle: string, label: string) {
  assert.ok(text.includes(needle), `${label} is missing expected text: ${needle}`);
}

function mustContainAll(text: string, needles: string[], label: string) {
  for (const needle of needles) {
    mustContain(text, needle, label);
  }
}

function main() {
  const packageJson = JSON.parse(readText('package.json')) as {
    scripts?: Record<string, string>;
  };
  const readme = readText('README.md');
  const baseline = readText('docs/00_Execution_Baseline.md');
  const plan = readText('docs/13_Implementation_Plan.md');
  const guide = readText('docs/16_Contribution_Guide.md');
  const apiSpec = readText('docs/09_API_Spec.md');
  const authDesign = readText('docs/18_Auth_Design.md');
  const runbook = readText('docs/11_Ops_Runbook.md');
  const rootCompose = readText('docker-compose.yml');
  const infraCompose = readText('infra/docker-compose.yml');
  const closeout = readText('docs/26_M5_Closeout.md');
  const realSmokeWrapper = readText('scripts/run-real-smoke.ts');

  mustContain(readme, 'main = M4 completed (canonical baseline)', 'README');
  mustContain(readme, 'feature/m5-anchor-admin = M5 completed on branch', 'README');
  mustContain(readme, 'docs/26_M5_Closeout.md', 'README');
  mustContain(
    readme,
    'Branch-local `feature/m5-anchor-admin` closeout gates: `pnpm db:migrate` -> `pnpm db:seed` -> `pnpm test:smoke:real` -> `pnpm test:e2e`',
    'README',
  );
  mustContain(readme, 'Manual / opt-in: `pnpm test:live-sources`, `pnpm dev:mint-anchor-token`', 'README');
  mustContain(baseline, 'feature/m5-anchor-admin', 'Execution baseline');
  mustContain(baseline, '| `M5` | `completed_on_branch` | Anchor Admin、report queue、announcements、rules、dashboard、pilot rehearsal、real smoke、E2E 和 6-lane review gate 已关闭 |', 'Execution baseline');
  mustContain(
    baseline,
    'branch-local `feature/m5-anchor-admin` closeout：`pnpm db:migrate`、`pnpm db:seed`、`pnpm test:smoke:real`、`pnpm test:e2e`',
    'Execution baseline',
  );
  mustContain(baseline, 'manual / opt-in：`pnpm test:live-sources`、`pnpm dev:mint-anchor-token`', 'Execution baseline');
  mustContain(plan, 'feature/m5-anchor-admin', 'Implementation plan');
  mustContain(plan, 'M5', 'Implementation plan');
  mustContain(plan, 'Completed on branch', 'Implementation plan');
  assert.ok(!plan.includes('继续先关闭 `M5`'), 'Implementation plan should not keep M5 as the current execution start');
  mustContain(plan, '当前分支的 M5 closeout 已关闭', 'Implementation plan');
  mustContain(guide, 'M5 closeout', 'Contribution guide');
  mustContain(guide, 'Manual / debug only：', 'Contribution guide');
  mustContainAll(
    guide,
    [
      'pnpm test:smoke:real',
      'pnpm test:e2e',
      'pnpm test:live-sources',
      'pnpm dev:mint-anchor-token',
      '会先自启动 `api-gateway`',
      '不属于 M5 closeout 必经路径',
    ],
    'Contribution guide',
  );
  mustContainAll(
    apiSpec,
    [
      '`POST /v1/auth/anchor/activate`',
      '{ "invite_code": "WEAVE-ANCHOR-11735" }',
      '`POST /v1/auth/anchor/activate/confirm`',
      '`POST /v1/auth/anchor/session/start`',
      '`POST /v1/auth/anchor/session/verify`',
    ],
    'API spec',
  );
  assert.ok(!apiSpec.includes('"totp_secret": "base32..."'), 'API spec should not use the deprecated anchor activate payload');
  mustContainAll(
    authDesign,
    [
      'POST /v1/auth/anchor/activate',
      '{ "invite_code": "WEAVE-ANCHOR-11735" }',
      'POST /v1/auth/anchor/activate/confirm',
      'POST /v1/auth/anchor/session/start',
      'POST /v1/auth/anchor/session/verify',
    ],
    'Auth design',
  );
  assert.ok(!authDesign.includes('"totp_secret": "base32..."'), 'Auth design should not use the deprecated anchor activate payload');
  mustContainAll(
    runbook,
    [
      'pnpm db:migrate && pnpm db:seed',
      'pnpm test:smoke:real',
      'pnpm test:e2e',
    ],
    'Ops runbook',
  );
  assert.equal(
    packageJson.scripts?.['test:smoke:real'],
    'tsx scripts/run-real-smoke.ts',
    'package.json should route test:smoke:real through the real-smoke wrapper',
  );
  mustContainAll(
    realSmokeWrapper,
    [
      '@weavenyc/api-gateway',
      'src/server.ts',
      'tests/smoke/real-api.ts',
      '/readyz',
    ],
    'Real smoke wrapper',
  );
  assert.ok(!rootCompose.includes('container_name:'), 'Root docker-compose should not pin container_name');
  assert.ok(!infraCompose.includes('container_name:'), 'Infra docker-compose should not pin container_name');
  mustContain(closeout, 'M5 completed on branch', 'M5 closeout');
  mustContain(closeout, 'Review Gate', 'M5 closeout');
  mustContainAll(
    closeout,
    [
      'pnpm test:smoke:real',
      'fresh `pnpm db:migrate` + `pnpm db:seed`',
      '自启动 `api-gateway`',
      'manual / opt-in',
      'pnpm dev:mint-anchor-token',
    ],
    'M5 closeout',
  );
  mustContain(closeout, '[x] `pnpm test:smoke:real`', 'M5 closeout');
  mustContain(closeout, '- [x] 6-lane review gate', 'M5 closeout');

  console.log(
    JSON.stringify(
      {
        ok: true,
        checked: [
          'README',
          'Execution baseline',
          'Implementation plan',
          'Contribution guide',
          'M5 closeout',
        ],
      },
      null,
      2,
    ),
  );
}

main();
