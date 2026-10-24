// Service worker shared by every installable product app (lib/pwa/apps.ts).
//
// Registered once per app with that app's page as its scope, e.g.
//   navigator.serviceWorker.register("/app-sw.js", { scope: "/products/browser-based-pos" })
// so each app gets its own worker and its own cache: installing or clearing
// one app never touches another. Pages in the scope are network-first (users
// get updates) with a cache fallback, so the app opens without internet.

const SCOPE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const CACHE_PREFIX = `setu-app:${SCOPE_PATH}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;

function inScope(pathname) {
  return pathname === SCOPE_PATH || pathname.startsWith(`${SCOPE_PATH}/`);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(SCOPE_PATH))
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
            // Only this app's older versions; other apps' caches are theirs.
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
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

  if (request.mode === "navigate" && inScope(url.pathname)) {
    // Cache by path so "?source=pwa" (the installed app's start URL) and the
    // plain page share one entry.
    const key = url.pathname.replace(/\/$/, "") || "/";
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(key).then(
            (cached) =>
              cached ||
              new Response("You are offline and this page is not saved on this device yet.", {
                status: 503,
                headers: { "Content-Type": "text/plain; charset=utf-8" },
              })
          )
        )
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
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
