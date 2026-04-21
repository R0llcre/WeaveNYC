/**
 * Demo sandbox helpers (B5/B6).
 *
 * Sandbox mode is a visual-only convenience for the 30-min pilot demo. It
 * lets reviewers land on `/me/verify`, see a prominent amber banner, and
 * watch the OTP code `246810` auto-type into the input. The actual OTP
 * request still hits the gateway — sandbox mode does NOT stub auth — so
 * the demo runs against a preflight-seeded community with a pre-known
 * persona, not against production user data.
 *
 * Activation
 * ──────────
 *   1. `NEXT_PUBLIC_DEMO_SANDBOX=1` build-time env var, OR
 *   2. `?demo=1` in the URL (per-session, survives soft navigations while
 *      the query param is retained).
 *
 * Production safety
 * ─────────────────
 *   `weavenyc.org` must NEVER activate sandbox mode even if the URL has
 *   `?demo=1`. This prevents a phishing page from ever embedding the
 *   sandbox banner on the real origin. Preview deployments (`*.pages.dev`)
 *   and localhost are allowed to activate so the demo flow can be
 *   rehearsed before pilot class.
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
 * The production origin. We hard-code it here rather than pulling from a
 * config because the safety guarantee is "the string `weavenyc.org` is
 * never a sandbox target" — a config-driven value could be accidentally
 * swapped.
 */
const PRODUCTION_HOSTNAME = 'weavenyc.org';

function isProductionHostname(hostname: string): boolean {
  if (hostname === PRODUCTION_HOSTNAME) {
    return true;
  }
  // www.weavenyc.org and any bare weavenyc.org would both count; we treat
  // them identically. Subdomain `api.weavenyc.org` is not a PWA origin so
  // this function is never called there.
  return hostname === `www.${PRODUCTION_HOSTNAME}`;
}

function isLocalOrPreviewHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }
  if (hostname.endsWith('.pages.dev')) {
    return true;
  }
  if (hostname.endsWith('.vercel.app')) {
    return true;
  }
  return false;
}

/**
 * isDemoSandbox — returns true when the current origin should render
 * sandbox affordances (banner + auto-fill + SANDBOX pill).
 *
 * Server-side renders always return `false` so the SSG shell is never
 * tagged as sandbox on production. The banner is mounted client-side only
 * (`'use client'` components that call this after hydration).
 *
 * @param opts — test seam. In jsdom we pass an explicit location so we
 * don't rely on the global `window.location.assign` stubs getting mirrored
 * through vitest-dom's happy-dom shim.
 */
export function isDemoSandbox(opts?: {
  hostname?: string;
  search?: string;
  env?: string | undefined;
}): boolean {
  const env =
    opts?.env ??
    (typeof process !== 'undefined'
      ? process.env.NEXT_PUBLIC_DEMO_SANDBOX
      : undefined);
  const hostname =
    opts?.hostname ??
    (typeof window !== 'undefined' ? window.location.hostname : '');
  const search =
    opts?.search ??
    (typeof window !== 'undefined' ? window.location.search : '');

  // Production kill-switch — weavenyc.org never activates sandbox mode,
  // regardless of env or URL. Preview URLs on *.pages.dev / *.vercel.app
  // and localhost remain allowed so the demo can be rehearsed against a
  // preview deployment.
  if (isProductionHostname(hostname) && !isLocalOrPreviewHostname(hostname)) {
    return false;
  }

  if (env === '1') {
    return true;
  }

  if (typeof search === 'string' && search.length > 0) {
    const params = new URLSearchParams(search);
    if (params.get('demo') === '1') {
      return true;
    }
  }

  return false;
}
