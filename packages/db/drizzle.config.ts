import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://weavenyc:weavenyc@localhost:5432/weavenyc_dev"
  },
  verbose: true,
  strict: true
} satisfies Config;
