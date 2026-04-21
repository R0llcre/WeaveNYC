import type { ResourceProviderSeed } from "./types";

/**
 * Heuristic person-name denylist. Any normalized row whose `name` or
 * `eligibilityNotes` exposes a pattern like "John Smith" or "Contact: Maria"
 * is rejected — public-data sources are *organization* directories; a
 * person-name slipping through means upstream labelled a home address or
 * case-manager contact, which we MUST NOT ingest for a classroom demo. Errs
 * on the side of over-rejecting; legitimate org names ("St. John's Pantry",
 * "Our Lady of Sorrows") are whitelisted by virtue of the leading honorific
 * or possessive.
 */
const ORG_NAME_WHITELIST_PATTERNS: RegExp[] = [
  /\bst\.?\s+/i,
  /\bsaint\s+/i,
  /\bour\s+lady\b/i,
  /\bfather\s+/i,
  /\bsister\s+/i,
  /\bmother\s+/i,
  /\brabbi\s+/i,
  /\bimam\s+/i,
  /\bpastor\s+/i,
  /\breverend\s+/i,
  /\b\w+['']s\s+/i,
];

const PERSON_NAME_DENYLIST: RegExp[] = [
  /\bcontact\s*[:\-]?\s*[A-Z][a-z]+\s+[A-Z][a-z]+\b/i,
  /\bcall\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/i,
  /\bask\s+for\s+[A-Z][a-z]+\b/i,
  /\battn\s*[:\.]?\s*[A-Z][a-z]+\s+[A-Z][a-z]+\b/i,
];

const PII_EMAIL_DENYLIST: RegExp[] = [
  /[a-z0-9._%+-]+@(?:gmail|yahoo|hotmail|outlook|icloud|aol|protonmail)\.(?:com|net|org)/i,
];

function looksLikeOrgName(value: string): boolean {
  return ORG_NAME_WHITELIST_PATTERNS.some((pattern) => pattern.test(value));
}

function detectPersonName(value: string): string | null {
  if (looksLikeOrgName(value)) {
    return null;
  }
  for (const pattern of PERSON_NAME_DENYLIST) {
    const match = value.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

function detectPersonalEmail(value: string): string | null {
  for (const pattern of PII_EMAIL_DENYLIST) {
    const match = value.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Throws `Error` with a descriptive message when a person-PII hit is detected.
 * Callers should catch and skip the row (or fail the ingest if configured to
 * be strict). Safe to call many times per row; it inspects only the fields
 * where upstream providers have historically leaked case-manager contacts.
 */
export function assertNoPersonPii(row: ResourceProviderSeed): void {
  const inspectionTargets: Array<[string, string | null | undefined]> = [
    ["name", row.name],
    ["eligibilityNotes", row.eligibilityNotes],
    ["addressText", row.addressText],
  ];

  for (const [field, raw] of inspectionTargets) {
    if (!raw) continue;
    const value = String(raw);
    const nameHit = detectPersonName(value);
    if (nameHit) {
      throw new Error(
        `PII check failed on ${row.source}:${row.sourceRef} (${field}): person name pattern "${nameHit}"`
      );
    }
    const emailHit = detectPersonalEmail(value);
    if (emailHit) {
      throw new Error(
        `PII check failed on ${row.source}:${row.sourceRef} (${field}): personal email "${emailHit}"`
      );
    }
  }
}
