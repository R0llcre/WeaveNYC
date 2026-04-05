import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { loadRootEnv } from "./env.js";
import * as schema from "../schema/index.js";

export function createPool() {
  const env = loadRootEnv();

  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10
  });
}

export function createDb(pool = createPool()) {
  return drizzle(pool, { schema });
}
