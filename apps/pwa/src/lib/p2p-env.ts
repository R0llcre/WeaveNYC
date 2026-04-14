export function isP2PDevDemoVisible(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
) {
  return env.NODE_ENV !== 'production' && env.NEXT_PUBLIC_P2P_MDNS_DEMO_ENABLED === '1';
}
