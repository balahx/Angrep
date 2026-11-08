/* Respaldo personal: exportar e importar todos los datos en un archivo .json. Sin DOM (la descarga se hace en la pantalla).
   Importar mezcla con lo que ya hay (gana el más reciente), así que importar dos veces el mismo archivo no duplica nada. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util, store = A.store;
  const FORMAT = 'app-seguimiento-respaldo', VERSION = 1, MAX_CHARS = 25 * 1024 * 1024;

  function build() {
    const x = store.exportable(), loc = store.getLocal();
    const counts = {}; Object.keys(x.col).forEach(t => { counts[t] = Object.keys(x.col[t]).filter(k => !x.col[t][k].deleted).length; });
    return { format: FORMAT, v: VERSION, createdAt: new Date().toISOString(), app: (A.version && A.version.n) || '', deviceId: loc.deviceId, counts: counts, profile: x.profile, col: x.col };
  }
  const fileName = d => { const t = d || new Date(); return 'seguimiento-respaldo-' + U.ymd(t) + '.json'; };
  /* ¿De qué es este archivo? 'app' | 'halterofilia' | null */
  function detect(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    if (o.format === FORMAT) return 'app';
    /* Respaldo personal de la app Halterofilia: { v, profile, exercises[], plan:{days[]}, sessions[] } */
    if (Array.isArray(o.exercises) && Array.isArray(o.sessions) && o.plan && Array.isArray(o.plan.days)) return 'halterofilia';
    return null;
  }
  /* Importa un texto JSON. Devuelve { kind, ... }. Lanza Error con un mensaje claro si no se puede. */
  function importText(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('El archivo está vacío.');
    if (text.length > MAX_CHARS) throw new Error('El archivo es demasiado grande.');
    let o;
    try { o = JSON.parse(text.replace(/^﻿/, '')); } catch (e) { throw new Error('No es un archivo JSON válido.'); }
    const kind = detect(o);
    if (kind === 'halterofilia') return { kind: kind, pending: true };
    if (kind !== 'app') throw new Error('No reconozco este archivo. Debe ser un respaldo de esta app.');
    if (o.v > VERSION) throw new Error('El respaldo es de una versión más nueva de la app. Actualiza la app y vuelve a intentar.');
    const res = store.merge({ profile: o.profile, col: o.col });
    store.save('importlog', { source: 'respaldo-app', at: Date.now(), summary: res });
    return { kind: kind, result: res };
  }

  const api = { FORMAT, VERSION, build, fileName, detect, importText };
  A.backup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
