import process from "node:process";

import {
  captureChecked,
  forbiddenEnvHits,
  flattenEnvGroups,
  loadWorkspaceEnv,
  missingEnvKeys,
  optionalEnv,
  readEnvProfiles,
  readRuntimeContracts,
  requiredEnv,
  spawnChecked,
  writeScratchJson
} from "./lib.js";

type BackupRestoreReport = {
  generated_at: string;
  profile: string;
  mode: "local-compose" | "url";
  sourceDatabaseUrl: string;
  restoreDatabaseUrl: string;
  dumpBytes: number;
  restored: boolean;
  verification: Array<{ sql: string; rowCount: number }>;
};

async function main() {
  const mode = optionalEnv("WEAVENYC_BACKUP_MODE") === "url" ? "url" : "local-compose";
  const envSource =
    mode === "local-compose"
      ? {
          ...loadWorkspaceEnv(),
          ...process.env,
          NODE_ENV: process.env.NODE_ENV ?? "development"
        }
      : process.env;
  const profile = envSource.WEAVENYC_DEPLOY_PROFILE?.trim() || (mode === "url" ? "staging" : "development");
  const runtimeContracts = readRuntimeContracts();
  const envProfiles = readEnvProfiles();
  const profileSpec = envProfiles.profiles[profile];
  if (!profileSpec) {
    throw new Error(`Unknown backup profile: ${profile}`);
  }

  const requiredGroups = mode === "url" ? ["runtime", "deploy", "integrations"] : ["runtime"];
  const requiredKeys = flattenEnvGroups(profileSpec.groups, requiredGroups).filter(
    (key) => !(mode === "local-compose" && key === "NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED")
  );
  const missing = missingEnvKeys(requiredKeys, envSource);
  const forbidden = forbiddenEnvHits(profileSpec.forbidden?.runtime ?? [], envSource);
  if (missing.length > 0) {
    throw new Error(`Missing required env for backup rehearsal: ${missing.join(", ")}`);
  }
  if (forbidden.length > 0) {
    throw new Error(`Forbidden env values detected for backup rehearsal: ${forbidden.join(", ")}`);
  }

  const sourceDatabaseUrl =
    mode === "url"
      ? requiredEnv("WEAVENYC_BACKUP_SOURCE_DATABASE_URL", envSource)
      : optionalEnv("WEAVENYC_BACKUP_SOURCE_DATABASE_URL", envSource) ?? requiredEnv("DATABASE_URL", envSource);
  const restoreDatabaseUrl =
    mode === "url"
      ? requiredEnv("WEAVENYC_BACKUP_RESTORE_DATABASE_URL", envSource)
      : optionalEnv("WEAVENYC_BACKUP_RESTORE_DATABASE_URL", envSource) ??
        optionalEnv("WEAVENYC_BACKUP_SHADOW_DATABASE_URL", envSource) ??
        deriveShadowDatabaseUrl(sourceDatabaseUrl);

  const dump = await createDump(mode, sourceDatabaseUrl);
  const dumpBytes = Buffer.byteLength(dump, "utf8");
  await restoreDump(mode, restoreDatabaseUrl, dump);
  const verification = await verifyRestore(mode, restoreDatabaseUrl);

  const report: BackupRestoreReport = {
    generated_at: new Date().toISOString(),
    profile,
    mode,
    sourceDatabaseUrl,
    restoreDatabaseUrl,
    dumpBytes,
    restored: true,
    verification
  };
  const reportPath = writeScratchJson("backup-restore-report.json", report);

  console.log(
    JSON.stringify(
      {
        ok: true,
        reportPath,
        report,
        runtimesReferenced: runtimeContracts.runtimes.length
      },
      null,
      2
    )
  );
}

async function createDump(mode: "local-compose" | "url", databaseUrl: string) {
  if (mode === "local-compose") {
    const { user, password, database } = parsePostgresUrl(databaseUrl);
    return captureChecked(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "sh",
        "-lc",
        [
          `export PGPASSWORD=${shellQuote(password)};`,
          `pg_dump -U ${shellQuote(user)} -d ${shellQuote(database)} --no-owner --no-privileges`
        ].join(" ")
      ],
      {
        cwd: process.cwd()
      }
    );
  }

  return captureChecked(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "-e",
      "PGDATABASE_URL=" + databaseUrl,
      "postgres:16",
      "sh",
      "-lc",
      'pg_dump "$PGDATABASE_URL" --no-owner --no-privileges'
    ],
    {
      cwd: process.cwd()
    }
  );
}

async function restoreDump(mode: "local-compose" | "url", databaseUrl: string, dump: string) {
  if (mode === "local-compose") {
    const { user, password, database } = parsePostgresUrl(databaseUrl);
    await spawnChecked(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "sh",
        "-lc",
        [
          `export PGPASSWORD=${shellQuote(password)};`,
          `dropdb -U ${shellQuote(user)} --if-exists ${shellQuote(database)};`,
          `createdb -U ${shellQuote(user)} ${shellQuote(database)};`,
          `psql -U ${shellQuote(user)} -d ${shellQuote(database)} -v ON_ERROR_STOP=1`
        ].join(" ")
      ],
      {
        cwd: process.cwd(),
        input: dump
      }
    );
    return;
  }

  await spawnChecked(
    "docker",
    [
      "run",
      "--rm",
      "-i",
      "-e",
      "PGDATABASE_URL=" + databaseUrl,
      "postgres:16",
      "sh",
      "-lc",
      'psql "$PGDATABASE_URL" -v ON_ERROR_STOP=1'
    ],
    {
      cwd: process.cwd(),
      input: dump
    }
  );
}

async function verifyRestore(mode: "local-compose" | "url", databaseUrl: string) {
  const verificationSql = [
    "select count(*) from communities;",
    "select count(*) from users;",
    "select count(*) from posts;"
  ];

  const verification: Array<{ sql: string; rowCount: number }> = [];
  for (const sql of verificationSql) {
    const output =
      mode === "local-compose"
        ? await captureChecked(
            "docker",
            [
              "compose",
              "exec",
              "-T",
              "postgres",
              "sh",
              "-lc",
              `psql -U ${shellQuote(parsePostgresUrl(databaseUrl).user)} -d ${shellQuote(parsePostgresUrl(databaseUrl).database)} -Atc ${shellQuote(sql)}`
            ],
            {
              cwd: process.cwd()
            }
          )
        : await captureChecked(
            "docker",
            [
              "run",
              "--rm",
              "-i",
              "-e",
              "PGDATABASE_URL=" + databaseUrl,
              "postgres:16",
              "sh",
              "-lc",
              `psql "$PGDATABASE_URL" -Atc ${JSON.stringify(sql)}`
            ],
            {
              cwd: process.cwd()
            }
          );

    verification.push({
      sql,
      rowCount: Number(output.trim())
    });
  }
  return verification;
}

function parsePostgresUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "")
  };
}

function deriveShadowDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  const database = url.pathname.replace(/^\//, "");
  url.pathname = `/${database.endsWith("_shadow") ? database : `${database}_shadow`}`;
  return url.toString();
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
