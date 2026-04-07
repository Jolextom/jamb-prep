const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `jambite-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `jambite-runtime-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/version.json",
  "/data/manifest.json",
  "/icon.png",
  "/og-image.png",
  "/og-bg.png",
  "/jamb_cbt_replica_interface.html",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(async (cache) => {
      await Promise.all(
        APP_SHELL_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Ignore individual asset failures so one missing file does not block installation.
          }
        }),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("jambite-") &&
              key !== APP_SHELL_CACHE &&
              key !== RUNTIME_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (!isSameOrigin(url)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(APP_SHELL_CACHE);
          return (
            (await cache.match("/")) ||
            (await cache.match("/manifest.webmanifest")) ||
            Response.error()
          );
        }
      })(),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/data/") ||
    url.pathname.startsWith("/images/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    [
      "/version.json",
      "/manifest.webmanifest",
      "/icon.png",
      "/og-image.png",
      "/og-bg.png",
      "/jamb_cbt_replica_interface.html",
    ].includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
