/* Funcionamiento sin conexión. La caché se nombra con la versión (version.js): al subir la versión se crea una nueva.
   La versión nueva espera hasta que la persona pulsa «Actualizar ahora» (así no se cambia el código a mitad de una sesión). */
importScripts('version.js');
const CACHE = 'appseg-' + self.APP_VERSION.v;
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'version.js',
  'js/util.js', 'js/schema.js', 'js/store.js', 'js/backup.js', 'js/lock.js', 'js/calc.js', 'js/food.js', 'js/train.js', 'js/halter-import.js', 'js/compliance.js', 'js/pdf.js', 'js/export.js', 'js/sync.js', 'js/sync-firebase.js', 'js/firebase-config.js', 'js/cloud.js', 'js/login-gate.js', 'js/nav.js', 'js/ui.js', 'js/photos.js', 'js/docs.js', 'js/charts.js', 'js/lock-ui.js', 'js/shell.js', 'js/views-common.js', 'js/views-datos.js', 'js/views-peso.js', 'js/views-comida.js', 'js/views-comida-meta.js', 'js/views-train.js', 'js/views-train-plan.js', 'js/views-halter.js', 'js/views-cumpl.js', 'js/views-inicio.js', 'js/views-docs.js', 'js/views-sync.js', 'js/views-accesos.js', 'js/app.js',
  'icons/icon.svg', 'icons/favicon-32.png', 'logo/angrep-logo-claro.svg', 'logo/angrep-logo-oscuro.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('appseg-') === 0 && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.slice(-11) === '/version.js' && url.search) return;   // la comprobación de actualización va siempre a la red
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).catch(() => req.mode === 'navigate' ? caches.match('index.html') : Response.error())));
});
