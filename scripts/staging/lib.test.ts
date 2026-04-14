import { describe, expect, it } from 'vitest';

import { isHealthyProbeStatus } from './lib.js';

describe('isHealthyProbeStatus', () => {
  it('accepts successful and redirect statuses', () => {
    expect(isHealthyProbeStatus(200)).toBe(true);
    expect(isHealthyProbeStatus(204)).toBe(true);
    expect(isHealthyProbeStatus(302)).toBe(true);
  });

  it('rejects client and server error statuses', () => {
    expect(isHealthyProbeStatus(400)).toBe(false);
    expect(isHealthyProbeStatus(503)).toBe(false);
  });
});
