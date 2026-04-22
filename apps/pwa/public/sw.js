// Pull in the shared `isCacheableStaticRequest` predicate so both the SW and
// its Node-based unit test (sw-predicate.test.ts) execute the exact same
// logic. See apps/pwa/public/sw-predicate.js for the rationale.
importScripts('/sw-predicate.js');

// V2-B win #1: the build-time manifest gives the SW the full list of JS/CSS/
// font chunks that Next.js emitted into `_next/static/*`. We cache them on
// install so return visits render from Cache Storage with 0 RTT. The manifest
// is optional — if it failed to load (e.g. older build, dev server) the SW
// still caches the tiny `CORE_ASSETS` shell and degrades gracefully to
// per-request caching via the fetch handler below.
try {
  importScripts('/sw-build-manifest.js');
} catch (_manifestImportError) {
  // Swallow — the manifest is a build-time artefact and is not strictly
  // required for correctness. sw-predicate.js still runs, and the fetch
  // handler's lazy cache-fill covers any chunk not in the pre-cache.
}

// CACHE_VERSION is derived from the build manifest's content hash so every
// chunk-name change (Next.js re-hashes chunks on any code change) forces a
// cache invalidation during `activate`. Fallback bumps match the pre-V2-B
// cache name so a first rollout on a host that hasn't built yet still evicts
// the v3 shell.
const CACHE_VERSION = self.__WEAVE_BUILD_VERSION || 'shell-v4';
const CACHE_NAME = `weavenyc-shell-${CACHE_VERSION}`;

// `self.CORE_ASSETS` is seeded by sw-predicate.js with the tiny 4-asset
// shell ('/', manifest, two icons). Layer the build-time asset list on top.
// Dedup via Set in case the shell assets were promoted into the built
// manifest (they shouldn't be, but defensive).
const CORE_ASSETS = Array.from(
  new Set([...(self.CORE_ASSETS || []), ...((self.__WEAVE_BUILD_ASSETS) || [])]),
);

// `addAll` is atomic — if any single request fails the whole cache open
// aborts, which would leave return-visit users on a broken offline shell.
// `addAllIndividually` keeps going past individual failures (403/404 on a
// stale chunk, for example) and logs them. The pre-cache is a best-effort
// optimisation, not a correctness guarantee.
function addAllIndividually(cache, urls) {
  return Promise.all(
    urls.map((url) =>
      cache
        .add(url)
        .catch((error) => {
          // Keep this cheap — console output only, no reporting. A miss here
          // just means the asset falls through to the fetch-and-fill path.
          console.warn('[sw] pre-cache miss', url, error?.message || error);
        }),
    ),
  );
}

self.addEventListener('install', (event) => {
  // Data Saver (`Save-Data: on`) users explicitly opted out of speculative
  // downloads. Respect that by shrinking the install-time cache to just the
  // shell; per-request caching in the fetch handler still keeps things
  // snappy once they're online.
  const saveDataMode =
    self.navigator && self.navigator.connection && self.navigator.connection.saveData === true;
  const urlsToCache = saveDataMode ? (self.CORE_ASSETS || []) : CORE_ASSETS;

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => addAllIndividually(cache, urlsToCache))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/')));
    return;
  }

  if (!self.isCacheableStaticRequest(event.request)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const copy = networkResponse.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      });
    }),
  );
});
