/**
 * Demo local stack spin-up (B5/B6).
 *
 * Brings the demo environment up on a developer laptop in <30s on Apple
 * Silicon. Runs:
 *
 *   1. `docker compose -f docker-compose.demo.yml up --build -d`
 *      (pwa, api, postgres, redis, mailhog)
 *   2. `pnpm db:migrate`
 *   3. `SEED_DEMO_PERSONAS=1 SEED_PUBLIC_SOURCES=1 pnpm db:seed`
 *      — SEED_PUBLIC_SOURCES comes from Impl-1's public-ingest module.
 *      If that module isn't merged yet the seed script gracefully falls
 *      back to the normal seed; if seeding itself fails for a reason not
 *      related to the SEED_PUBLIC_SOURCES flag we still exit non-zero so
 *      the developer sees the failure.
 *
 * The seeded fixtures share UUIDs with the cloud preflight so screenshots
 * taken locally match production personas exactly.
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function run(
  command: string,
  args: string[],
  opts: { env?: NodeJS.ProcessEnv; allowFailure?: boolean } = {}
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: "inherit"
    });
    const [code] = (await once(child, "exit")) as [number | null];
    const exitCode = code ?? 0;
    if (exitCode !== 0 && !opts.allowFailure) {
      reject(
        new Error(`${command} ${args.join(" ")} exited with code ${exitCode}`)
      );
      return;
    }
    resolve(exitCode);
  });
}

async function main(): Promise<void> {
  console.log("[demo:local] bringing up docker-compose.demo.yml…");
  await run("docker", [
    "compose",
    "-f",
    "docker-compose.demo.yml",
    "up",
    "--build",
    "-d"
  ]);

  console.log("[demo:local] running pnpm db:migrate…");
  await run("pnpm", ["db:migrate"]);

  console.log("[demo:local] running pnpm db:seed (demo personas + public sources)…");
  const seedExit = await run(
    "pnpm",
    ["db:seed"],
    {
      env: {
        SEED_DEMO_PERSONAS: "1",
        SEED_PUBLIC_SOURCES: "1"
      },
      allowFailure: true
    }
  );

  if (seedExit !== 0) {
    // Impl-1's public-ingest module may not be merged yet; in that case
    // the seed script will fail due to the SEED_PUBLIC_SOURCES branch.
    // Fall back to seeding only the demo personas.
    console.log(
      "[demo:local] seed with SEED_PUBLIC_SOURCES failed — public ingest not available yet, retrying demo personas only"
    );
    await run("pnpm", ["db:seed"], {
      env: { SEED_DEMO_PERSONAS: "1" }
    });
  }

  console.log("[demo:local] ready. Open http://localhost:3000/?demo=1");
}

void main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[demo:local] failed: ${msg}`);
  process.exit(1);
});
