/* ExamNexus service worker — makes the app installable and resilient.
 * Strategy:
 *   - App shell (navigations): network-first, fall back to cached index.html
 *     so the installed app still opens when briefly offline.
 *   - Static build assets (/assets/*, icons, fonts): stale-while-revalidate.
 *   - Everything cross-origin (Supabase, APIs) and non-GET: never touched.
 * CACHE_VERSION is stamped with a unique build ID at build time (see
 * serviceWorkerBuildStamp in vite.config.js), so every deploy ships a new
 * service worker that the browser detects as an update.
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
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL_CACHE);
        await cache.addAll(PRECACHE_URLS);
      } catch {
        // Precache best-effort — missing one asset must not block installability.
      }
      // Activate immediately so desktop/installed PWAs pick up deploys without
      // waiting for a manual "Update now" click.
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Let the page trigger an immediate update (used by the update toast, if any).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
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

  // Only handle same-origin GET requests. Supabase/API/auth calls pass through
  // untouched so live data and sessions are never served from cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell / SPA navigations: network-first with offline fallback.
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

  // Static build assets: stale-while-revalidate.
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
