import path from "node:path";

import { config } from "dotenv";

const currentDir = __dirname;
const workspaceRoot = path.resolve(currentDir, "../../..");

config({ path: path.join(workspaceRoot, ".env.local"), override: false });
config({ path: path.join(workspaceRoot, ".env"), override: false });

export function resolveWorkspacePath(input: string): string {
  return path.isAbsolute(input) ? input : path.resolve(workspaceRoot, input);
}

export function getDbEnv() {
  return {
    workspaceRoot,
    databaseUrl:
      process.env.DATABASE_URL ??
      "postgresql://weavenyc:weavenyc@localhost:5432/weavenyc_dev"
  };
}

export function getDatabaseUrl() {
  return getDbEnv().databaseUrl;
}
