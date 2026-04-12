import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { fetchWithRetry } from "../lib/http.js";
import { normalizeZip } from "../lib/address.js";
import { buildHoursFromSchedule } from "../lib/hours.js";
import type { ImportOptions, NormalizedResourceRecord } from "../types.js";

const execFileAsync = promisify(execFile);

export interface CfcParseDiagnostics {
  headerCount: number;
  parsedCount: number;
  skippedCount: number;
}

export interface CfcParseResult {
  records: NormalizedResourceRecord[];
  diagnostics: CfcParseDiagnostics;
}

export const cfcActiveSourceUrl = 'https://www.nyc.gov/assets/hra/downloads/pdf/services/efap/CFC_ACTIVE.pdf';

const pantryCodes = new Set(["FP", "FPH", "FPK", "FPM", "FPV"]);
const kitchenCodes = new Set(["SK", "SKK", "SKM"]);
const supportedTypeCodePattern = "FPH|FPK|FPM|FPV|FP|SKK|SKM|SK";
const headerStartRegex = new RegExp(`^\\d{5}\\s+(${supportedTypeCodePattern})\\b`);
const headerCaptureRegex = new RegExp(`^(\\d{5})\\s+(${supportedTypeCodePattern})\\b(?:\\s+(.*))?$`);
const recordIdRegex = /^\d{5}$/;
const typeOnlyRegex = new RegExp(`^(${supportedTypeCodePattern})$`);
const boroughCodeRegex = /^(BK|BX|LI|MN|NY|QN|SI)$/i;
const footerNoiseRegexes = [
  /^FP - \d+$/i,
  /^FP = \d+$/i,
  /^SK - \d+$/i,
  /^SK = \d+$/i,
  /^Page \d+ of \d+$/i,
  /^CFC \(ACTIVE\) PROG.*info as of /i,
  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
  /^\(info by boro in alpha order\)$/i,
  /^(ID|TYPE|PROGRAM|ORG PHONE|DISTADD|DISTBORO|DISTZIP|DAYS|HOURS)$/i
] as const;
const phoneRegex = /(?:\(\d{3}\)|\d{3})[-\s]*\d{3}[-\s]*\d{4}(?:\s*\(\d+\))?/;
const minimumLiveParseRatio = 0.98;
const maximumLiveSkippedRecords = 12;

function mapType(code: string): NormalizedResourceRecord["type"] {
  if (kitchenCodes.has(code)) {
    return "kitchen";
  }
  if (pantryCodes.has(code)) {
    return "pantry";
  }
  return "other";
}

function parseCfcText(content: string): CfcParseResult {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const recordStartIndexes = lines.reduce<number[]>((indexes, line, index) => {
    const nextLine = lines[index + 1] ?? "";
    if (headerStartRegex.test(line) || (recordIdRegex.test(line) && typeOnlyRegex.test(nextLine))) {
      indexes.push(index);
    }
    return indexes;
  }, []);

  const records: NormalizedResourceRecord[] = [];
  for (let index = 0; index < recordStartIndexes.length; index += 1) {
    const start = recordStartIndexes[index]!;
    const end = recordStartIndexes[index + 1] ?? lines.length;
    const record = parseRecordBlock(lines.slice(start, end));
    if (record) {
      records.push(record);
    }
  }

  return {
    records,
    diagnostics: {
      headerCount: recordStartIndexes.length,
      parsedCount: records.length,
      skippedCount: recordStartIndexes.length - records.length
    }
  };
}

export function parseRecordBlock(block: string[]): NormalizedResourceRecord | null {
  const cleanedBlock = block.filter((line) => !isNoiseLine(line));
  const header = cleanedBlock[0] ?? "";
  const headerMatch = header.match(headerCaptureRegex);
  if (headerMatch) {
    return parseCombinedRecordBlock(cleanedBlock, headerMatch);
  }

  if (recordIdRegex.test(header) && typeOnlyRegex.test(cleanedBlock[1] ?? "")) {
    return parseSplitRecordBlock(cleanedBlock);
  }

  return null;
}

