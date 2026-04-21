import path from "node:path";

import { ingestAllPublicSources } from "../public-ingest";

interface CliArgs {
  fromCache: boolean;
  freeze: boolean;
  dryRun: boolean;
  outputPath: string;
  include?: string[];
  exclude?: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const args = new Set(argv.slice(2));
  const fromCache = args.has("--from-cache");
  const freeze = args.has("--freeze");
  const dryRun = args.has("--dry-run");

  // `--include foo,bar` style is accepted for filtering sources.
  const rawArgs = argv.slice(2);
  const include = rawArgs.reduce<string[] | undefined>((acc, cur, idx) => {
    if (cur === "--include" && rawArgs[idx + 1]) {
      return (rawArgs[idx + 1] ?? "").split(",").filter(Boolean);
    }
    return acc;
  }, undefined);
  const exclude = rawArgs.reduce<string[] | undefined>((acc, cur, idx) => {
    if (cur === "--exclude" && rawArgs[idx + 1]) {
      return (rawArgs[idx + 1] ?? "").split(",").filter(Boolean);
    }
    return acc;
  }, undefined);

  const outputPath = path.resolve(
    __dirname,
    "..",
    "seed",
    "generated",
    freeze ? "public-resources.snapshot.json" : "public-resources.json"
  );
  return { fromCache, freeze, dryRun, outputPath, include, exclude };
}

async function main() {
  const args = parseArgs(process.argv);
  process.stdout.write(
    `[public-ingest] starting (fromCache=${args.fromCache}, freeze=${args.freeze}, dryRun=${args.dryRun})\n`
  );

  let result = await ingestAllPublicSources({
    fromCache: args.fromCache,
    dryRun: args.dryRun,
    outputPath: args.outputPath,
    include: args.include,
    exclude: args.exclude,
  });

  // Snapshot mode is meant for class-day reliability; if a live run produced
  // any empty source, fall back to fixtures to guarantee the committed snapshot
  // covers every source. The fixtures are real rows pulled from the upstream
  // services, so this does not degrade demo fidelity.
  const anyEmptySource = result.sources.some((summary) => summary.rowCount === 0);
  if (args.freeze && anyEmptySource && !args.fromCache) {
    process.stdout.write(
      "[public-ingest] live run left one or more sources empty; rerunning with --from-cache to fill snapshot\n"
    );
    result = await ingestAllPublicSources({
      fromCache: true,
      dryRun: args.dryRun,
      outputPath: args.outputPath,
      include: args.include,
      exclude: args.exclude,
    });
  }

  for (const summary of result.sources) {
    process.stdout.write(
      `  - ${summary.sourceId}: ${summary.rowCount} rows (${summary.uniqueAfterDedup} unique) :: ${summary.sourceLabel}\n`
    );
  }
  process.stdout.write(
    `[public-ingest] total=${result.totalRows} uniqueAfterCrossSourceDedup=${result.uniqueRows}\n`
  );
  if (!args.dryRun) {
    process.stdout.write(`[public-ingest] wrote ${args.outputPath}\n`);
  }
}

void main().catch((err) => {
  process.stderr.write(
    `[public-ingest] failed: ${err instanceof Error ? err.message : err}\n`
  );
  process.exitCode = 1;
});
