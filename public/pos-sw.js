// Service worker for the Offline Browser POS (/free-pos).
// Caches the POS page and its static assets so the app loads without internet.

const CACHE_NAME = "setu-free-pos-v1";
const POS_PATH = "/free-pos";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(POS_PATH))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isPosPage = url.pathname === POS_PATH || url.pathname === `${POS_PATH}/`;
  const isStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isPosPage) {
    // Network-first so users get updates, cache fallback for offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(POS_PATH, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(POS_PATH).then(
            (cached) =>
              cached ||
              new Response("You are offline and the POS page is not cached yet.", {
                status: 503,
                headers: { "Content-Type": "text/plain" },
              })
          )
        )
    );
    return;
  }

  if (isStaticAsset) {
    // Hashed immutable assets: cache-first.
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