function parseCombinedRecordBlock(
  cleanedBlock: string[],
  headerMatch: RegExpMatchArray,
): NormalizedResourceRecord | null {
  const [, id, rawType = "FP", headerName = ""] = headerMatch;
  const contentLines = cleanedBlock.slice(1);
  const zipLineIndex = contentLines.findIndex((line) => extractZipAndDays(line) !== null);
  if (zipLineIndex < 0) {
    return null;
  }

  const zipAndDays = extractZipAndDays(contentLines[zipLineIndex] ?? "");
  if (!zipAndDays) {
    return null;
  }

  const hoursLine = looksLikeHoursLine(contentLines[zipLineIndex + 1] ?? "") ? contentLines[zipLineIndex + 1] ?? "" : "";
  const trailingLines = contentLines.slice(zipLineIndex + (hoursLine ? 2 : 1));
  const preZipLines = contentLines.slice(0, zipLineIndex);
  const nameParts = normalizeTextParts([headerName]);
  const addressParts: string[] = [];
  let phone: string | null = null;

  for (const line of preZipLines) {
    const extracted = splitPhoneAndText(line);
    if (extracted.phone && !phone) {
      phone = extracted.phone;
    }

    if (extracted.leadingText) {
      pushTextPart(extracted.leadingText, nameParts, addressParts, {
        preferAddress: Boolean(phone) || nameParts.length > 0 || addressParts.length > 0
      });
    }

    if (extracted.trailingText) {
      addressParts.push(extracted.trailingText);
      continue;
    }

    if (!extracted.phone && !extracted.leadingText) {
      pushTextPart(line, nameParts, addressParts, {
        preferAddress: Boolean(phone) || nameParts.length > 0 || addressParts.length > 0
      });
    }
  }

  if (zipAndDays.leadingAddress) {
    addressParts.push(zipAndDays.leadingAddress);
  }

  for (const line of trailingLines) {
    if (headerStartRegex.test(line) || extractZipAndDays(line) || looksLikeHoursLine(line)) {
      continue;
    }

    const extracted = splitPhoneAndText(line);
    if (extracted.phone && !phone) {
      phone = extracted.phone;
    }

    const fallbackText = extracted.leadingText ?? extracted.trailingText ?? (!extracted.phone ? line : null);
    if (!fallbackText) {
      continue;
    }

    if (nameParts.length === 0 && !looksLikeAddressLine(fallbackText)) {
      nameParts.push(fallbackText);
      continue;
    }

    if (addressParts.length === 0 && looksLikeAddressLine(fallbackText)) {
      addressParts.push(fallbackText);
    }
  }

  const zip = zipAndDays.zip;
  const days = zipAndDays.days;
  const name = normalizeNullable(nameParts.join(" "));
  const addressText = normalizeNullable(toTitleCase(addressParts.join(" ")));

  if (!zip || !name || !addressText) {
    return null;
  }

  return buildRecord({
    source: "cfc_active",
    sourceRef: `cfc_active:${id}`,
    name,
    type: mapType(rawType),
    addressText,
    city: inferCityFromRegion(zipAndDays.boroughCode, zip),
    state: "NY",
    zip: normalizeZip(zip),
    phone,
    hoursJson: buildHoursFromSchedule(days, hoursLine),
    languages: [],
    eligibilityNotes: "Official CFC Active listing. Call ahead to confirm hours.",
    lat: null,
    lng: null,
    geoPrecision: "unknown",
    sourceUrl: cfcActiveSourceUrl
  });
}

function parseSplitRecordBlock(cleanedBlock: string[]): NormalizedResourceRecord | null {
  const id = cleanedBlock[0] ?? "";
  const rawType = cleanedBlock[1] ?? "FP";
  const contentLines = cleanedBlock.slice(2);

  let cursor = contentLines.length;
  let hoursLine = "";
  if (looksLikeHoursLine(contentLines[cursor - 1] ?? "")) {
    hoursLine = contentLines[cursor - 1] ?? "";
    cursor -= 1;
  }

  const days = normalizeNullable(contentLines[cursor - 1] ?? "");
  if (!days || !looksLikeDayDescriptor(days)) {
    return null;
  }
  cursor -= 1;

  const zipLine = contentLines[cursor - 1] ?? "";
  if (!recordIdRegex.test(zipLine)) {
    return null;
  }
  const zip = normalizeZip(zipLine);
  cursor -= 1;

  let boroughCode: string | null = null;
  const boroughLine = contentLines[cursor - 1] ?? "";
  if (boroughCodeRegex.test(boroughLine)) {
    boroughCode = boroughLine.toUpperCase();
    cursor -= 1;
  }

  const beforeRegionLines = contentLines.slice(0, cursor);
  const phoneIndex = beforeRegionLines.findIndex((line) => phoneRegex.test(line) || isNoPhoneMarker(line));
  if (phoneIndex < 0) {
    return null;
  }

  const nameParts = normalizeTextParts(beforeRegionLines.slice(0, phoneIndex));
  const phoneLine = beforeRegionLines[phoneIndex] ?? "";
  const extractedPhone = splitPhoneAndText(phoneLine);
  const phone = extractedPhone.phone;
  if (extractedPhone.leadingText) {
    nameParts.push(extractedPhone.leadingText);
  }

  const addressParts = normalizeTextParts([
    extractedPhone.trailingText,
    ...beforeRegionLines.slice(phoneIndex + 1),
  ]).map((value) => toTitleCase(stripNoPhoneMarker(value)));

  const name = normalizeNullable(nameParts.join(" "));
  const addressText = normalizeNullable(addressParts.join(" "));
  if (!name || !addressText) {
    return null;
  }

  return buildRecord({
    source: "cfc_active",
    sourceRef: `cfc_active:${id}`,
    name,
    type: mapType(rawType),
    addressText,
    city: inferCityFromRegion(boroughCode, zip),
    state: "NY",
    zip,
    phone,
    hoursJson: buildHoursFromSchedule(days, hoursLine),
    languages: [],
    eligibilityNotes: "Official CFC Active listing. Call ahead to confirm hours.",
    lat: null,
    lng: null,
    geoPrecision: "unknown",
    sourceUrl: cfcActiveSourceUrl,
  });
}

