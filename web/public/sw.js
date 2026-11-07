/*
 * Service worker de Posta: permite abrir la web y el plan familiar sin conexión.
 * No envía nada a ningún sitio. Estrategia:
 *  - Páginas HTML: primero red (para tener siempre la última versión), y si no hay red, caché.
 *  - Resto de recursos del mismo origen: primero caché, y se actualiza en segundo plano.
 * El nombre de la caché incluye la versión: al publicar una nueva se descartan las antiguas.
 */
const VERSION = "__POSTA_BUILD__";
const CACHE = `posta-${VERSION}`;
const PRECACHE = __POSTA_PRECACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("posta-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request, { ignoreSearch: true })) || caches.match("./index.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
