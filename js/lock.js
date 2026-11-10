/* Bloqueo con PIN (lógica, sin DOM). Es un candado de pantalla de ESTE dispositivo: no cifra los datos.
   El PIN y el código de recuperación se guardan solo como huella PBKDF2-SHA256 con sal propia.
   Tras 5 fallos seguidos hay que esperar (30 s, luego el doble cada 5 fallos, hasta 15 min). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const store = A.store;
  const ITER = 150000, ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const TIMEOUTS = [0, 1, 5, 15];   // minutos fuera de la app antes de volver a pedir el PIN (0 = siempre)

  const b64 = buf => btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buf))));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const canHash = () => !!(root.crypto && root.crypto.subtle);
  async function derive(secret, saltB64, iters) {
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
    return b64(await root.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iters }, key, 256));
  }
  const newSalt = () => b64(root.crypto.getRandomValues(new Uint8Array(16)));
  const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };
  const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function makeCode() {
    /* Muestreo por rechazo: se descartan los bytes que darían más peso a unos caracteres (256 no es múltiplo de ALPHA.length). */
    const lim = 256 - (256 % ALPHA.length);
    let s = '';
    while (s.length < 12) root.crypto.getRandomValues(new Uint8Array(24)).forEach(b => { if (b < lim && s.length < 12) s += ALPHA[b % ALPHA.length]; });
    return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
  }
  const lockState = () => store.getLocal().lock;
  const setLock = patch => store.setLocal({ lock: Object.assign({}, lockState(), patch) });
  const enabled = () => !!lockState();
  const validPin = p => /^\d{4,6}$/.test(String(p));

  async function secretRecord(secret) { const salt = newSalt(); return { salt: salt, hash: await derive(secret, salt, ITER), iters: ITER }; }

  /* Activa el PIN. Devuelve el código de recuperación (se muestra una sola vez). */
  async function enable(pin) {
    if (!canHash()) throw new Error('Este navegador no permite crear el PIN aquí (necesita una dirección segura, https).');
    if (!validPin(pin)) throw new Error('El PIN debe tener de 4 a 6 números.');
    const code = makeCode(), p = await secretRecord(pin), r = await secretRecord(normCode(code));
    store.setLocal({ lock: { salt: p.salt, hash: p.hash, iters: p.iters, rsalt: r.salt, rhash: r.hash, riters: r.iters, timeout: 0, fails: 0, until: 0 } });
    return code;
  }
  /* Tiempo de espera vigente en segundos (0 si puede intentar) */
  function waitLeft(now) { const l = lockState(); return l && l.until > (now || Date.now()) ? Math.ceil((l.until - (now || Date.now())) / 1000) : 0; }
  async function verify(pin, now) {
    const l = lockState(); if (!l) return { ok: true };
    const w = waitLeft(now); if (w) return { ok: false, wait: w };
    if (validPin(pin) && same(await derive(String(pin), l.salt, l.iters), l.hash)) { setLock({ fails: 0, until: 0 }); return { ok: true }; }
    const fails = (l.fails || 0) + 1;
    const until = fails % 5 === 0 ? (now || Date.now()) + Math.min(900, 30 * Math.pow(2, fails / 5 - 1)) * 1000 : 0;
    setLock({ fails: fails, until: until });
    return { ok: false, wait: until ? waitLeft(now) : 0, left: until ? 0 : 5 - (fails % 5) };
  }
  /* Con el código de recuperación se quita el PIN (los datos no se tocan) */
  async function recover(code) {
    const l = lockState(); if (!l) return { ok: true };
    if (same(await derive(normCode(code), l.rsalt, l.riters), l.rhash)) { disable(); return { ok: true }; }
    return { ok: false };
  }
  async function change(oldPin, newPin) {
    const v = await verify(oldPin); if (!v.ok) return v;
    if (!validPin(newPin)) throw new Error('El PIN debe tener de 4 a 6 números.');
    const p = await secretRecord(newPin); setLock({ salt: p.salt, hash: p.hash, iters: p.iters });
    return { ok: true };
  }
  async function newRecovery() { const code = makeCode(), r = await secretRecord(normCode(code)); setLock({ rsalt: r.salt, rhash: r.hash, riters: r.iters }); return code; }
  const disable = () => store.setLocal({ lock: null });
  function setTimeoutMin(m) { if (TIMEOUTS.indexOf(m) < 0) throw new Error('Tiempo no válido'); setLock({ timeout: m }); }
  const timeoutMin = () => { const l = lockState(); return l ? l.timeout : 0; };

  const api = { TIMEOUTS, canHash, enabled, enable, verify, recover, change, newRecovery, disable, setTimeoutMin, timeoutMin, waitLeft, validPin };
  A.lock = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
