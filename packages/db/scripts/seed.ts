import { drizzle } from 'drizzle-orm/node-postgres';

import { createPool } from '../src/client';
import { schema } from '../src/schema';
import { seedDatabase } from '../seed';

export async function runSeed() {
  const pool = createPool();
  const db = drizzle(pool, { schema });

  try {
    const result = await seedDatabase(db);
    if (!result.ok) {
      throw new Error('Seed verification failed');
    }
  } finally {
    await pool.end();
  }
}

void runSeed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
