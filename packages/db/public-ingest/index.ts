import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { dedupe } from "./dedup";
import { assertNoPersonPii } from "./pii";
import { foodhelpNyc } from "./sources/foodhelp-nyc";
import { usdaSnap } from "./sources/usda-snap";
import { dftaSeniorMeals } from "./sources/dfta-senior-meals";
import { hrsaFqhc } from "./sources/hrsa-fqhc";
import type {
  IngestOptions,
  IngestResult,
  PublicSourceModule,
  ResourceProviderSeed,
  SourceIngestSummary,
} from "./types";

/**
 * The public registry — ORDER MATTERS. The first source to emit a given
 * (name, zip, phone) triple wins in `dedupe`, so we keep the most-authoritative
 * directory (NYC HRA Food Help NYC) at the top.
 */
export const publicSourceRegistry: PublicSourceModule[] = [
  foodhelpNyc as PublicSourceModule,
  usdaSnap as PublicSourceModule,
  dftaSeniorMeals as PublicSourceModule,
  hrsaFqhc as PublicSourceModule,
];

function filterRegistry(
  registry: PublicSourceModule[],
  opts: Pick<IngestOptions, "include" | "exclude">
): PublicSourceModule[] {
  const { include, exclude } = opts;
  const includeSet = include && include.length > 0 ? new Set(include) : null;
  const excludeSet = exclude && exclude.length > 0 ? new Set(exclude) : null;
  return registry.filter((source) => {
    if (includeSet && !includeSet.has(source.id)) return false;
    if (excludeSet && excludeSet.has(source.id)) return false;
    return true;
  });
}

/**
 * Top-level entry: fetch → normalize → PII-check → dedupe → optionally write.
 * Caller may pass `fromCache: true` to force every source to read its
 * checked-in fixture — this is the class-day safety net.
 */
export async function ingestAllPublicSources(
  opts: IngestOptions = {}
): Promise<IngestResult> {
  const sources = filterRegistry(publicSourceRegistry, opts);
  const summaries: SourceIngestSummary[] = [];
  const allRows: ResourceProviderSeed[] = [];

  for (const source of sources) {
    // Per-source rate limiting is enforced inside each module's `fetch`. The
    // orchestrator runs sources sequentially so two modules cannot simultaneously
    // spike an upstream API; sequential ordering also yields stable
    // deduplication priority.
    const raw = await source.fetch({ fromCache: opts.fromCache });
    const normalized = source.normalize(raw);

    for (const row of normalized) {
      try {
        assertNoPersonPii(row);
        source.pii(row);
        allRows.push(row);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[public-ingest] skipped ${source.id} row: ${message}\n`);
      }
    }

    const sourceRows = normalized.length;
    const uniqueSourceRows = dedupe(
      allRows.filter((row) => row.source === source.id)
    ).length;
    summaries.push({
      sourceId: source.id,
      sourceLabel: source.sourceLabel,
      sourceUrl: source.sourceUrl,
      datasetVersion: source.attribution().datasetVersion,
      rowCount: sourceRows,
      uniqueAfterDedup: uniqueSourceRows,
    });
  }

  const deduped = dedupe(allRows);

  const result: IngestResult = {
    generatedAt: new Date().toISOString(),
    totalRows: allRows.length,
    uniqueRows: deduped.length,
    sources: summaries,
    rows: deduped,
  };

  if (!opts.dryRun && opts.outputPath) {
    const abs = path.isAbsolute(opts.outputPath)
      ? opts.outputPath
      : path.resolve(process.cwd(), opts.outputPath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, JSON.stringify(result, null, 2), "utf8");
  }

  return result;
}

export * from "./types";
export { dedupe, foldKey } from "./dedup";
export { assertNoPersonPii } from "./pii";
export { fetchWithRetry, createRateLimiter } from "./http";
