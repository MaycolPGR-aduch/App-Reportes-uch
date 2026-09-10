/*
 * Service worker de Campus Alertas.
 *
 * Antes respondía «primero la caché» a todo GET del mismo origen. Con los
 * archivos de `/_next/static/` eso es correcto —llevan un hash en el nombre,
 * así que un archivo nuevo es una URL nueva— pero aplicado al resto dejaba
 * clavada la primera respuesta para siempre: una versión desplegada después
 * no llegaba al navegador hasta cambiar CACHE_NAME a mano.
 *
 * Ahora cada tipo de petición usa la estrategia que le corresponde.
 */
const CACHE_NAME = "campus-alertas-v3";
const CORE_ASSETS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key)))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Guarda una copia sin dejar que un fallo de escritura tumbe la respuesta. */
function store(request, response) {
  const copy = response.clone();
  caches
    .open(CACHE_NAME)
    .then((cache) => cache.put(request, copy))
    .catch(() => undefined);
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: primero la red, para no abrir una versión vieja de la
  // aplicación teniendo conexión. La caché es el plan B sin cobertura.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => store(request, response))
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // Recursos con hash en el nombre: inmutables, la caché siempre acierta.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((response) => store(request, response))
            .catch(() => Response.error()),
      ),
    );
    return;
  }

  // El resto —iconos, manifiesto, imágenes de `public/`— responde al instante
  // desde la caché y se actualiza por detrás: una versión vieja dura como
  // mucho hasta la siguiente carga, en vez de quedarse fijada.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => store(request, response))
        .catch(() => cached);
      return cached || network;
    }),
  );
});
