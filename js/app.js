/* Arranque: datos → tema → bloqueo → pantallas → sin conexión (service worker) y actualizaciones. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  A.version = root.APP_VERSION || { n: '0.0.0', v: '' };

  A.applyTheme = function () {
    const t = A.store.getLocal().theme, r = document.documentElement;
    if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.setAttribute('content', getComputedStyle(r).getPropertyValue('--bg').trim() || '#f4f6f8');
  };

  let reg = null;
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').then(r => { reg = r; }).catch(() => { /* sin sw: la app sigue funcionando, solo sin caché */ });
  }
  /* Actualizaciones: compara con version.js de la red (nunca de la caché). La cuenta y los datos no se tocan. */
  A.update = {
    async check() {
      try {
        const res = await fetch('version.js?c=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('http ' + res.status);
        const m = /n:\s*'([^']+)'/.exec(await res.text());
        if (!m) throw new Error('formato');
        return { remote: m[1], newer: A.util.cmpVersion(m[1], A.version.n) > 0 };
      } catch (e) { return { error: 'No se pudo comprobar (¿sin conexión?).' }; }
    },
    async apply() {
      if (!reg) { location.reload(); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      await reg.update();
      if (reg.waiting) reg.waiting.postMessage('skipWaiting'); else location.reload();
    }
  };

  function boot() {
    A.store.init();
    A.applyTheme();
    A.shell.mount(document.getElementById('app'));
    A.lockUi.gate(() => { A.shell.start(); A.cloud.start(); });
    registerSW();
    A.photos.keepStorage();
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', A.applyTheme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
