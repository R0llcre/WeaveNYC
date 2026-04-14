import { describe, expect, it } from 'vitest';

import { isP2PDevDemoVisible } from './p2p-env';

describe('isP2PDevDemoVisible', () => {
  it('is disabled by default', () => {
    expect(isP2PDevDemoVisible({ NODE_ENV: 'development' })).toBe(false);
  });

  it('is enabled only when the explicit demo flag is set outside production', () => {
    expect(
      isP2PDevDemoVisible({
        NODE_ENV: 'development',
        NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED: '1',
      }),
    ).toBe(true);
    expect(
      isP2PDevDemoVisible({
        NODE_ENV: 'test',
        NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED: '1',
      }),
    ).toBe(true);
  });

  it('stays disabled in production even if the demo flag is set', () => {
    expect(
      isP2PDevDemoVisible({
        NODE_ENV: 'production',
        NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED: '1',
      }),
    ).toBe(false);
  });
});
