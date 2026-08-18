// Service worker for the free Tuition Class Manager
// (/products/free-tuition-software). Caches the page and its static assets so
// a teacher can mark attendance with no internet in the classroom.

const CACHE_NAME = "setu-tuition-v1";
const TUITION_PATH = "/products/free-tuition-software";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(TUITION_PATH))
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

  const isAppPage = url.pathname === TUITION_PATH || url.pathname === `${TUITION_PATH}/`;
  const isStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isAppPage) {
    // Network-first so teachers get updates, cache fallback for offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(TUITION_PATH, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(TUITION_PATH).then(
            (cached) =>
              cached ||
              new Response("You are offline and this page is not cached yet.", {
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
