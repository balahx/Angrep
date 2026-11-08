/* Sincronización en la nube (fase 8): une el motor (sync.js) con Firebase (sync-firebase.js) y guarda en este dispositivo
   la configuración del proyecto y la sesión. Si no hay configuración o sesión, la app funciona igual, solo local. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const store = A.store; let engine = null, backend = null, started = false;
  const cfg = () => store.getLocal().syncCfg || null, auth = () => store.getLocal().syncAuth || null;
  const setAuth = a => store.setLocal({ syncAuth: a });
  function build() {
    const c = cfg(); if (!c) { engine = backend = null; return; }
    backend = A.syncFirebase.create({ cfg: c, auth: { get: auth, set: setAuth } });
    engine = A.sync.create({ store: store, backend: backend, synced: A.schema.SYNCED });
  }
  /* Primera vez en este dispositivo: usa el proyecto de js/firebase-config.js (si cambias de proyecto o lo quitas, no se vuelve a poner) */
  const seed = () => { if (A.defaultFirebase && store.getLocal().syncCfg === undefined) store.setLocal({ syncCfg: A.defaultFirebase }); };
  const C = {
    configured: () => !!cfg(), signedIn: () => !!(cfg() && auth() && auth().refresh), email: () => (auth() || {}).email || '', projectId: () => (cfg() || {}).projectId || '',
    setConfig(text) { const c = A.syncFirebase.parseConfig(text); store.setLocal({ syncCfg: c, syncAuth: null }); build(); return c; },
    clear() { store.setLocal({ syncCfg: null, syncAuth: null, sync: null }); engine = backend = null; },
    async signIn(email, pw) { if (!backend) build(); const r = await backend.signIn(String(email).trim(), pw); engine.bind(r.uid); return r; },
    signOut() { if (backend) backend.signOut(); else setAuth(null); },
    async run() { if (!C.signedIn()) return { ok: false, code: 'auth', message: 'Inicia sesión para sincronizar.' }; if (!engine) build(); engine.bind(auth().uid); return engine.run(); },
    state: () => (engine ? engine.state() : (store.getLocal().sync || {})), pending: () => (C.signedIn() && engine ? engine.pending() : 0), running: () => !!(engine && engine.isRunning()),
    start() { if (started) return; started = true; seed(); build(); A.sync.autoStart(() => { if (C.signedIn()) C.run(); }, store); }
  };
  A.cloud = C;
})(window);
