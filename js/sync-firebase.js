/* Backend de Firebase por REST (sin el SDK, para mantener la app liviana y sin dependencias externas):
   - Acceso: Firebase Authentication con correo y contraseña (identitytoolkit / securetoken).
   - Datos: Firestore, colección users/{uid}/records/{clave} con { t, d, u, del, at }. `at` lo pone el servidor (hora del servidor),
     y sirve para pedir «lo que cambió desde la última vez». Sin Cloud Functions. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const HOSTS = { auth: 'https://identitytoolkit.googleapis.com', token: 'https://securetoken.googleapis.com', db: 'https://firestore.googleapis.com' };
  const PAGE = 500;
  const MSG = {
    EMAIL_NOT_FOUND: 'Correo o contraseña incorrectos.', INVALID_PASSWORD: 'Correo o contraseña incorrectos.', INVALID_LOGIN_CREDENTIALS: 'Correo o contraseña incorrectos.',
    USER_DISABLED: 'Esta cuenta está deshabilitada.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Espera unos minutos.', INVALID_EMAIL: 'El correo no es válido.',
    API_KEY_INVALID: 'La apiKey no es válida. Revisa la configuración de Firebase.', 'API key not valid. Please pass a valid API key.': 'La apiKey no es válida. Revisa la configuración de Firebase.'
  };
  /* Compara dos marcas de tiempo de Firestore («2026-11-08T12:00:01.5Z», con fracción variable): -1, 0 o 1 */
  const cmpTs = (a, b) => { const sp = t => { const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/.exec(String(t)); return m ? [Date.parse(m[1] + 'Z'), (m[2] || '').padEnd(9, '0')] : [0, '']; }, x = sp(a), y = sp(b);
    return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0; };
  const mkErr = (code, message) => { const e = new Error(message); e.code = code; return e; };

  /* Valida y extrae lo necesario del texto pegado desde la consola de Firebase («const firebaseConfig = { … }» o JSON) */
  function parseConfig(text) {
    const t = String(text || ''), get = k => { const m = new RegExp('[\'"]?' + k + '[\'"]?\\s*:\\s*[\'"]([^\'"]+)[\'"]').exec(t); return m ? m[1].trim() : ''; };
    const cfg = { apiKey: get('apiKey'), projectId: get('projectId') };
    if (!cfg.apiKey || !cfg.projectId) throw new Error('No encuentro apiKey y projectId en lo que pegaste. Copia el bloque «firebaseConfig» completo.');
    if (!/^[A-Za-z0-9_\-]{20,80}$/.test(cfg.apiKey)) throw new Error('La apiKey no tiene el formato esperado.');
    if (!/^[a-z0-9][a-z0-9\-]{3,60}$/.test(cfg.projectId)) throw new Error('El projectId no tiene el formato esperado.');
    return cfg;
  }

  /* o: { cfg:{apiKey,projectId}, auth:{ get(), set(a|null) }, fetch, hosts, now } */
  function create(o) {
    const f = o.fetch || ((u, i) => root.fetch(u, i)), hosts = Object.assign({}, HOSTS, o.hosts || {}), now = o.now || Date.now;
    let idToken = null, exp = 0;
    const key = encodeURIComponent(o.cfg.apiKey);

    async function call(url, init) {
      let res; try { res = await f(url, init); } catch (e) { throw mkErr('offline', 'Sin conexión.'); }
      let body = null; try { body = await res.json(); } catch (e) { /* respuesta sin JSON */ }
      if (!res.ok) { const raw = body && body.error && (body.error.message || body.error.status) || ''; const k = String(raw).split(' ')[0]; const msg = MSG[raw] || MSG[k] || (res.status === 403 ? 'Sin permiso en Firestore. Revisa las reglas.' : res.status === 404 ? 'No encuentro la base de datos Firestore del proyecto.' : 'Error ' + res.status + (raw ? ': ' + raw : '') + '.');
        throw Object.assign(mkErr(res.status === 401 || /TOKEN|CREDENTIAL|USER_NOT_FOUND/.test(raw) ? 'auth' : res.status === 403 ? 'rules' : 'http', msg), { status: res.status, raw: raw }); }
      return body;
    }
    const json = (url, body, headers) => call(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}), body: JSON.stringify(body) });

    async function signIn(email, password) {
      const r = await json(hosts.auth + '/v1/accounts:signInWithPassword?key=' + key, { email: email, password: password, returnSecureToken: true });
      idToken = r.idToken; exp = now() + (+r.expiresIn || 3600) * 1000; o.auth.set({ uid: r.localId, email: email, refresh: r.refreshToken });
      return { uid: r.localId, email: email };
    }
    async function token() {
      if (idToken && exp > now() + 60000) return idToken;
      const a = o.auth.get(); if (!a || !a.refresh) throw mkErr('auth', 'Inicia sesión para sincronizar.');
      let r; try { r = await call(hosts.token + '/v1/token?key=' + key, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(a.refresh) }); }
      catch (e) { if (e.code === 'auth' || e.code === 'http') { o.auth.set(null); throw mkErr('auth', 'Tu sesión venció. Vuelve a iniciar sesión.'); } throw e; }
      idToken = r.id_token; exp = now() + (+r.expires_in || 3600) * 1000; if (r.refresh_token && r.refresh_token !== a.refresh) o.auth.set(Object.assign({}, a, { refresh: r.refresh_token }));
      return idToken;
    }
    const docs = () => 'projects/' + o.cfg.projectId + '/databases/(default)/documents';
    const authed = async (url, body) => { const t = await token(); try { return await json(url, body, { Authorization: 'Bearer ' + t }); } catch (e) { if (e.status === 401) { idToken = null; exp = 0; const t2 = await token(); return json(url, body, { Authorization: 'Bearer ' + t2 }); } throw e; } };
    const uid = () => { const a = o.auth.get(); if (!a || !a.uid) throw mkErr('auth', 'Inicia sesión para sincronizar.'); return a.uid; };

    async function push(recs) {
      const u = uid(), base = docs() + '/users/' + u + '/records/';
      const writes = recs.map(r => ({ update: { name: base + r.key, fields: { t: { stringValue: r.type }, d: { stringValue: r.d }, u: { integerValue: String(r.u) }, del: { booleanValue: !!r.del } } }, updateTransforms: [{ fieldPath: 'at', setToServerValue: 'REQUEST_TIME' }] }));
      await authed(hosts.db + '/v1/' + docs() + ':commit', { writes: writes });
    }
    async function pull(cursor) {
      const u = uid(), out = [], seen = {}; let cur = cursor || null, maxAt = cursor || null;
      for (let guard = 0; guard < 200; guard++) {
        const q = { from: [{ collectionId: 'records' }], orderBy: [{ field: { fieldPath: 'at' }, direction: 'ASCENDING' }], limit: PAGE };
        if (cur) q.where = { fieldFilter: { field: { fieldPath: 'at' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: cur } } };
        const rows = await authed(hosts.db + '/v1/' + docs() + '/users/' + u + ':runQuery', { structuredQuery: q }), got = (rows || []).filter(r => r.document);
        got.forEach(r => { const fl = r.document.fields || {}, key = r.document.name.split('/').pop(), at = fl.at && fl.at.timestampValue;
          if (!fl.d || !fl.u) return; const rec = { key: key, d: fl.d.stringValue, u: +fl.u.integerValue, at: at }; if (at && (!maxAt || cmpTs(at, maxAt) > 0)) maxAt = at;
          if (!seen[key]) { seen[key] = 1; out.push(rec); } });
        if (got.length < PAGE) break;
        const last = got[got.length - 1].document.fields.at.timestampValue; if (last === cur) break; cur = last;
      }
      return { records: out, cursor: maxAt };
    }
    return { signIn, signOut: () => { idToken = null; exp = 0; o.auth.set(null); }, push, pull, token };
  }

  A.syncFirebase = { create, parseConfig, cmpTs, HOSTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = A.syncFirebase;
})(typeof window !== 'undefined' ? window : globalThis);
