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

  it('parses CFC records when pdftotext emits split ID/type/program columns', () => {
    const record = parseRecordBlock([
      '85828',
      'FP',
      'ABUNDANT LIFE CHRISTIAN CHURCH FP',
      '718-778-5833',
      '579 GATES AVENUE',
      'BK',
      '11221',
      'SUN (1,3)',
      '1:30-2:30PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:85828',
      name: 'ABUNDANT LIFE CHRISTIAN CHURCH FP',
      city: 'Brooklyn',
      zip: '11221',
      type: 'pantry',
      phone: '718-778-5833',
      addressText: '579 Gates Avenue',
    });
  });

  it('parses the last CFC record on a page despite trailing footer and next-page headings', () => {
    const record = parseRecordBlock([
      '80345',
      'FP',
      'CCNS-ST. MICHAEL/ ST. MALACHY',
      '347-957-2450',
      '286 WARWICK STREET',
      'BK',
      '11207',
      'FRI',
      '9:30-11:30AM',
      'FP = 492',
      'SK = 73',
      'Page 1 of 19',
      'CFC (ACTIVE) PROGRAMS (as of 9-14-26)',
      'info by boro in alpha order',
      'DISTBORODISTZIP',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:80345',
      addressText: '286 Warwick Street',
      hoursJson: { fri: '9:30-11:30AM' },
    });
  });

  it('recognizes the FPHA pantry subtype', () => {
    const record = parseRecordBlock([
      '81597', 'FPHA', 'BOOM! HEALTH', '929-450-8674',
      '760 EAST 160TH STREET', 'BX', '10456', 'WED, THURS', '11AM-12:30PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:81597',
      type: 'pantry',
      zip: '10456',
    });
  });

  it('preserves conditional CFC hours when the PDF folds them into the days line', () => {
    const record = parseRecordBlock([
      '81113', 'FP', 'GRAND CONCOURSE SEVENTH DAY ADVENTIST CHURCH',
      '718-681-2232', '1275 GRAND CONCOURSE', 'BX', '10452',
      'WED(CLOSED 5TH WED)1:30-4PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:81113',
      hoursJson: { notes: 'WED(CLOSED 5TH WED) 1:30-4PM' },
    });
  });

  it('does not treat a fourth-Saturday listing as open every Saturday', () => {
    const record = parseRecordBlock([
      '85745', 'FP', 'FAITH ASSEMBLY COMMUNITY OUTREACH',
      '718-849-5277', '120-13 101ST AVENUE (SOUTH RICHMOND HILL)',
      'QN', '11419', 'SAT (4)', '10AM-12PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:85745',
      hoursJson: { notes: 'SAT (4) 10AM-12PM' },
    });
  });

  it('preserves distinct conditional day windows without assigning them to both days', () => {
    const record = parseRecordBlock([
      '81146', 'FP', 'NORTHEAST CONFERENCE COMMUNITY CENTER SDA',
      '347-527-2444', '99-13 NORTHERN BLVD', 'QN', '11368',
      'TUE(SR ONLY)/WED', '11AM-1PM/3-6PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:81146',
      hoursJson: { notes: 'TUE(SR ONLY)/WED 11AM-1PM/3-6PM' },
    });
  });

  it('keeps multi-day, multi-window source schedules together instead of assigning the wrong hours', () => {
    const record = parseRecordBlock([
      '85109', 'FP', 'BRONX BETHANY COMMUNITY CORPORATION',
      '718-697-9672', '971 EAST 227TH STREET', 'BX', '10466',
      'WED(1,2,3,4)/TH(1,2,3,4) 9-11AM/3-6PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:85109',
      hoursJson: { notes: 'WED(1,2,3,4)/TH(1,2,3,4) 9-11AM/3-6PM' },
    });
  });

  it('keeps source hours without inventing missing AM/PM labels', () => {
    const record = parseRecordBlock([
      '85598', 'FPK', 'MET COUNCIL BROOKLYN HUB', 'NONE PROVIDED',
      '1271 60TH STREET', 'BK', '11219', 'TUE,WED,THUR', '12:30-4:30',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:85598',
      phone: null,
      hoursJson: { tue: '12:30-4:30', wed: '12:30-4:30', thu: '12:30-4:30' },
    });
  });

  it('joins a phone number split across PDF lines', () => {
    const record = parseRecordBlock([
      '83348', 'FP', 'SOUTH BKLYN SEVENTH DAY ADVENTIST CHURCH COMMUNITY SERVICE (718)',
      'PROGRAM', '783-1662', '42 PROSPECT PLACE', 'BK', '11217',
      'SUN(1,3)', '11AM-2PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:83348',
      name: 'SOUTH BKLYN SEVENTH DAY ADVENTIST CHURCH COMMUNITY SERVICE PROGRAM',
      phone: '(718) 783-1662',
      addressText: '42 Prospect Place',
      hoursJson: { notes: 'SUN(1,3) 11AM-2PM' },
    });
  });

  it('accepts a CFC row with a street address but no phone', () => {
    const record = parseRecordBlock([
      '85255', 'FP', 'MINISTRY TOOLS INC', '170-20 140TH AVE',
      'QN', '11434', 'THUR', '4-6PM',
    ]);

    expect(record).toMatchObject({
      sourceRef: 'cfc_active:85255',
      phone: null,
      name: 'MINISTRY TOOLS INC',
      addressText: '170-20 140th Ave',
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
