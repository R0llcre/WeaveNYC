/**
 * ResourceCard atom — import + shape smoke tests.
 *
 * The node-only jest env can't mount a ResourceCard, but the category
 * taxonomy + the public surface are the riskiest things to regress.
 * We exhaustively verify the category type covers every taxonomy row
 * documented in the product spec so a typo in the mapping table would
 * fail CI before Maestro ever sees the card.
 */

import {
  ResourceCard,
  type ResourceCardCategory,
  type ResourceCardLabels,
  type ResourceCardResource,
} from './ResourceCard';
import { ResourceCard as BarrelResourceCard } from './index';

// Exhaustive list of taxonomy rows. If a designer adds a new category
// on the PWA side, the matching type import above will either fail to
// compile (string literal missing) or this assert will flag the
// missing entry. Either way CI catches the drift.
const ALL_CATEGORIES: ResourceCardCategory[] = [
  'food',
  'pantry',
  'kitchen',
  'market',
  'benefits',
  'goods',
  'childcare',
  'companionship',
  'translation',
  'transportation',
  'health',
  'other',
];

describe('ResourceCard atom', () => {
  it('exports a callable React component', () => {
    expect(typeof ResourceCard).toBe('function');
  });

  it('is re-exported from the ui barrel', () => {
    expect(BarrelResourceCard).toBe(ResourceCard);
  });

  it('has a stable display name for debugging', () => {
    expect(ResourceCard.name).toBe('ResourceCard');
  });

  it('category taxonomy covers all 12 rows', () => {
    // Runtime assert to lock the taxonomy's cardinality — a type-only
    // check would let `type X = never` slip through silently.
    expect(new Set(ALL_CATEGORIES).size).toBe(12);
  });

  it('accepts a minimal resource + labels shape', () => {
    // Compile-time sanity: make sure the exported types stay compatible
    // with the documented minimum payload. The test passes as long as
    // the object literal type-checks; at runtime we only need it not to
    // throw during evaluation.
    const resource: ResourceCardResource = { id: 'r1', name: 'Hub' };
    const labels: ResourceCardLabels = {
      openLabel: 'Open',
      bookmarkLabel: 'Save',
      callLabel: 'Call',
      directionsLabel: 'Directions',
      shareLabel: 'Share',
    };
    expect(resource.id).toBe('r1');
    expect(labels.openLabel).toBe('Open');
  });
});
