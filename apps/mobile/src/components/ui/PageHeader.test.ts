/**
 * PageHeader atom — import + shape smoke tests.
 *
 * The mobile jest config deliberately runs in a plain Node env without
 * the jest-expo RN renderer (see jest.config.js header comment), so we
 * don't exercise the render tree here. We assert the atom's public
 * surface evaluates, which is enough to catch import-level regressions
 * (stale module paths, circular deps, missing barrel exports).
 */

import { PageHeader } from './PageHeader';
import { PageHeader as BarrelPageHeader } from './index';

describe('PageHeader atom', () => {
  it('exports a callable React component', () => {
    expect(typeof PageHeader).toBe('function');
  });

  it('is re-exported from the ui barrel', () => {
    expect(BarrelPageHeader).toBe(PageHeader);
  });

  it('has a stable display name for debugging', () => {
    // Function name survives ts-jest compilation and shows up in React
    // devtools / error boundaries, so we pin it against accidental
    // renames that would break Maestro snapshot diffs.
    expect(PageHeader.name).toBe('PageHeader');
  });
});
