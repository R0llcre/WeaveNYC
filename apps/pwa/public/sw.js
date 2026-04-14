const CACHE_NAME = 'weavenyc-shell-v2';
const CORE_ASSETS = ['/', '/manifest.webmanifest', '/icons/app-icon.svg', '/icons/maskable-icon.svg'];
const STATIC_DESTINATIONS = new Set(['style', 'script', 'worker', 'image', 'font']);

function isCacheableStaticRequest(request) {
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (request.headers.has('authorization') || url.pathname.startsWith('/v1/')) {
    return false;
  }

  if (request.destination && STATIC_DESTINATIONS.has(request.destination)) {
    return true;
  }

  return (
    CORE_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
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

  if (!isCacheableStaticRequest(event.request)) {
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
