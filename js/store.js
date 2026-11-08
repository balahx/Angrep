/* Almacén local de datos. Sin DOM.
   - data  : lo que se sincroniza y se respalda (perfil + registros por tipo).
   - local : lo que es de ESTE dispositivo (id del dispositivo, tema, bloqueo con PIN, última copia).
   Regla de conflicto (para respaldo y futura sincronización): gana el registro con updatedAt más reciente. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util, S = A.schema;
  const KEY_DATA = 'appseg.v1.data', KEY_LOCAL = 'appseg.v1.local';
  let adapter = null, data = null, local = null, ok = true, corrupt = false;
  const listeners = [];

  function memoryAdapter() { const m = {}; return { name: 'memoria', get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = String(v); }, remove: k => { delete m[k]; }, keys: () => Object.keys(m) }; }
  function browserAdapter() {
    try {
      const t = '__appseg_test__'; root.localStorage.setItem(t, '1'); root.localStorage.removeItem(t);
      return { name: 'localStorage', get: k => root.localStorage.getItem(k), set: (k, v) => root.localStorage.setItem(k, v), remove: k => root.localStorage.removeItem(k) };
    } catch (e) { return memoryAdapter(); }
  }
  const emptyData = () => ({ v: 1, profile: { updatedAt: 0 }, col: {} });
  const emptyLocal = () => ({ v: 1, deviceId: U.uid(), theme: 'auto', lock: null, lastBackupAt: null });

  function readJson(key, fallback) {
    const raw = adapter.get(key);
    if (raw == null) return fallback();
    try { const o = JSON.parse(raw); if (o && typeof o === 'object') return o; } catch (e) { /* se guarda aparte abajo */ }
    /* Dato dañado: no se pierde, se aparta con otro nombre y se parte de cero */
    try { adapter.set(key + '.corrupt.' + Date.now(), raw); } catch (e) { /* sin espacio */ }
    corrupt = true;
    return fallback();
  }
  function persist() {
    try { adapter.set(KEY_DATA, JSON.stringify(data)); adapter.set(KEY_LOCAL, JSON.stringify(local)); ok = true; }
    catch (e) { ok = false; }
  }
  function emit(info) { listeners.slice().forEach(f => { try { f(info || {}); } catch (e) { /* un oyente no debe frenar el guardado */ } }); }

  function init(ad) {
    adapter = ad || browserAdapter();
    corrupt = false;
    data = readJson(KEY_DATA, emptyData);
    local = readJson(KEY_LOCAL, emptyLocal);
    if (!data.col || typeof data.col !== 'object') data.col = {};
    if (!data.profile || typeof data.profile !== 'object') data.profile = { updatedAt: 0 };
    if (!local.deviceId) local.deviceId = U.uid();
    persist();
    return api;
  }

  /* ---- Perfil (un solo registro) ---- */
  const getProfile = () => Object.assign({}, data.profile);
  function setProfile(patch) {
    data.profile = Object.assign({}, data.profile, patch, { updatedAt: Date.now(), deviceId: local.deviceId });
    persist(); emit({ type: 'profile' });
    return getProfile();
  }

  /* ---- Registros ---- */
  function col(type) { return data.col[type] || (data.col[type] = {}); }
  /* Guarda (crea o actualiza con los campos dados). Devuelve el registro o lanza Error con el motivo. */
  function save(type, obj) {
    if (!S.TYPES[type]) throw new Error('Tipo desconocido: ' + type);
    const base = Object.assign({}, obj);
    const id = S.idFor(type, base);
    const prev = col(type)[id];
    const next = Object.assign({}, prev || {}, base, { id: id, updatedAt: Date.now(), deviceId: local.deviceId });
    delete next.deleted;
    const why = S.check(type, next);
    if (why) throw new Error('Dato no válido: ' + why);
    col(type)[id] = next;
    persist(); emit({ type: type, id: id });
    return Object.assign({}, next);
  }
  const get = (type, id) => { const r = data.col[type] && data.col[type][id]; return r && !r.deleted ? Object.assign({}, r) : null; };
  function list(type, opt) {
    const all = Object.keys(data.col[type] || {}).map(k => data.col[type][k]);
    return all.filter(r => (opt && opt.deleted) || !r.deleted).map(r => Object.assign({}, r));
  }
  function remove(type, id) {
    const r = data.col[type] && data.col[type][id];
    if (!r || r.deleted) return false;
    data.col[type][id] = Object.assign({}, r, { deleted: true, updatedAt: Date.now(), deviceId: local.deviceId });
    persist(); emit({ type: type, id: id });
    return true;
  }
  /* Quita para siempre los borrados con más de `days` días (se llama con cuidado: tras sincronizar) */
  function purge(days) {
    const limit = Date.now() - days * 86400000; let n = 0;
    Object.keys(data.col).forEach(t => Object.keys(data.col[t]).forEach(id => { const r = data.col[t][id]; if (r.deleted && r.updatedAt < limit) { delete data.col[t][id]; n++; } }));
    if (n) persist();
    return n;
  }

  /* ---- Datos de este dispositivo ---- */
  const getLocal = () => Object.assign({}, local);
  function setLocal(patch) { local = Object.assign({}, local, patch); persist(); emit({ type: 'local' }); return getLocal(); }

  /* ---- Respaldo / sincronización ---- */
  /* Lo que viaja: perfil + registros de los tipos sincronizables (incluye borrados lógicos) */
  function exportable() {
    const col = {};
    S.SYNCED.forEach(t => { if (data.col[t] && Object.keys(data.col[t]).length) col[t] = JSON.parse(JSON.stringify(data.col[t])); });
    return { profile: Object.assign({}, data.profile), col: col };
  }
  /* Mezcla datos de afuera: gana el updatedAt más reciente; lo inválido se omite y se cuenta. */
  function merge(incoming) {
    const r = { added: 0, updated: 0, skipped: 0, invalid: 0, profile: false };
    if (!incoming || typeof incoming !== 'object') return r;
    const ip = incoming.profile;
    if (ip && typeof ip === 'object' && isFinite(ip.updatedAt) && ip.updatedAt > (data.profile.updatedAt || 0)) { data.profile = Object.assign({}, ip); r.profile = true; }
    const ic = incoming.col && typeof incoming.col === 'object' ? incoming.col : {};
    Object.keys(ic).forEach(type => {
      if (S.SYNCED.indexOf(type) < 0 || !ic[type] || typeof ic[type] !== 'object') return;
      Object.keys(ic[type]).forEach(id => {
        const rec = ic[type][id];
        if (!rec || typeof rec !== 'object' || !isFinite(rec.updatedAt)) { r.invalid++; return; }
        if (S.idFor(type, rec) !== id || rec.id !== id) { r.invalid++; return; }
        if (!rec.deleted && S.check(type, rec)) { r.invalid++; return; }
        const mine = col(type)[id];
        if (!mine) { col(type)[id] = JSON.parse(JSON.stringify(rec)); r.added++; }
        else if (rec.updatedAt > mine.updatedAt) { col(type)[id] = JSON.parse(JSON.stringify(rec)); r.updated++; }
        else r.skipped++;
      });
    });
    persist(); emit({ type: 'merge' });
    return r;
  }
  /* Cuenta de registros vivos por tipo */
  function counts() { const c = {}; Object.keys(data.col).forEach(t => { const n = list(t).length; if (n) c[t] = n; }); return c; }
  /* Borra todos los datos de este dispositivo (conserva su id) */
  function wipe() {
    const id = local.deviceId;
    data = emptyData(); local = Object.assign(emptyLocal(), { deviceId: id });
    persist(); emit({ type: 'wipe' });
  }

  const on = f => { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; };
  const api = { init, getProfile, setProfile, save, get, list, remove, purge, getLocal, setLocal, exportable, merge, counts, wipe, on, memoryAdapter,
    status: () => ({ ok: ok, adapter: adapter && adapter.name, corrupt: corrupt }) };
  A.store = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
