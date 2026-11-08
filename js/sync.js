/* Motor de sincronización (fase 8). Independiente de Firebase: habla con un «backend» con dos funciones,
     backend.pull(cursor) → { records: [{ key, d, u, at }], cursor }   (todo lo que cambió desde `cursor`)
     backend.push(records)                                           (records: [{ key, type, d, u, del }])
   Cada registro viaja como { key, d: JSON del registro, u: updatedAt }. Gana el `updatedAt` más reciente (el mismo criterio del respaldo).
   Primero baja lo nuevo, luego sube lo propio. Lo que ya se sabe en la nube (clave → u) se recuerda para no volver a subirlo. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const FUTURE = 10 * 60000, BATCH = 400;

  const keyOf = (type, id) => type + '__' + id;
  const splitKey = k => { const i = k.indexOf('__'); return i < 0 ? null : [k.slice(0, i), k.slice(i + 2)]; };

  function create(opts) {
    const store = opts.store, backend = opts.backend, now = opts.now || Date.now, SYNCED = opts.synced;
    let running = null;
    const st = () => Object.assign({ known: {}, pullAt: null, lastRun: null, lastOk: null, error: null, pulled: 0, pushed: 0 }, (store.getLocal().sync || {}));
    const save = patch => store.setLocal({ sync: Object.assign(st(), patch) });

    /* Lo que hay que subir: todo registro cuya versión (u) no coincide con la que la nube ya tiene */
    function collect() {
      const known = st().known, ex = store.exportable(), out = [];
      if (ex.profile && ex.profile.updatedAt && known.profile !== ex.profile.updatedAt) out.push({ key: 'profile', type: 'profile', d: JSON.stringify(ex.profile), u: ex.profile.updatedAt, del: false });
      Object.keys(ex.col).forEach(type => Object.keys(ex.col[type]).forEach(id => {
        const r = ex.col[type][id], k = keyOf(type, id); if (!isFinite(r.updatedAt) || known[k] === r.updatedAt) return;
        out.push({ key: k, type: type, d: JSON.stringify(r), u: r.updatedAt, del: !!r.deleted });
      }));
      return out;
    }
    const pending = () => collect().length;

    async function pull() {
      const s = st(), res = await backend.pull(s.pullAt), inc = { profile: null, col: {} }, seen = {}, t = now();
      let skipped = 0;
      (res.records || []).forEach(r => {
        let rec; try { rec = JSON.parse(r.d); } catch (e) { skipped++; return; }
        if (!rec || typeof rec !== 'object' || !isFinite(rec.updatedAt) || rec.updatedAt > t + FUTURE) { skipped++; return; }
        if (r.key === 'profile') { inc.profile = rec; seen.profile = rec.updatedAt; return; }
        const p = splitKey(String(r.key)); if (!p || SYNCED.indexOf(p[0]) < 0) { skipped++; return; }
        (inc.col[p[0]] = inc.col[p[0]] || {})[p[1]] = rec; seen[r.key] = rec.updatedAt;
      });
      const m = (Object.keys(seen).length) ? store.merge(inc) : { added: 0, updated: 0, skipped: 0, invalid: 0 };
      const known = Object.assign({}, s.known, seen);
      save({ known: known, pullAt: res.cursor || s.pullAt });
      return { got: Object.keys(seen).length, applied: m.added + m.updated + (m.profile ? 1 : 0), skipped: skipped + m.invalid };
    }

    async function push() {
      const recs = collect(); let sent = 0;
      for (let i = 0; i < recs.length; i += BATCH) {
        const chunk = recs.slice(i, i + BATCH); await backend.push(chunk);
        const known = Object.assign({}, st().known); chunk.forEach(r => { known[r.key] = r.u; }); save({ known: known }); sent += chunk.length;
      }
      return sent;
    }

    /* Una vuelta completa. Si ya hay una en marcha devuelve esa misma. */
    function run() {
      if (running) return running;
      running = (async () => {
        const t = now(); save({ lastRun: t });
        try { const a = await pull(), sent = await push(); save({ lastOk: now(), error: null, pulled: a.applied, pushed: sent }); return { ok: true, pulled: a.applied, pushed: sent, skipped: a.skipped }; }
        catch (e) { save({ error: e && e.code ? e.code : 'error', errorText: e && e.message || 'Error al sincronizar' }); return { ok: false, code: e && e.code || 'error', message: e && e.message || 'Error al sincronizar' }; }
        finally { running = null; }
      })();
      return running;
    }
    const reset = () => save({ known: {}, pullAt: null, error: null, errorText: null });
    /* Si cambia la cuenta, lo que se «sabía» de la nube de la cuenta anterior ya no vale */
    const bind = uid => { if (st().uid !== uid) save({ uid: uid, known: {}, pullAt: null, error: null, errorText: null }); };
    return { run, collect, pending, pull, push, state: st, reset, bind, isRunning: () => !!running };
  }

  /* Programa las vueltas solas: al cambiar datos (con pausa), al volver la conexión, al volver a la app y cada 5 minutos */
  function autoStart(runFn, store, env) {
    env = env || root; let timer = null;
    const soon = ms => { clearTimeout(timer); timer = setTimeout(() => { if (store.getLocal().syncAuto !== false && (env.navigator ? env.navigator.onLine !== false : true)) runFn(); }, ms); };
    store.on(e => { if (e.type === 'local' || e.type === 'merge' || e.type === 'wipe') return; soon(4000); });
    if (env.addEventListener) { env.addEventListener('online', () => soon(500)); env.document && env.document.addEventListener('visibilitychange', () => { if (env.document.visibilityState === 'visible') soon(800); }); }
    setInterval(() => soon(100), 5 * 60000); soon(1500);
  }

  A.sync = { create, autoStart, keyOf, splitKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = A.sync;
})(typeof window !== 'undefined' ? window : globalThis);