function buildRecord(record: NormalizedResourceRecord) {
  return record;
}

function normalizeNullable(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeTextParts(values: Array<string | null | undefined>) {
  return values
    .map((value) => normalizeNullable(value ?? null))
    .filter((value): value is string => Boolean(value));
}

function inferCityFromRegion(boroughCode: string | null, zip: string): string | null {
  if (zip === "11735") {
    return "Farmingdale";
  }

  if (!boroughCode) {
    return null;
  }

  const boroughNames: Record<string, string> = {
    BK: "Brooklyn",
    BX: "Bronx",
    LI: "Long Island",
    MN: "Manhattan",
    NY: "Manhattan",
    QN: "Queens",
    SI: "Staten Island"
  };

  return boroughNames[boroughCode] ?? null;
}

function isNoiseLine(line: string) {
  return footerNoiseRegexes.some((regex) => regex.test(line));
}

function looksLikeHoursLine(line: string) {
  return /\b\d{1,2}(?::\d{1,2})?\s*(?:AM|PM|A|P)\b/i.test(line);
}

function looksLikeAddressLine(line: string) {
  return (
    /\d/.test(line) ||
    /\b(SUITE|STE|APT|FLOOR|UNIT|@)\b/i.test(line)
  );
}

function pushTextPart(
  line: string,
  nameParts: string[],
  addressParts: string[],
  options: {
    preferAddress: boolean;
  }
) {
  if (
    (options.preferAddress && looksLikeAddressLine(line)) ||
    (addressParts.length > 0 && /^(STREET|ROAD|AVENUE|BLVD|PLACE|DRIVE|COURT|LANE|SUITE|FLOOR|UNIT)$/i.test(line))
  ) {
    addressParts.push(stripNoPhoneMarker(line));
    return;
  }

  nameParts.push(line);
}

function splitPhoneAndText(line: string): {
  phone: string | null;
  leadingText: string | null;
  trailingText: string | null;
} {
  const noPhoneLine = stripNoPhoneMarker(line);
  if (noPhoneLine !== line) {
    return {
      phone: null,
      leadingText: null,
      trailingText: normalizeNullable(noPhoneLine)
    };
  }

  const match = line.match(phoneRegex);
  if (!match || match.index === undefined) {
    return {
      phone: null,
      leadingText: null,
      trailingText: null
    };
  }

  return {
    phone: normalizeNullable(match[0]),
    leadingText: normalizeNullable(line.slice(0, match.index)),
    trailingText: normalizeNullable(line.slice(match.index + match[0].length))
  };
}

function stripNoPhoneMarker(line: string) {
  return line.replace(/^NONE PROV(?:IDED|ED)\s*/i, "").trim();
}

function isNoPhoneMarker(line: string) {
  return stripNoPhoneMarker(line) !== line;
}

function extractZipAndDays(line: string): {
  leadingAddress: string | null;
  boroughCode: string | null;
  zip: string;
  days: string;
} | null {
  const boroughMatch = line.match(/^(.*?)(?:\b(BK|BX|LI|MN|NY|QN|SI)\s+)(\d{5})(?:\s+(.+))?$/i);
  if (boroughMatch && looksLikeDayDescriptor(boroughMatch[4] ?? "")) {
    return {
      leadingAddress: normalizeNullable(stripNoPhoneMarker(boroughMatch[1] ?? "")),
      boroughCode: (boroughMatch[2] ?? "").toUpperCase() || null,
      zip: boroughMatch[3]!,
      days: normalizeNullable(boroughMatch[4] ?? "") ?? ""
    };
  }

  const zipOnlyMatch = line.match(/^(\d{5})(?:\s+(.+))?$/);
  if (!zipOnlyMatch || !looksLikeDayDescriptor(zipOnlyMatch[2] ?? "")) {
    return null;
  }

  return {
    leadingAddress: null,
    boroughCode: null,
    zip: zipOnlyMatch[1]!,
    days: normalizeNullable(zipOnlyMatch[2] ?? "") ?? ""
  };
}

function looksLikeDayDescriptor(value: string) {
  if (!value) {
    return false;
  }

  const compact = value.replace(/\s+/g, "");
  return (
    /\b(MON|TUE|TUES|WED|THU|THUR|THURS|FRI|SAT|SUN|DAILY)(?:\b|[0-9(,-])/i.test(value) ||
    /^(?:M|T|W|TH|F|SAT|SUN)(?:[-,/](?:M|T|W|TH|F|SAT|SUN))+$/i.test(compact)
  );
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "weavenyc-cfc-"));
  const pdfPath = join(tempDir, "cfc-active.pdf");

  try {
    await writeFile(pdfPath, buffer);
    const binary = process.env.PDFTOTEXT_BINARY ?? "pdftotext";
    const { stdout } = await execFileAsync(binary, [pdfPath, "-"]);
    return stdout;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function downloadPdfBuffer(fetchImpl: typeof fetch = fetch): Promise<Buffer> {
  const headers = {
    accept: "application/pdf",
    "user-agent": "Mozilla/5.0 WeaveNYC/0.1"
  };

  try {
    const response =
      fetchImpl === fetch
        ? await fetchWithRetry(cfcActiveSourceUrl, { headers })
        : await fetchImpl(cfcActiveSourceUrl, { headers });

    if (!response.ok) {
      throw new Error(`Failed to download CFC Active PDF: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const { stdout } = await execFileAsync(
      "curl",
      ["-fsSL", "-A", "Mozilla/5.0 WeaveNYC/0.1", cfcActiveSourceUrl],
      {
        encoding: "buffer",
        maxBuffer: 20 * 1024 * 1024
      }
    );

    if (Buffer.isBuffer(stdout)) {
      return stdout;
    }

    if (typeof stdout === "string") {
      return Buffer.from(stdout);
    }

    throw error instanceof Error ? error : new Error("Failed to download CFC Active PDF");
  }
}

async function loadLiveText(fetchImpl: typeof fetch = fetch): Promise<string> {
  const buffer = await downloadPdfBuffer(fetchImpl);
  return pdfToText(buffer);
}

export async function loadCfcActiveRecords(
  options: ImportOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<NormalizedResourceRecord[]> {
  const parsed = await inspectCfcActiveRecords(options, fetchImpl);
  if ((options.mode ?? "live") === "live") {
    assertCfcCompleteness(parsed);
  }
  return parsed.records;
}

export async function inspectCfcActiveRecords(
  options: ImportOptions = {},
  fetchImpl: typeof fetch = fetch
): Promise<CfcParseResult> {
  const mode = options.mode ?? "live";
  const content =
    mode === "fixture" ? await loadCfcActiveFixtureText() : await loadLiveText(fetchImpl);
  return parseCfcText(content);
}

export function assertCfcCompleteness(result: CfcParseResult): void {
  if (result.diagnostics.headerCount === 0) {
    throw new Error("CFC Active parser found zero record headers");
  }

  const parseRatio = result.diagnostics.parsedCount / result.diagnostics.headerCount;
  if (
    result.diagnostics.skippedCount > maximumLiveSkippedRecords ||
    parseRatio < minimumLiveParseRatio
  ) {
    throw new Error(
      `CFC Active parse completeness below threshold: parsed=${result.diagnostics.parsedCount} headers=${result.diagnostics.headerCount} skipped=${result.diagnostics.skippedCount}`
    );
  }
}

export async function loadCfcActiveFixtureText(): Promise<string> {
  return readFile(new URL("../fixtures/cfc-active.txt", import.meta.url), "utf8");
}
