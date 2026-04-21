// Cacheable-static request predicate shared between the production service
// worker (sw.js) and its Node-based unit test (sw-predicate.test.ts).
//
// Intentionally a classic (non-module) script so the service worker can pull
// it in via `importScripts(...)`. The UMD-style footer at the bottom also
// exposes `module.exports` so vitest can `require()` the same file without
// duplicating the logic.
//
// Guardrail (P8 finding 10, P1): the predicate MUST NOT allow any `/v1/`
// request to enter the SW cache layer. Authenticated P2P sync + bootstrap +
// posts traffic goes through `/v1/`, and caching those would either stale
// community data or leak cross-user tokens through the Cache Storage API.

(function initializeSwPredicate(root) {
  var STATIC_DESTINATIONS = new Set(['style', 'script', 'worker', 'image', 'font']);
  var CORE_ASSETS = ['/', '/manifest.webmanifest', '/icons/app-icon.svg', '/icons/maskable-icon.svg'];

  function isCacheableStaticRequest(request) {
    var url = new URL(request.url);

    // Same-origin guard: we never cache cross-origin responses here.
    var origin = typeof self !== 'undefined' && self && self.location && self.location.origin
      ? self.location.origin
      : null;
    if (origin && url.origin !== origin) {
      return false;
    }

    // Authenticated endpoints must never enter the SW cache — both for the
    // freshness reason (/v1/communities/.../sync returns per-user deltas) and
    // for the security reason (Authorization headers would leak into the
    // Cache Storage layer, where they'd survive logout).
    if (request.headers && typeof request.headers.has === 'function' && request.headers.has('authorization')) {
      return false;
    }
    if (url.pathname.indexOf('/v1/') === 0) {
      return false;
    }

    if (request.destination && STATIC_DESTINATIONS.has(request.destination)) {
      return true;
    }

    return (
      CORE_ASSETS.indexOf(url.pathname) !== -1 ||
      url.pathname.indexOf('/_next/static/') === 0 ||
      url.pathname.indexOf('/icons/') === 0
    );
  }

  root.isCacheableStaticRequest = isCacheableStaticRequest;
  root.CORE_ASSETS = CORE_ASSETS;
  root.STATIC_DESTINATIONS = STATIC_DESTINATIONS;

  // eslint-disable-next-line no-undef
  if (typeof module !== 'undefined' && module.exports) {
    // eslint-disable-next-line no-undef
    module.exports = { isCacheableStaticRequest: isCacheableStaticRequest, CORE_ASSETS: CORE_ASSETS, STATIC_DESTINATIONS: STATIC_DESTINATIONS };
  }
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);
