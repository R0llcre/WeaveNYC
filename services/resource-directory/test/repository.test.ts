import { describe, expect, it } from 'vitest';

import { ResourceQueryRepository } from '../src/lib/repository.js';

describe('ResourceQueryRepository', () => {
  it('filters results to the requested ZIP or nearby radius instead of returning every active row', async () => {
    const repository = new ResourceQueryRepository({
      query: async () => ({
        rows: [
          {
            provider_id: 'local-1',
            source: 'cfc_active',
            source_ref: 'cfc_active:1',
            name: 'Local Pantry',
            type: 'pantry',
            address_text: '1 Main St',
            city: 'Farmingdale',
            state: 'NY',
            zip: '11735',
            phone: null,
            hours_json: {},
            languages: ['en'],
            eligibility_notes: null,
            lat: 40.7326,
            lng: -73.4454,
            geo_precision: 'street',
            source_label: 'CFC',
            source_url: 'https://example.com',
          },
          {
            provider_id: 'nearby-1',
            source: 'island_harvest',
            source_ref: 'ih:1',
            name: 'Nearby Pantry',
            type: 'pantry',
            address_text: '2 Main St',
            city: 'Bethpage',
            state: 'NY',
            zip: '11714',
            phone: null,
            hours_json: {},
            languages: ['en'],
            eligibility_notes: null,
            lat: 40.7443,
            lng: -73.4821,
            geo_precision: 'street',
            source_label: 'Island Harvest',
            source_url: 'https://example.com',
          },
          {
            provider_id: 'far-1',
            source: 'island_harvest',
            source_ref: 'ih:2',
            name: 'Far Pantry',
            type: 'pantry',
            address_text: '3 Main St',
            city: 'Buffalo',
            state: 'NY',
            zip: '14201',
            phone: null,
            hours_json: {},
            languages: ['en'],
            eligibility_notes: null,
            lat: 42.8864,
            lng: -78.8784,
            geo_precision: 'street',
            source_label: 'Island Harvest',
            source_url: 'https://example.com',
          },
        ],
      }),
    } as never);

    const result = await repository.searchResources(
      {
        zip: '11735',
      },
      {
        lat: 40.7326,
        lng: -73.4454,
      },
    );

    expect(result.items.map((item) => item.name)).toEqual(['Local Pantry', 'Nearby Pantry']);
  });

  it('returns merged detail for a secondary provider id in the same address group', async () => {
    const repository = new ResourceQueryRepository({
      query: async () => ({
        rows: [
          {
            provider_id: 'primary-1',
            source: 'cfc_active',
            source_ref: 'cfc_active:1',
            name: 'Primary Pantry',
            type: 'pantry',
            address_text: '1 Main St',
            city: 'Farmingdale',
            state: 'NY',
            zip: '11735',
            phone: '111',
            hours_json: {},
            languages: ['en'],
            eligibility_notes: 'Primary notes',
            lat: 40.7326,
            lng: -73.4454,
            geo_precision: 'street',
            source_label: 'CFC',
            source_url: 'https://example.com/cfc',
          },
          {
            provider_id: 'secondary-1',
            source: 'island_harvest',
            source_ref: 'ih:1',
            name: 'Secondary Pantry',
            type: 'pantry',
            address_text: '1 Main St',
            city: 'Farmingdale',
            state: 'NY',
            zip: '11735',
            phone: '222',
            hours_json: {},
            languages: ['es'],
            eligibility_notes: 'Secondary notes',
            lat: 40.7326,
            lng: -73.4454,
            geo_precision: 'street',
            source_label: 'Island Harvest',
            source_url: 'https://example.com/ih',
          },
        ],
      }),
    } as never);

    const detail = await repository.getResourceDetail('secondary-1', {
      lat: 40.7326,
      lng: -73.4454,
    });

    expect(detail).toMatchObject({
      providerId: 'primary-1',
      requestedProviderId: 'secondary-1',
      name: 'Primary Pantry',
      phone: '111',
      zip: '11735',
    });
  });

  it('keeps canonical dataset/source semantics on merged detail results', async () => {
    const repository = new ResourceQueryRepository({
      query: async () => ({
        rows: [
          {
            provider_id: 'primary-1',
            source: 'cfc_active',
            source_ref: 'cfc_active:1',
            name: 'Primary Pantry',
            type: 'pantry',
            address_text: '1 Main St',
            city: 'Farmingdale',
            state: 'NY',
            zip: '11735',
            phone: '111',
            hours_json: {},
            languages: ['en'],
            eligibility_notes: 'Primary notes',
            lat: 40.7326,
            lng: -73.4454,
            geo_precision: 'street',
            dataset_version: 'cfc_active_20260405T101500Z',
            source_label: 'CFC',
            source_url: 'https://example.com/cfc',
          },
          {
            provider_id: 'secondary-1',
            source: 'island_harvest',
            source_ref: 'ih:1',
            name: 'Secondary Pantry',
            type: 'pantry',
            address_text: '1 Main St',
            city: 'Farmingdale',
            state: 'NY',
            zip: '11735',
            phone: '222',
            hours_json: {},
            languages: ['es'],
            eligibility_notes: 'Secondary notes',
            lat: 40.7326,
            lng: -73.4454,
            geo_precision: 'street',
            dataset_version: 'island_harvest_20260405T101500Z',
            source_label: 'Island Harvest',
            source_url: 'https://example.com/ih',
          },
        ],
      }),
    } as never);

    const detail = await repository.getResourceDetail('secondary-1', {
      lat: 40.7326,
      lng: -73.4454,
    });

    expect(detail).toMatchObject({
      providerId: 'primary-1',
      requestedProviderId: 'secondary-1',
      source: 'cfc_active',
      sourceDatasetVersion: 'cfc_active_20260405T101500Z',
    });
  });

  it('rejects malformed cursors instead of silently rewinding to page 1', async () => {
    const repository = new ResourceQueryRepository({
      query: async () => ({
        rows: [],
      }),
    } as never);

    await expect(
      repository.searchResources(
        {
          zip: '11735',
          cursor: 'abc',
        },
        {
          lat: 40.7326,
          lng: -73.4454,
        },
      ),
    ).rejects.toMatchObject({
      name: 'InvalidCursorError',
    });
  });

  // A5 P0.3 — SQL filter push-down regression. The repository used to run
  // `select ... where status = 'active'` and filter in JavaScript, which
  // scanned the full table on every public request. The fetch query now
  // prunes by `left(zip, 3)` + optional `type` so the hot path can ride
  // idx_resources_zip3_type_status (migration 0015).
  it('pushes ZIP-prefix and type filters into the fetch query', async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const repository = new ResourceQueryRepository({
      query: async (sql: string, params: unknown[] = []) => {
        captured.push({ sql, params });
        return { rows: [] };
      },
    } as never);

    await repository.searchResources(
      {
        zip: '11735',
        type: 'pantry',
      },
      {
        lat: 40.7326,
        lng: -73.4454,
      },
    );

    expect(captured).toHaveLength(1);
    const firstCall = captured[0]!;
    expect(firstCall.sql).toMatch(/left\(rp\.zip,\s*3\)\s*=\s*\$1/);
    expect(firstCall.sql).toMatch(/rp\.type\s*=\s*\$2/);
    expect(firstCall.params).toEqual(['117', 'pantry']);
  });

  it('omits optional filters from the fetch query when the caller did not set them', async () => {
    const captured: Array<{ sql: string; params: unknown[] }> = [];
    const repository = new ResourceQueryRepository({
      query: async (sql: string, params: unknown[] = []) => {
        captured.push({ sql, params });
        return { rows: [] };
      },
    } as never);

    await repository.searchResources(
      {
        zip: '11735',
      },
      {
        lat: 40.7326,
        lng: -73.4454,
      },
    );

    expect(captured).toHaveLength(1);
    const firstCall = captured[0]!;
    // zipPrefix is always passed; `type` is optional and must be absent.
    expect(firstCall.params).toEqual(['117']);
    expect(firstCall.sql).not.toMatch(/rp\.type\s*=\s*\$2/);
  });
});
