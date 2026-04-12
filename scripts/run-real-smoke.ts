import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import process from "node:process";

const workspaceRoot = process.cwd();
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const apiBaseUrl = (process.env.WEAVENYC_API_BASE_URL ?? "http://127.0.0.1:4000").replace(/\/$/, "");
const startupTimeoutMs = 60_000;

async function isReady() {
  try {
    const response = await fetch(`${apiBaseUrl}/readyz`, {
      signal: AbortSignal.timeout(1_500)
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function waitForReady(deadlineMs: number) {
  const deadline = Date.now() + deadlineMs;

  while (Date.now() < deadline) {
    if (await isReady()) {
      return;
    }
    await sleep(1_000);
  }

  throw new Error(`Timed out waiting ${deadlineMs}ms for ${apiBaseUrl}/readyz`);
}

function spawnProcess(command: string, args: string[], options: { stdio: "inherit" | "pipe" }) {
  return spawn(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: options.stdio
  });
}

function pipeOutput(child: ChildProcess) {
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);
}

async function runChild(child: ChildProcess, label: string) {
  const [code, signal] = (await once(child, "exit")) as [number | null, NodeJS.Signals | null];
  if (code !== 0) {
    throw new Error(`${label} exited with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`);
  }
}

async function main() {
  let serverChild: ChildProcess | null = null;

  try {
    if (!(await isReady())) {
      serverChild = spawnProcess(
        pnpmCommand,
        ["--filter", "@weavenyc/api-gateway", "exec", "tsx", "src/server.ts"],
        { stdio: "pipe" }
      );
      pipeOutput(serverChild);

      serverChild.once("exit", (code, signal) => {
        if (code !== null && code !== 0) {
          console.error(`api-gateway bootstrap exited early with code ${code}${signal ? ` (${signal})` : ""}`);
        }
      });

      await waitForReady(startupTimeoutMs);
    }

    const smokeChild = spawnProcess(pnpmCommand, ["exec", "tsx", "tests/smoke/real-api.ts"], { stdio: "inherit" });
    await runChild(smokeChild, "real API smoke");
  } finally {
    if (serverChild && serverChild.exitCode === null && !serverChild.killed) {
      serverChild.kill("SIGTERM");
      try {
        await once(serverChild, "exit");
      } catch {
        // Ignore shutdown race during cleanup.
      }
    }
  }
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
