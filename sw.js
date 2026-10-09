const CACHE_NAME = "est60-pwa-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.svg",
  "./icon-512.svg",
  "./logo.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("est60-pwa-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo se atienden peticiones GET del mismo origen. La API externa,
  // los formularios y las operaciones administrativas no se almacenan aquí.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok && (url.pathname === "/" || url.pathname.endsWith("/index.html"))) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match("./index.html");
          if (cached && (url.pathname === "/" || url.pathname.endsWith("/index.html"))) return cached;
          return new Response(
            "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Sin conexión</title><body style=\"font-family:Arial,sans-serif;padding:2rem;background:#0d1a2a;color:#fff\"><h1>Sin conexión</h1><p>Conéctate a internet para abrir esta sección. Las tareas y avisos necesitan conexión con el servidor.</p><a style=\"color:#93c5fd\" href=\"./index.html\">Volver al inicio</a></body></html>",
            {headers:{"Content-Type":"text/html; charset=utf-8"},status:503}
          );
        })
    );
    return;
  }

  // Los archivos estáticos se sirven de caché y se actualizan desde la red.
  event.respondWith(
    caches.match(request).then(cached => {
      const networkRequest = fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || networkRequest.catch(() => cached);
    })
  );
});
