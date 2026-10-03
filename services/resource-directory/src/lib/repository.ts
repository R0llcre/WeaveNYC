import { randomUUID } from 'node:crypto';

import { Pool, type PoolClient } from 'pg';

import { createContentHash, normalizeAddressKey } from "./address.js";
import { mergeHours, isOpenNow, isOpenToday, toWeeklyHours } from "./hours.js";
import type {
  DatasetImportSummary,
  HoursRecord,
  NormalizedResourceRecord,
  ResourceListItem,
  ResourceSearchInput,
  ResourceSearchResult,
  ResourceSource
} from "../types.js";

/**
 * Thrown when ResourceImportRepository.importDataset refuses to wipe-and-
 * replace because the new batch is implausibly small relative to the
 * previously imported batch. See A5 P0.2: a partial fetch (50 records vs
 * usual 500) used to silently mark 90% of a source inactive. The CLI
 * `--force` flag bypasses this guard for legitimate shrinks.
 */
export class ImportCompletenessError extends Error {
  constructor(
    public readonly source: ResourceSource,
    public readonly incomingCount: number,
    public readonly previousCount: number,
    public readonly thresholdFraction: number,
  ) {
    super(
      `Refusing to import ${incomingCount} records for source ${source}: ` +
        `that is less than ${Math.round(thresholdFraction * 100)}% of the previous ` +
        `${previousCount} active rows. Pass { force: true } or --force to override.`,
    );
    this.name = 'ImportCompletenessError';
  }
}

export interface ImportDatasetOptions {
  /**
   * Incoming batches with fewer than `minRecordFraction * previousActiveCount`
   * records are refused. Default: 0.5 (i.e. a new batch must retain at least
   * half of the previous batch's size). Ignored when `previousActiveCount`
   * is zero (first import ever).
   */
  minRecordFraction?: number;
  /**
   * Bypass the completeness guard. Set by CLI `--force` for legitimate
   * shrinks (e.g. a source genuinely went from 500 pantries to 10).
   */
  force?: boolean;
}

const DEFAULT_MIN_RECORD_FRACTION = 0.5;

export class ResourceImportRepository {
  constructor(private readonly pool: Pool) {}

  async close(): Promise<void> {
    await this.pool.end();
  }

