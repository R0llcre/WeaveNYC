/**
 * Whitelist helper for `return_to` parameters.
 *
 * Naive `params.get('return_to') ?? fallback` is an open-redirect sink: a
 * value like `https://attacker.com` or the protocol-relative `//evil.com`
 * would be handed straight to `router.push`, bouncing the user off the
 * origin after onboarding/verify. We reject anything that isn't a same-
 * origin absolute path and also reject path-traversal fragments.
 *
 * Accepted shapes:
 *   `/`                        → same-origin root
 *   `/inbox`                  → same-origin absolute path
 *   `/posts/abc?x=1#frag`     → path with query + hash
 *
 * Rejected shapes (fall back to the caller's `fallback`):
 *   `https://attacker.com/x`  → full URL with scheme
 *   `//attacker.com/x`        → protocol-relative URL (browsers resolve
 *                                these against the current origin with a
 *                                new authority — `router.push` treats
 *                                them as external)
 *   `mailto:a@b.com`          → non-http scheme
 *   `/verify/../../../etc`    → path traversal fragment
 *   empty, null, undefined    → fallback
 *
 * M2 mobile port note — the shape is identical to the PWA version. Expo
 * Router accepts absolute paths ('/inbox', '/posts/abc?x=1') the same
 * way Next.js's `router.push` does, so no rewrite is needed. When the
 * mobile app eventually needs native deep-link scheme handling, that
 * logic will live in a separate route-resolver (expo-linking) and can
 * call this helper as its first pass.
 */
export function safeReturnTo(
  raw: string | null | undefined,
  fallback: string,
): string {
  if (!raw) {
    return fallback;
  }

  // Must be a path, not a URL.
  if (!raw.startsWith('/')) {
    return fallback;
  }

  // Protocol-relative URLs start with `//` and `router.push` treats them
  // as absolute navigations to a new origin — exactly the exploit we're
  // blocking.
  if (raw.startsWith('//')) {
    return fallback;
  }

  // Block path traversal.
  if (raw.includes('..')) {
    return fallback;
  }

  return raw;
}
