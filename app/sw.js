/**
 * Service worker de /app.
 *
 * Estrategia deliberadamente conservadora:
 *  - Navegaciones: red primero, cache como red de seguridad. Si sirviera
 *    la cache primero, un despliegue nuevo tardaria una visita entera en
 *    verse.
 *  - Codigo (HTML, JS, CSS): red primero, cache solo si no hay red. El
 *    codigo cambia en cada despliegue y servir una version vieja provoca
 *    fallos incomprensibles; la cache aqui solo cubre el caso sin
 *    conexion.
 *  - Recursos inmutables (tipografias, iconos): cache primero, que para
 *    eso no cambian nunca.
 *
 * Nada de esto cachea reservas: viven en localStorage, no en la red.
 */

const VERSION = "v11";
const CACHE = `thehaus-app-${VERSION}`;

const RECURSOS = [
  "/app/",
  "/app/index.html",
  "/app/app.css",
  "/app/app.js",
  "/style.css",
  "/js/mapa.js",
  "/js/planta.js",
  "/js/isometrico.js",
  "/js/mobiliario.js",
  "/js/tarifas.js",
  "/js/reservas.js",
  "/js/sesion-simulada.js",
  "/js/hoja.js",
  "/js/escena3d.js",
  "/js/muebles3d.js",
  "/vendor/three.module.min.js",
  "/vendor/three.core.min.js",
  "/fonts/bdsans-bold.woff2",
  "/fonts/bdsans-regular.woff2",
  "/fonts/inter-latin-var.woff2",
  "/icons/icono-192.png",
  "/icons/icono-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // addAll aborta entero si falla un recurso; se piden por separado
      // para que un fallo suelto no deje la aplicacion sin instalar
      .then((c) => Promise.allSettled(RECURSOS.map((r) => c.add(r))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Lo que no cambia entre despliegues puede servirse desde cache sin riesgo */
const esInmutable = (ruta) => /^\/(fonts|icons|img)\//.test(ruta);

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (esInmutable(url.pathname)) {
    e.respondWith(
      caches.match(request).then(
        (guardado) =>
          guardado ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copia));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match("/app/"))),
    );
    return;
  }

  // Codigo: siempre la version de red mientras la haya
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});
