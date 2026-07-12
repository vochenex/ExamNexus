/* ExamNexus service worker — makes the app installable and resilient.
 * Strategy:
 *   - App shell (navigations): network-first, fall back to cached index.html
 *   - Static build assets: stale-while-revalidate
 *   - Cross-origin / non-GET: never touched
 * CACHE_VERSION is stamped at build time so each deploy is a new worker.
 */
const CACHE_VERSION = "__BUILD_ID__";
const SHELL_CACHE = `examnexus-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `examnexus-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/index.html";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/pwa-192.png",
  "/icons/pwa-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  // Activate ASAP — do not block on precache (that made "Update now" feel stuck).
  event.waitUntil(self.skipWaiting());

  // Warm shell cache in the background (best-effort).
  caches
    .open(SHELL_CACHE)
    .then((cache) => cache.addAll(PRECACHE_URLS))
    .catch(() => {});
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Clean old caches after claiming so the page can reload immediately.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
          .map((key) => caches.delete(key))
      );
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data === "CLAIM_CLIENTS") {
    self.clients.claim();
  }
});

function isBuildAsset(url) {
  return (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/team/") ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  if (isBuildAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
