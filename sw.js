/* Funcionamiento sin conexión. La caché se nombra con la versión (version.js): al subir la versión se crea una nueva.
   La versión nueva se activa sola; la pantalla abierta no se recarga hasta que la persona pulsa «Actualizar» en el aviso (así no se pierde lo que está haciendo). */
importScripts('version.js');
const CACHE = 'appseg-' + self.APP_VERSION.v;
const FILES = ['fonts/Inter-Regular.woff', 'fonts/Inter-Medium.woff', 'fonts/Inter-SemiBold.woff', 'fonts/Inter-Bold.woff', 'fonts/Inter-ExtraBold.woff', './', 'index.html', 'styles.css', 'manifest.webmanifest', 'version.js',
  'js/util.js', 'js/schema.js', 'js/store.js', 'js/backup.js', 'js/lock.js', 'js/calc.js', 'js/food.js', 'js/train.js', 'js/halter-import.js', 'js/compliance.js', 'js/pdf.js', 'js/export.js', 'js/sync.js', 'js/sync-firebase.js', 'js/firebase-config.js', 'js/cloud.js', 'js/login-gate.js', 'js/nav.js', 'js/ui.js', 'js/photos.js', 'js/docs.js', 'js/charts.js', 'js/lock-ui.js', 'js/wheel.js', 'js/shell.js', 'js/views-common.js', 'js/views-datos.js', 'js/views-peso.js', 'js/views-comida.js', 'js/views-comida-meta.js', 'js/views-train.js', 'js/views-train-plan.js', 'js/views-halter.js', 'js/views-cumpl.js', 'js/views-inicio.js', 'js/views-docs.js', 'js/views-sync.js', 'js/views-accesos.js', 'js/app.js',
  'icons/icon.svg', 'icons/favicon-32.png', 'logo/angrep-logo-claro.svg', 'logo/angrep-logo-oscuro.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

const BUILD = '2026.11.09.7';   // se cambia junto con version.js: así el navegador nota que hay un sw.js nuevo
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())); });
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
