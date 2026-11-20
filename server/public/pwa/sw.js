/* No account pages, API responses, form submissions or payment data are cached. */
const CACHE_PREFIX = "go-saudi-public-";
const CACHE_NAME = CACHE_PREFIX + "v1";
const PUBLIC_ASSETS = ["/offline.html", "/pwa/icon-192.png", "/pwa/icon-512.png", "/pwa/icon-maskable-512.png", "/pwa/apple-touch-icon.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PUBLIC_ASSETS)));
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Auth, vendor/admin and all API traffic always go directly to the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/vendor") || url.pathname.startsWith("/admin")) return;
  if (request.mode === "navigate" && ["/", "/sell"].includes(url.pathname)) {
    event.respondWith((async () => {
      try { return await fetch(request); }
      catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("/offline.html")) || new Response("Go Saudi is offline. Reconnect and reload.", {status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
      }
    })());
  } else if (PUBLIC_ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
  }
});
