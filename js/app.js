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

  let reg = null, applying = false;
  function registerSW() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !applying) A.update.banner(); });
    navigator.serviceWorker.register('sw.js').then(r => { reg = r; r.update().catch(() => {}); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); }); }).catch(() => { /* sin sw: la app sigue funcionando, solo sin caché */ });
  }
  /* Actualizaciones: compara con version.js de la red (nunca de la caché). La cuenta y los datos no se tocan. */
  A.update = {
    async check() {
      try {
        const res = await fetch('version.js?c=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('http ' + res.status);
        const txt = await res.text(), m = /n:\s*'([^']+)'/.exec(txt);
        if (!m) throw new Error('formato');
        const vm = /v:\s*'([^']+)'/.exec(txt), lv = (A.version || {}).v;
        return { remote: m[1] + (vm ? ' (' + vm[1] + ')' : ''), newer: A.util.cmpVersion(m[1], A.version.n) > 0 || (A.util.cmpVersion(m[1], A.version.n) === 0 && !!vm && vm[1] !== lv) };
      } catch (e) { return { error: 'No se pudo comprobar (¿sin conexión?).' }; }
    },
    async apply() {
      applying = true;
      if (!reg) { location.reload(); return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      try { await reg.update(); } catch (e) { /* sin red: se recarga igual */ }
      if (reg.waiting) reg.waiting.postMessage('skipWaiting'); else location.reload();
    },
    /* Aviso fijo: la versión nueva ya está lista; recargar no pierde datos (todo se guarda al momento) */
    banner() {
      if (document.getElementById('upd-bar')) return;
      const b = A.ui.h('div', { id: 'upd-bar', role: 'status' }, A.ui.h('span', null, 'Hay una versión nueva de Angrep.'), A.ui.h('button', { class: 'btn sm', type: 'button', onclick: () => location.reload() }, 'Actualizar'));
      document.body.appendChild(b);
    }
  };

  function boot() {
    A.store.init();
    A.applyTheme();
    A.shell.mount(document.getElementById('app'));
    A.loginGate.require(() => A.lockUi.gate(() => { A.shell.start(); A.cloud.start(); if (A.cloud.signedIn()) A.cloud.run(); }));
    registerSW();
    A.photos.keepStorage();
    if (root.matchMedia) root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', A.applyTheme);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
