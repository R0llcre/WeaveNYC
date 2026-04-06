import { describe, expect, it } from 'vitest';

import { inspectCfcActiveRecords, loadCfcActiveRecords, parseRecordBlock } from '../src/adapters/cfc-active.js';
import { loadIslandHarvestRecords } from '../src/adapters/island-harvest.js';

describe('resource-directory adapters', () => {
  it('parses fixture-backed CFC Active records', async () => {
    const records = await loadCfcActiveRecords({ mode: 'fixture' });

    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({
      source: 'cfc_active',
      zip: '11735',
      type: 'pantry'
    });
  });

  it('returns parser diagnostics for fixture-backed CFC Active records', async () => {
    const result = await inspectCfcActiveRecords({ mode: 'fixture' });

    expect(result.diagnostics).toEqual({
      headerCount: 3,
      parsedCount: 3,
      skippedCount: 0
    });
  });

  it('parses CFC records when the program name is folded onto the ID/type line', () => {
    const record = parseRecordBlock([
      '83619 FPK BENSONHURST COUNCIL OF JEWISH ORGANIZATIONS',
      '(718) 333-1834',
      '8635 21ST AVE',
      'BK 11214 TUE',
      '10AM-4PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:83619',
      name: 'BENSONHURST COUNCIL OF JEWISH ORGANIZATIONS',
      city: 'Brooklyn',
      zip: '11214',
      type: 'pantry',
    });
  });

  it('parses fixture-backed Island Harvest records', async () => {
    const records = await loadIslandHarvestRecords({ mode: 'fixture' });

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      source: 'island_harvest',
      zip: '11735'
    });
  });

  it('skips Island Harvest rows that are missing required address or zip fields', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          results: {
            locations: [
              {
                id: 1,
                name: 'Valid Pantry',
                lat: null,
                lng: null,
                phone: null,
                address: '1 Main St',
                address_line_1: null,
                city: 'Farmingdale',
                state: 'NY',
                postcode: '11735'
              },
              {
                id: 2,
                name: 'Missing ZIP Pantry',
                lat: null,
                lng: null,
                phone: null,
                address: '2 Main St',
                address_line_1: null,
                city: 'Farmingdale',
                state: 'NY',
                postcode: null
              }
            ]
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );

    const records = await loadIslandHarvestRecords({ mode: 'live' }, fetchImpl);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      name: 'Valid Pantry',
      zip: '11735'
    });
  });

  it('throws when Island Harvest payload shape is invalid', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ success: true, results: {} }), {
        status: 200,
        headers: {
          'content-type': 'application/json'
        }
      });

    await expect(loadIslandHarvestRecords({ mode: 'live' }, fetchImpl)).rejects.toThrow(
      /results\.locations/
    );
  });

  it('drops malformed Island Harvest coordinates so geocoding fallback can run', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          success: true,
          results: {
            locations: [
              {
                id: 1,
                name: 'Bad Coordinate Pantry',
                lat: 'not-a-number',
                lng: 'NaN',
                phone: null,
                address: '1 Main St',
                address_line_1: null,
                city: 'Farmingdale',
                state: 'NY',
                postcode: '11735'
              }
            ]
          }
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      );

    const records = await loadIslandHarvestRecords({ mode: 'live' }, fetchImpl);

    expect(records[0]).toMatchObject({
      lat: null,
      lng: null,
      geoPrecision: 'unknown'
    });
  });
});
