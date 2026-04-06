import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getDbEnv } from "./env";
import { schema } from "./schema";

const globalScope = globalThis as {
  __weavenycPool?: Pool;
};

export function createPool(connectionString = getDbEnv().databaseUrl): Pool {
  return new Pool({
    connectionString
  });
}

export const pool = globalScope.__weavenycPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalScope.__weavenycPool = pool;
}

export const db = drizzle(pool, { schema });
export type Database = typeof db;

export async function checkDatabaseConnection(): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query("select 1");
    return true;
  } finally {
    client.release();
  }
}
