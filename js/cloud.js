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
    /* Cuenta nueva: crea, avisa por correo para verificar y deja la sesión iniciada */
    async signUp(email, pw) { if (!backend) build(); const r = await backend.signUp(String(email).trim(), pw); engine.bind(r.uid); try { await backend.sendVerification(); } catch (e) { /* se puede reenviar después */ } return r; },
    resetPassword(email) { if (!backend) build(); return backend.resetPassword(String(email).trim()); },
    resendVerification() { if (!backend) build(); return backend.sendVerification(); },
    verified() { return C.signedIn() ? (backend || (build(), backend)).verified() : Promise.resolve(null); },
    /* Cuenta distinta a la que usó este dispositivo: sus datos locales son de otra persona */
    prevUid: () => store.getLocal().syncOwner || (store.getLocal().sync || {}).uid || null,
    switchAccount() { const l = store.getLocal(), keep = { syncCfg: l.syncCfg, syncAuth: l.syncAuth, syncLastEmail: l.syncLastEmail, sync: { uid: (l.syncAuth || {}).uid } }; store.wipe(); store.setLocal(keep); build(); },
    /* ---- Accesos ---- */
    isAdmin: () => { const a = auth(), ad = (A.defaultFirebase || {}).adminEmail; return !!(a && a.email && ad && String(a.email).toLowerCase() === String(ad).toLowerCase()); },
    cachedOk: () => { const c = store.getLocal().syncAccess, a = auth(); return !!(c && a && c.uid === a.uid && c.ok); },
    /* Estado del acceso: ok | unverified | pending | rejected | offline | error */
    async access() {
      const a = auth(); if (!a) return { state: 'error', message: 'Inicia sesión.' }; if (!backend) build();
      const ok = pl => { store.setLocal({ syncAccess: { uid: a.uid, ok: true, plan: !!pl } }); setTimeout(() => { if (A.coach) A.coach.refresh().catch(() => {}); }, 0); return { state: 'ok' }; }, no = st => { store.setLocal({ syncAccess: { uid: a.uid, ok: false } }); if (A.coach) A.coach.clear(); return { state: st }; };
      if (C.isAdmin()) return ok(true);
      try {
        const mem = await backend.getDoc('members/' + a.uid); if (mem) return ok(mem.plan === true);
        const r = await backend.getDoc('requests/' + a.uid);
        if (r) return no(r.status === 'rejected' ? 'rejected' : 'pending');
        const u = await backend.lookup(); if (!u) return { state: 'error', message: 'Firebase no encuentra esta cuenta. Cierra sesión y vuelve a entrar.' };
        /* La solicitud se crea aunque el correo no esté verificado (el administrador decide); si las reglas publicadas todavía lo exigen, se pide verificar */
        try { await backend.createRequest(a.email); return no('pending'); }
        catch (e) { if (e && e.status === 403 && !u.emailVerified) { const x = no('unverified'); x.message = 'Abre el enlace que te enviamos por correo (revisa también el spam) y luego toca «Ya lo verifiqué». Firebase todavía registra «' + u.email + '» como no verificado (' + new Date().toLocaleTimeString('es-CL') + ').'; return x; } throw e; }
      } catch (e) { if (e && e.code === 'offline') return { state: C.cachedOk() ? 'ok' : 'offline' }; if (e && e.code === 'auth') return { state: 'error', message: e.message }; return { state: 'error', message: e && e.message || 'No se pudo comprobar tu acceso.' }; }
    },
    async askAgain() { if (!backend) build(); try { await backend.deleteRequest(); } catch (e) { /* ya no estaba */ } return C.access(); },
    admin: {
      async list() { if (!backend) build(); const r = await Promise.all([backend.listDocs('requests'), backend.listDocs('members')]); return { requests: r[0], members: r[1] }; },
      setPlanAccess: (id, on) => backend.setMemberPlan(id, on),
      approve: (id, email) => backend.approve(id, email), reject: id => backend.reject(id), remove: id => backend.removeMember(id), dismiss: id => backend.deleteRequest(id)
    },
    signOut() { if (backend) backend.signOut(); else setAuth(null); store.setLocal({ syncAccess: null }); },
    async diagnose() { if (!C.signedIn()) return [{ paso: 'Sesión', ok: false, detalle: 'Inicia sesión primero.' }]; if (!backend) build(); return backend.diagnose(); },
    /* ¿Puede ver el plan del entrenador? (el administrador siempre; los demás si el administrador se lo dio) */
    canPlan() { const s = store.getLocal().syncAccess, a = auth(); return !!(C.signedIn() && a && (C.isAdmin() || (s && s.uid === a.uid && s.ok && s.plan))); },
    plan: {
      meta: async () => { if (!backend) build(); return backend.getDoc('config/plan'); },
      data: async () => { if (!backend) build(); return backend.getDoc('plans/data'); },
      publish: async (meta, z) => { if (!backend) build(); return backend.setPlan(meta, z); },
      remove: async () => { if (!backend) build(); return backend.deletePlan(); }
    },
    async run() { if (!C.signedIn()) return { ok: false, code: 'auth', message: 'Inicia sesión para sincronizar.' }; if (!engine) build(); engine.bind(auth().uid); return engine.run(); },
    state: () => (engine ? engine.state() : (store.getLocal().sync || {})), pending: () => (C.signedIn() && engine ? engine.pending() : 0), running: () => !!(engine && engine.isRunning()),
    start() { if (started) return; started = true; seed(); build(); A.sync.autoStart(() => { if (C.signedIn()) C.run(); }, store); }
  };
  A.cloud = C;
})(window);
