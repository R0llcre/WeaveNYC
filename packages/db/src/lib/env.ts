import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type EnvShape = {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SIGNING_PRIVATE_KEY: string;
  JWT_SIGNING_PUBLIC_KEY: string;
  NODE_ENV: string;
  LOG_LEVEL: string;
};

const ENV_FILES = [".env.local", ".env"];

function parseEnvFile(content: string): Record<string, string> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf("=");
      if (index === -1) {
        return acc;
      }

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

export function loadRootEnv(cwd = process.cwd()): EnvShape {
  const rootDir = path.resolve(cwd);
  const fromFiles = ENV_FILES.reduce<Record<string, string>>((acc, fileName) => {
    const filePath = path.join(rootDir, fileName);
    if (existsSync(filePath)) {
      Object.assign(acc, parseEnvFile(readFileSync(filePath, "utf8")));
    }
    return acc;
  }, {});

  const fromExamplePath = path.join(rootDir, ".env.example");
  if (existsSync(fromExamplePath)) {
    Object.assign(fromFiles, parseEnvFile(readFileSync(fromExamplePath, "utf8")), fromFiles);
  }

  const env = {
    DATABASE_URL: process.env.DATABASE_URL ?? fromFiles.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL ?? fromFiles.REDIS_URL,
    JWT_SIGNING_PRIVATE_KEY:
      process.env.JWT_SIGNING_PRIVATE_KEY ?? fromFiles.JWT_SIGNING_PRIVATE_KEY,
    JWT_SIGNING_PUBLIC_KEY:
      process.env.JWT_SIGNING_PUBLIC_KEY ?? fromFiles.JWT_SIGNING_PUBLIC_KEY,
    NODE_ENV: process.env.NODE_ENV ?? fromFiles.NODE_ENV ?? "development",
    LOG_LEVEL: process.env.LOG_LEVEL ?? fromFiles.LOG_LEVEL ?? "debug"
  };

  for (const [key, value] of Object.entries(env)) {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return env as EnvShape;
}
