import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import process from "node:process";

type JsonValue = unknown;

export const workspaceRoot = process.cwd();
export const deployRoot = resolve(workspaceRoot, "deploy");
export const stagingScratchRoot = resolve(workspaceRoot, ".staging");

function parseEnvFile(content: string): Record<string, string> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .reduce<Record<string, string>>((acc, line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        return acc;
      }
      acc[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
      return acc;
    }, {});
}

export function loadJson<T = JsonValue>(relativePath: string): T {
  const filePath = resolve(workspaceRoot, relativePath);
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function loadWorkspaceEnv() {
  const merged: Record<string, string> = {};
  for (const fileName of [".env.example", ".env", ".env.local"]) {
    const filePath = resolve(workspaceRoot, fileName);
    if (existsSync(filePath)) {
      Object.assign(merged, parseEnvFile(readFileSync(filePath, "utf8")));
    }
  }
  return merged;
}

export function ensureScratchDir() {
  if (!existsSync(stagingScratchRoot)) {
    mkdirSync(stagingScratchRoot, { recursive: true });
  }
}

export function writeScratchJson(fileName: string, value: JsonValue) {
  ensureScratchDir();
  const filePath = resolve(stagingScratchRoot, fileName);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export function requiredEnv(name: string, source: NodeJS.ProcessEnv = process.env) {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, source: NodeJS.ProcessEnv = process.env) {
  return source[name]?.trim() || undefined;
}

export function flattenEnvGroups(groups: Record<string, string[]>, requestedGroups: string[]) {
  return requestedGroups.flatMap((group) => groups[group] ?? []);
}

export function missingEnvKeys(names: string[], source: NodeJS.ProcessEnv = process.env) {
  return names.filter((name) => !source[name]?.trim());
}

export function forbiddenEnvHits(forbidden: string[], source: NodeJS.ProcessEnv = process.env) {
  const hits: string[] = [];
  for (const entry of forbidden) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = entry.slice(0, separator);
    const expectedValue = entry.slice(separator + 1);
    if (source[key]?.trim() === expectedValue) {
      hits.push(entry);
    }
  }
  return hits;
}

export function readRuntimeContracts() {
  return loadJson<{
    schemaVersion: number;
    topology: string;
    runtimes: Array<{
      name: string;
      class: "current" | "planned";
      package: string;
      workspace: string;
      provider: string;
      artifactPath: string;
      buildCommand: string;
      serveCommand: string;
      smokeUrlEnv: string;
      healthPaths: string[];
      repoPresenceRequired: boolean;
    }>;
  }>("deploy/runtime-contracts.json");
}

export function readEnvProfiles() {
  return loadJson<{
    schemaVersion: number;
    profiles: Record<
      string,
      {
        groups: Record<string, string[]>;
        forbidden?: Record<string, string[]>;
      }
    >;
  }>("deploy/env-profiles.json");
}

export function spawnChecked(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {}) {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: {
        ...process.env,
        ...(options.env ?? {})
      },
      stdio: options.input !== undefined ? ["pipe", "inherit", "inherit"] : "inherit"
    });

    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`));
    });

    if (options.input !== undefined && child.stdin) {
      child.stdin.end(options.input);
    }
  });
}

export async function captureChecked(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  return new Promise<string>((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    const child = spawn(command, args, {
      cwd: options.cwd ?? workspaceRoot,
      env: {
        ...process.env,
        ...(options.env ?? {})
      },
      stdio: ["ignore", "pipe", "inherit"]
    });

    child.stdout?.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code !== 0) {
        rejectPromise(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "null"}${signal ? ` (signal: ${signal})` : ""}`));
        return;
      }
      resolvePromise(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

export async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8_000) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const bodyText = await response.text();
  let body: unknown = null;
  if (bodyText.length > 0) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }
  return { response, body };
}
