import { createHash } from 'node:crypto';

import type { NormalizedResourceRecord } from '../types.js';

export function normalizeZip(zip: string): string {
  return zip.trim().slice(0, 5);
}

export function normalizeAddressKey(addressText: string, zip: string): string {
  const normalizedAddress = addressText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(street|st)\b/g, 'st')
    .replace(/\b(avenue|ave)\b/g, 'ave')
    .replace(/\b(road|rd)\b/g, 'rd')
    .replace(/\b(boulevard|blvd)\b/g, 'blvd')
    .replace(/\s+/g, ' ')
    .trim();

  return `${normalizedAddress}|${normalizeZip(zip)}`;
}

export function createContentHash(record: NormalizedResourceRecord): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        source: record.source,
        sourceRef: record.sourceRef,
        name: record.name,
        type: record.type,
        addressText: record.addressText,
        city: record.city,
        state: record.state,
        zip: record.zip,
        phone: record.phone,
        hoursJson: record.hoursJson,
        languages: record.languages,
        eligibilityNotes: record.eligibilityNotes,
        lat: record.lat,
        lng: record.lng,
        geoPrecision: record.geoPrecision,
        sourceUrl: record.sourceUrl
      })
    )
    .digest('hex');
}