  async importDataset(
    input: {
      source: ResourceSource;
      sourceLabel: string;
      sourceUrl: string;
      datasetVersion: string;
      records: NormalizedResourceRecord[];
    },
    options: ImportDatasetOptions = {},
  ): Promise<DatasetImportSummary> {
    const minRecordFraction = options.minRecordFraction ?? DEFAULT_MIN_RECORD_FRACTION;
    const force = options.force ?? false;
    // The pilot seed also uses source='cfc_active' for hand-curated entries
    // with slug IDs. The official PDF only owns five-digit CFC IDs. Never
    // deactivate or count the curated entries during a PDF refresh.
    const managedRefPattern = input.source === 'cfc_active' ? '^cfc_active:[0-9]{5}$' : null;
    if (
      managedRefPattern &&
      input.records.some((record) => !/^cfc_active:[0-9]{5}$/.test(record.sourceRef))
    ) {
      throw new Error('CFC import contains a non-official source reference');
    }

    // A5 P0.2 — completeness guard. We run the count OUTSIDE the import
    // transaction on purpose: we want to fail BEFORE we wipe the source,
    // and we want the count to reflect the current state regardless of
    // any in-flight write.
    const previousCountResult = await this.pool.query<{ count: string | number }>(
      `
        select count(*)::int as count
        from resource_providers
        where source = $1
          and status = 'active'
          and ($2::text is null or source_ref ~ $2)
      `,
      [input.source, managedRefPattern],
    );
    const previousActiveCount = Number(previousCountResult.rows[0]?.count ?? 0);
    const incomingCount = input.records.length;

    if (
      !force &&
      previousActiveCount > 0 &&
      incomingCount < Math.ceil(previousActiveCount * minRecordFraction)
    ) {
      throw new ImportCompletenessError(
        input.source,
        incomingCount,
        previousActiveCount,
        minRecordFraction,
      );
    }

    const client = await this.pool.connect();

    try {
      await client.query('begin');

      await client.query(
        `
          update dataset_versions
          set status = 'superseded',
              updated_at = now()
          where source = $1
            and status = 'active'
            and dataset_version <> $2
            and source_url = $3
        `,
        [input.source, input.datasetVersion, input.sourceUrl]
      );

      await client.query(
        `
          insert into dataset_versions (
            dataset_version_id,
            source,
            dataset_version,
            source_label,
            source_url,
            record_count,
            active_record_count,
            status,
            checksum,
            import_started_at,
            import_completed_at,
            created_at,
            updated_at
          )
          values ($1, $2, $3, $4, $5, $6, 0, 'importing', null, now(), null, now(), now())
          on conflict (source, dataset_version) do update
            set source_label = excluded.source_label,
                source_url = excluded.source_url,
                record_count = excluded.record_count,
                updated_at = now()
        `,
        [
          randomUUID(),
          input.source,
          input.datasetVersion,
          input.sourceLabel,
          input.sourceUrl,
          input.records.length
        ]
      );

      const existingRows = await client.query<{
        provider_id: string;
        source_ref: string;
        content_hash: string | null;
      }>(
        `
          select provider_id, source_ref, content_hash
          from resource_providers
          where source = $1
            and status = 'active'
            and ($2::text is null or source_ref ~ $2)
        `,
        [input.source, managedRefPattern]
      );

      const previousByRef = new Map<string, {
        provider_id: string;
        source_ref: string;
        content_hash: string | null;
      }>(existingRows.rows.map((row) => [row.source_ref, row]));

      await client.query(
        `
          update resource_providers
          set status = 'inactive',
              updated_at = now()
          where source = $1
            and status = 'active'
            and ($2::text is null or source_ref ~ $2)
        `,
        [input.source, managedRefPattern]
      );

      let added = 0;
      let updated = 0;

      for (const record of input.records) {
        const contentHash = createContentHash(record);
        const existing = previousByRef.get(record.sourceRef);
        const providerId = existing?.provider_id ?? randomUUID();
        const changedFields = existing?.content_hash === contentHash ? [] : ['name', 'address_text', 'phone', 'hours_json'];
        const changeType = !existing ? 'added' : existing.content_hash === contentHash ? null : 'updated';

        await client.query(
          `
            insert into resource_providers (
              provider_id,
              source,
              source_ref,
              name,
              type,
              address_text,
              city,
              state,
              zip,
              phone,
              hours_json,
              languages,
              eligibility_notes,
              lat,
              lng,
              geo_precision,
              content_hash,
              dataset_version,
              status,
              last_seen_at,
              created_at,
              updated_at
            )
            values (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
              $11::jsonb, $12, $13, $14, $15, $16, $17, $18,
              'active', now(), now(), now()
            )
            on conflict (provider_id) do update
              set name = excluded.name,
                  source = excluded.source,
                  source_ref = excluded.source_ref,
                  type = excluded.type,
                  address_text = excluded.address_text,
                  city = excluded.city,
                  state = excluded.state,
                  zip = excluded.zip,
                  phone = excluded.phone,
                  hours_json = excluded.hours_json,
                  languages = excluded.languages,
                  eligibility_notes = excluded.eligibility_notes,
                  lat = excluded.lat,
                  lng = excluded.lng,
                  geo_precision = excluded.geo_precision,
                  content_hash = excluded.content_hash,
                  dataset_version = excluded.dataset_version,
                  status = 'active',
                  last_seen_at = now(),
                  updated_at = now()
          `,
          [
            providerId,
            record.source,
            record.sourceRef,
            record.name,
            record.type,
            record.addressText,
            record.city,
            record.state,
            record.zip,
            record.phone,
            JSON.stringify(record.hoursJson ?? {}),
            record.languages,
            record.eligibilityNotes,
            record.lat,
            record.lng,
            record.geoPrecision,
            contentHash,
            input.datasetVersion
          ]
        );

        if (!existing) {
          added += 1;
        } else if (existing.content_hash !== contentHash) {
          updated += 1;
        }

        if (changeType) {
          await this.insertChangeLog(client, {
            source: record.source,
            sourceRef: record.sourceRef,
            datasetVersion: input.datasetVersion,
            changeType,
            changedFields,
            contentHashBefore: existing?.content_hash ?? null,
            contentHashAfter: contentHash
          });
        }

        previousByRef.delete(record.sourceRef);
      }

      const removed = previousByRef.size;
      for (const [sourceRef, previous] of previousByRef.entries()) {
        await this.insertChangeLog(client, {
          source: input.source,
          sourceRef,
          datasetVersion: input.datasetVersion,
          changeType: 'removed',
          changedFields: ['status'],
          contentHashBefore: previous.content_hash,
          contentHashAfter: null
        });
      }

      await client.query(
        `
          update dataset_versions
          set status = 'active',
              active_record_count = $3,
              import_completed_at = now(),
              updated_at = now()
          where source = $1
            and dataset_version = $2
        `,
        [input.source, input.datasetVersion, input.records.length]
      );

      await client.query('commit');

      return {
        datasetVersion: input.datasetVersion,
        source: input.source,
        sourceUrl: input.sourceUrl,
        recordCount: input.records.length,
        activeRecordCount: input.records.length,
        added,
        updated,
        removed
      };
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  private async insertChangeLog(
    client: PoolClient,
    input: {
      source: string;
      sourceRef: string;
      datasetVersion: string;
      changeType: string;
      changedFields: string[];
      contentHashBefore: string | null;
      contentHashAfter: string | null;
    }
  ) {
    await client.query(
      `
        insert into resource_change_logs (
          change_log_id,
          source,
          source_ref,
          dataset_version,
          change_type,
          changed_fields,
          content_hash_before,
          content_hash_after,
          created_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, now())
      `,
      [
        randomUUID(),
        input.source,
        input.sourceRef,
        input.datasetVersion,
        input.changeType,
        input.changedFields,
        input.contentHashBefore,
        input.contentHashAfter
      ]
    );
  }
}

type ResourceRow = {
  provider_id: string;
  source: string;
  source_ref: string;
  name: string;
  type: ResourceListItem["type"];
  address_text: string;
  city: string | null;
  state: string | null;
  zip: string;
  phone: string | null;
  hours_json: Record<string, string | null> | null;
  languages: string[] | null;
  eligibility_notes: string | null;
  lat: number | null;
  lng: number | null;
  geo_precision: ResourceListItem["geoPrecision"];
  dataset_version: string;
  source_label: string | null;
  source_url: string | null;
};

type MergedResourceItem = ResourceListItem & {
  providerIds: string[];
};

export class ResourceQueryRepository {
  /**
   * V2-A — progressive radius tiers. We used to hard-code 10 miles, which
   * meant a user in a ZIP without a committed provider within 10mi got a
   * blank list even if a pantry sat 12mi away. The new flow walks these
   * tiers and stops at the smallest one with ≥3 results (or the last tier,
   * whichever comes first). `widenedToMiles` in the response tells the PWA
   * which tier was used so it can render a banner when > 5mi.
   */
  private static readonly SEARCH_RADIUS_TIERS = [5, 10, 25, 100] as const;
  private static readonly WIDEN_MIN_RESULTS = 3;

  constructor(private readonly pool: Pool) {}

  async searchResources(
    input: ResourceSearchInput,
    zipCenter: { lat: number | null; lng: number | null }
  ): Promise<ResourceSearchResult> {
    // A5 P0.3 — push ZIP-prefix + type filters into SQL so we don't drag
    // every active row across the wire on every public request. The
    // haversine radius still runs in JS (needs geocoded lat/lng, and the
    // pg stack is only guaranteed to ship PostGIS in the m0 migration
    // — we don't lean on it in the query path). Pruning by `left(zip, 3)`
    // is a ~10-mile urban-NYC proxy that keeps the JS step cheap and
    // lines up with idx_resources_zip3_type_status (migration 0015).
    //
    // V2-A note — we KEEP the zip3 prune even for the 25mi/100mi tiers.
    // A NYC 3-digit prefix spans most of a borough (10-15mi across), and
    // at pilot scale losing a pantry 20mi away in a different prefix is
    // fine — the widening loop below still helps the common case (user
    // in a data-sparse ZIP, adjacent ZIPs have rows).
    const tiers = ResourceQueryRepository.SEARCH_RADIUS_TIERS;
    const rows = await this.fetchActiveRows({
      zipPrefix: input.zip.slice(0, 3),
      type: input.type ?? null,
    });
    const merged = this.mergeRows(rows, zipCenter);

    const passesNonRadiusFilters = (item: MergedResourceItem, matchesZip: boolean) => {
      if (input.type && item.type !== input.type) {
        return false;
      }
      if (input.today && !item.isOpenToday) {
        return false;
      }
      if (input.openNow && !item.isOpenNow) {
        return false;
      }
      // Mirror the legacy `matchesZip || withinRadius` shape so rows in the
      // exact ZIP always pass, even when we have no center to distance-check
      // against (the zero-geocode case).
      if (!matchesZip && (item.distanceMiles === null || zipCenter.lat === null || zipCenter.lng === null)) {
        return false;
      }
      return true;
    };

    const sortResults = (list: MergedResourceItem[]) =>
      list.sort((left, right) => {
        if (left.isOpenNow !== right.isOpenNow) {
          return left.isOpenNow ? -1 : 1;
        }

        if (left.distanceMiles !== null && right.distanceMiles !== null) {
          if (left.distanceMiles !== right.distanceMiles) {
            return left.distanceMiles - right.distanceMiles;
          }
        } else if (left.distanceMiles !== null) {
          return -1;
        } else if (right.distanceMiles !== null) {
          return 1;
        }

        return left.name.localeCompare(right.name);
      });

    let filtered: MergedResourceItem[] = [];
    let widenedToMiles: number | null = null;

    // V2-A radius-widening loop. Try 5mi first — if we get ≥3 results the
    // UX is unchanged. If not, widen progressively. `widenedToMiles` is
    // set even when we land on the first tier so callers can audit what
    // radius produced the response.
    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx += 1) {
      const radius = tiers[tierIdx]!;
      const tierMatches = merged.filter((item) => {
        const matchesZip = item.zip === input.zip;
        const withinRadius =
          item.distanceMiles !== null && item.distanceMiles <= radius;
        if (!matchesZip && !withinRadius) {
          return false;
        }
        return passesNonRadiusFilters(item, matchesZip);
      });

      if (
        tierMatches.length >= ResourceQueryRepository.WIDEN_MIN_RESULTS ||
        tierIdx === tiers.length - 1
      ) {
        filtered = tierMatches;
        widenedToMiles = radius;
        break;
      }
    }

    sortResults(filtered);

    const limit = input.limit ?? 20;
    const offset = decodeCursor(input.cursor);
    const items = filtered.slice(offset, offset + limit);
    const nextCursor = offset + limit < filtered.length ? encodeCursor(offset + limit) : null;

    return {
      items,
      nextCursor,
      sourceMode: "api",
      // If the caller had no geocoded center we ran zip-exact-match only;
      // surface `widenedToMiles: null` to signal the radius walk was a no-op.
      widenedToMiles:
        zipCenter.lat === null || zipCenter.lng === null ? null : widenedToMiles,
    };
  }

  async getResourceDetail(providerId: string, zipCenter?: {
    lat: number | null;
    lng: number | null;
  }): Promise<ResourceListItem | null> {
    // Detail lookups are keyed on providerId (or its alias through the
    // address-group merge). Without a ZIP hint we fall back to the
    // original "fetch all active" behavior — but the primary lookup
    // prunes by the detail row's ZIP first so we don't scan for every
    // call from the PWA's detail drawer.
    const detailRow = await this.pool.query<Pick<ResourceRow, "zip">>(
      `
        select zip from resource_providers
        where provider_id = $1
          and status = 'active'
        limit 1
      `,
      [providerId],
    );
    const detailZip = detailRow.rows[0]?.zip ?? null;
    const rows = detailZip
      ? await this.fetchActiveRows({ zipPrefix: detailZip.slice(0, 3), type: null })
      : await this.fetchActiveRows({ zipPrefix: null, type: null });
    const merged = this.mergeRows(rows, zipCenter ?? { lat: null, lng: null });
    const item = merged.find(
      (entry) => entry.providerId === providerId || entry.providerIds.includes(providerId)
    );
    if (!item) {
      return null;
    }

    return item.providerId === providerId
      ? {
          ...item,
          requestedProviderId: null
        }
      : {
          ...item,
          requestedProviderId: providerId
        };
  }

  private async fetchActiveRows(filters: {
    zipPrefix: string | null;
    type: string | null;
  } = { zipPrefix: null, type: null }) {
    // A5 P0.3 — build a parameterized WHERE that collapses to the
    // hot-path `idx_resources_zip3_type_status` index when a ZIP prefix
    // is supplied, and degrades to a status-only scan when the caller
    // is the `getResourceDetail` fallback. The JOIN to dataset_versions
    // is still a lookup, not a scan — it's keyed on the unique
    // (source, dataset_version).
    const clauses: string[] = ["rp.status = 'active'"];
    const params: unknown[] = [];

    if (filters.zipPrefix) {
      params.push(filters.zipPrefix);
      clauses.push(`left(rp.zip, 3) = $${params.length}`);
    }

    if (filters.type) {
      params.push(filters.type);
      clauses.push(`rp.type = $${params.length}`);
    }

    const result = await this.pool.query<ResourceRow>(
      `
        select
          rp.provider_id,
          rp.source,
          rp.source_ref,
          rp.name,
          rp.type,
          rp.address_text,
          rp.city,
          rp.state,
          rp.zip,
          rp.phone,
          rp.hours_json,
          rp.languages,
          rp.eligibility_notes,
          rp.lat,
          rp.lng,
          rp.geo_precision,
          rp.dataset_version,
          dv.source_label,
          dv.source_url
        from resource_providers rp
        left join dataset_versions dv
          on dv.source = rp.source
         and dv.dataset_version = rp.dataset_version
        where ${clauses.join(" and ")}
      `,
      params,
    );

    return result.rows;
  }

  private mergeRows(rows: ResourceRow[], zipCenter: { lat: number | null; lng: number | null }): MergedResourceItem[] {
    const grouped = new Map<string, ResourceRow[]>();
    for (const row of rows) {
      const key = normalizeAddressKey(row.address_text, row.zip);
      const group = grouped.get(key) ?? [];
      group.push(row);
      grouped.set(key, group);
    }

    return Array.from(grouped.values()).map((group) => {
      const primary = (group.find((row) => row.source === "cfc_active") ?? group[0])!;
      const mergedHours = group.reduce<HoursRecord | null>(
        (accumulator, row) => mergeHours(accumulator, normalizeHours(row.hours_json)),
        null
      );
      const languages = Array.from(
        new Set(group.flatMap((row) => row.languages ?? []).filter(Boolean))
      );
      const notes = group
        .map((row) => row.eligibility_notes)
        .filter((value): value is string => Boolean(value))
        .join(" | ") || null;
      const lat =
        primary.lat ?? group.find((row) => row.lat !== null && row.lng !== null)?.lat ?? null;
      const lng =
        primary.lng ?? group.find((row) => row.lat !== null && row.lng !== null)?.lng ?? null;
      const distanceMiles =
        lat !== null &&
        lng !== null &&
        zipCenter.lat !== null &&
        zipCenter.lng !== null
          ? haversineMiles(zipCenter.lat, zipCenter.lng, lat, lng)
          : null;
      const weeklyHours = toWeeklyHours(mergedHours);

      return {
        providerId: primary.provider_id,
        providerIds: group.map((row) => row.provider_id),
        name: primary.name,
        type: primary.type,
        address: primary.address_text,
        city: primary.city,
        state: primary.state,
        zip: primary.zip,
        phone: primary.phone ?? group.find((row) => row.phone)?.phone ?? null,
        languages,
        source: primary.source,
        sourceLabel: primary.source_label,
        sourceUrl: primary.source_url,
        sourceDatasetVersion: primary.dataset_version,
        notes,
        distanceMiles,
        isOpenToday: isOpenToday(mergedHours),
        isOpenNow: isOpenNow(mergedHours),
        geoPrecision: primary.geo_precision ?? "unknown",
        weeklyHours
      };
    });
  }
}

export class InvalidCursorError extends Error {
  constructor(cursor: string) {
    super(`Invalid cursor: ${cursor}`);
    this.name = "InvalidCursorError";
  }
}

export function createImportPool(connectionString: string): Pool {
  return new Pool({
    connectionString
  });
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

  return Number((2 * earthRadiusMiles * Math.asin(Math.sqrt(a))).toFixed(2));
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) {
    return 0;
  }

  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (!/^\d+$/.test(decoded)) {
      throw new InvalidCursorError(cursor);
    }

    const value = Number(decoded);
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new InvalidCursorError(cursor);
    }

    return value;
  } catch {
    throw new InvalidCursorError(cursor);
  }
}

function normalizeHours(value: Record<string, string | null> | null): HoursRecord | null {
  if (!value) {
    return null;
  }

  return {
    mon: value.mon ?? null,
    tue: value.tue ?? null,
    wed: value.wed ?? null,
    thu: value.thu ?? null,
    fri: value.fri ?? null,
    sat: value.sat ?? null,
    sun: value.sun ?? null,
    notes: value.notes ?? null
  };
}
