/**
 * M2 port — `NEXT_PUBLIC_` env vars were rewritten to `EXPO_PUBLIC_` so
 * Expo's build-time static replacement picks them up. A caller that wants
 * to override (e.g. in tests) can still pass an explicit `env` argument,
 * which bypasses `process.env` entirely.
 */
export function isP2PDevDemoVisible(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
) {
  return env.NODE_ENV !== 'production' && env.EXPO_PUBLIC_P2P_MDNS_DEMO_ENABLED === '1';
}
