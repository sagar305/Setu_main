// Service worker for Free Dine (/products/free-restaurant-pos).
// Caches the page and its static assets so a restaurant keeps taking orders
// and printing bills when the wifi drops mid-service.
//
// Separate from pos-sw.js on purpose: two workers on the same origin keep
// their own caches, so the Browser Based POS updating (or being cleared) never
// evicts the page a restaurant is mid-service on. Each claims only its own
// page; requests for anything else fall straight through to the network.

const CACHE_NAME = "setu-free-dine-v1";
const DINE_PATH = "/products/free-restaurant-pos";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(DINE_PATH))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            // Only ever delete our own older versions — the POS worker's cache
            // lives alongside this one and is none of our business.
            .filter((key) => key.startsWith("setu-free-dine-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isDinePage = url.pathname === DINE_PATH || url.pathname === `${DINE_PATH}/`;
  const isStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isDinePage) {
    // Network-first so a restaurant picks up fixes, cache fallback for offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(DINE_PATH, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(DINE_PATH).then(
            (cached) =>
              cached ||
              new Response("You are offline and Free Dine is not cached yet.", {
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
