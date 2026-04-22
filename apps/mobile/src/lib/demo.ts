/**
 * Demo sandbox helpers — mobile (M2 port of apps/pwa/src/lib/demo.ts).
 *
 * Sandbox mode is a visual-only convenience for the 30-min pilot demo. It
 * lets reviewers land on `/me/verify`, see a prominent amber banner, and
 * watch the OTP code `246810` auto-type into the input. The actual OTP
 * request still hits the gateway — sandbox mode does NOT stub auth — so
 * the demo runs against a preflight-seeded community with a pre-known
 * persona, not against production user data.
 *
 * Activation (mobile)
 * ───────────────────
 *   1. `EXPO_PUBLIC_DEMO_SANDBOX=1` build-time env var. Expo's static
 *      string replacement inlines this at bundle time, so a TestFlight
 *      build shipped without the flag set is NOT a sandbox build.
 *
 * The PWA also honours a per-tab `?demo=1` URL override so reviewers can
 * flip sandbox mode on mid-session without a rebuild. Native apps don't
 * have a URL bar to hijack, so that path is intentionally dropped — the
 * build flag is the single activation surface. Deep-link handlers in
 * `expo-linking` (wired in a later wave) can still pass through a
 * `?demo=1` query parameter to a specific screen, but the global sandbox
 * gate is build-time-only.
 *
 * Production safety
 * ─────────────────
 * The PWA's hostname kill-switch (`weavenyc.org` never activates sandbox)
 * is built around the browser's origin model. On native there's no
 * hostname to inspect — the guarantee instead becomes "only a build that
 * was explicitly compiled with EXPO_PUBLIC_DEMO_SANDBOX=1 will show the
 * banner". Production release builds (EAS production profile) must
 * therefore NEVER export that env var; our EAS config enforces this by
 * only injecting the flag in the `demo` profile.
 */

/**
 * Demo OTP code that the sandbox banner displays and the verify screen
 * auto-types after 2 seconds. The seed at
 * `packages/db/seed/demo-personas.ts` documents that the gateway
 * challenge store is NOT pre-enrolled with this code — the auto-fill is
 * visual and the instructor demo-mode relies on a pre-signed session.
 * Still, keeping the constant in one place lets tests and the UI agree.
 */
export const DEMO_OTP_CODE = '246810';

/**
 * isDemoSandbox — returns true when the current bundle was built with
 * the sandbox flag enabled. `opts.env` is a test seam so unit tests can
 * simulate the flag being set without polluting `process.env`.
 */
export function isDemoSandbox(opts?: {
  env?: string | undefined;
}): boolean {
  const env =
    opts?.env ??
    (typeof process !== 'undefined'
      ? (process.env as Record<string, string | undefined>).EXPO_PUBLIC_DEMO_SANDBOX
      : undefined);

  return env === '1';
}
