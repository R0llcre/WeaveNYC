import { createHash } from "node:crypto";

import type { ResourceProviderSeed } from "./types";

const PUNCTUATION_REGEX = /[\p{P}\p{S}]+/gu;
const WHITESPACE_REGEX = /\s+/g;

function stripPunct(value: string): string {
  return value.replace(PUNCTUATION_REGEX, "").replace(WHITESPACE_REGEX, " ").trim();
}

function digitsOnly(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D+/g, "");
}

/**
 * Deterministic fold key used to collapse near-duplicates across sources
 * (for example a Corona pantry that appears in both Food Help NYC and the
 * HRSA FQHC extract). We intentionally keep the key loose — lowercase name
 * minus punctuation, 5-digit zip, phone digits — so the same storefront under
 * different official labels still collides.
 */
export function foldKey(row: ResourceProviderSeed): string {
  const name = stripPunct(row.name.toLowerCase());
  const zip = (row.zip ?? "").slice(0, 5);
  const phone = digitsOnly(row.phone);
  const payload = `${name}|${zip}|${phone}`;
  return createHash("sha256").update(payload).digest("hex");
}

export interface DedupeOptions {
  /**
   * Source ids whose rows are "hand-curated" and MUST win on conflict. Mostly
   * relevant when the public-ingest output is merged with `seed/fixtures.ts`
   * rows inside the seed runner — a fixture row flagged with a reserved
   * source id (e.g. `cfc_active`) always takes precedence over a public feed.
   */
  curatedSources?: string[];
}

const DEFAULT_CURATED_SOURCES = new Set<string>(["cfc_active", "manual_official"]);

/**
 * Returns a stable-ordered, deduplicated slice of the input where every
 * conflict is resolved as follows:
 *  1. Curated-source rows always win over public-source rows.
 *  2. Among public-source rows, the first occurrence wins (preserves the
 *     orchestrator's include-order so class-day demos are reproducible).
 *
 * Never mutates the input; callers rely on deterministic output for snapshot
 * mode, so the implementation avoids Set-based iteration where insertion
 * order matters.
 */
export function dedupe(
  rows: ResourceProviderSeed[],
  opts: DedupeOptions = {}
): ResourceProviderSeed[] {
  const curated = new Set<string>([
    ...DEFAULT_CURATED_SOURCES,
    ...(opts.curatedSources ?? []),
  ]);
  const seen = new Map<string, ResourceProviderSeed>();

  for (const row of rows) {
    const key = foldKey(row);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, row);
      continue;
    }
    const existingIsCurated = curated.has(existing.source);
    const incomingIsCurated = curated.has(row.source);
    if (incomingIsCurated && !existingIsCurated) {
      seen.set(key, row);
    }
    // else keep `existing` — either both curated (first wins) or incoming is
    // public and existing is curated (curated wins) or both public (first wins).
  }

  return Array.from(seen.values());
}
