// Solo los recursos estáticos con hash son seguros para compartir entre sesiones.
const CACHE_NAME = "campus-alertas-v4";
const CACHE_PREFIX = "campus-alertas-";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // API, navegación y cualquier contenido dinámico siempre van a la red.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.pathname.startsWith("/_next/static/")) return;

  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone()).catch(() => undefined);
    return response;
  }));
});
