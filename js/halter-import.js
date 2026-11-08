/* Importación desde la app Halterofilia (fase 5). Lógica pura: no toca el DOM ni guarda nada; `prepare` arma las operaciones
   y `apply` las guarda en el store. Acepta el respaldo personal (JSON: { v:1, profile, exercises[], plan:{days[]}, sessions[] })
   y el historial en CSV (separador «;», coma decimal). Reimportar no duplica: cada sesión lleva `srcKey`. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const S = A.schema || (typeof require !== 'undefined' ? require('./schema.js') : null);
  const DISC = 'halterofilia', num = v => typeof v === 'number' && isFinite(v);
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
  const numOf = v => { if (num(v)) return v; if (v == null || v === '') return null; const n = U.parseNum(String(v)); return n == null || !isFinite(n) ? null : n; };
  const r1 = n => Math.round(n * 10) / 10;

  /* «3» → 3, «1+1» → 2, «2+1+1» → 4, «3-5» → 3; sin números → null */
  function parseReps(v) {
    if (num(v)) return v > 0 ? Math.round(v) : null;
    const m = String(v == null ? '' : v).match(/\d+/g); if (!m) return null;
    return String(v).indexOf('+') >= 0 ? m.reduce((t, x) => t + (+x), 0) : +m[0];
  }
  /* «90», «1:30» → segundos */
  function parseSecs(v) {
    if (num(v)) return v > 0 ? Math.round(v) : 0;
    const t = String(v == null ? '' : v).trim(); if (!t) return 0;
    const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t); if (m) return +m[1] * 60 + +m[2];
    return /^\d{1,5}$/.test(t) ? +t : 0;
  }
  const isBackup = o => !!o && typeof o === 'object' && o.v === 1 && Array.isArray(o.sessions) && Array.isArray(o.exercises) && !!o.plan && Array.isArray(o.plan.days);

  /* Series de Halterofilia → series de esta app. Cuenta las hechas y las falladas (done:false, miss:true). */
  function convSets(sets) {
    const out = [];
    (sets || []).forEach(x => {
      if (!x || !(x.done || x.miss)) return;
      const kg = numOf(x.kg), secs = parseSecs(x.secs), reps = parseReps(x.reps) || 0;
      if (!reps && !secs) return;
      const o = { kg: kg != null && kg >= 0 && kg <= 1000 ? kg : 0, reps: reps, done: !x.miss };
      const pct = numOf(x.pct), rpe = numOf(x.rpe);
      if (pct > 0) o.pct = pct; if (rpe != null && rpe >= 0 && rpe <= 10) o.rpe = rpe; if (x.miss) o.miss = true; if (secs) o.secs = secs;
      out.push(o);
    });
    return out;
  }
  const meanRpe = items => { const v = []; items.forEach(it => it.sets.forEach(s => { if (s.done && num(s.rpe)) v.push(s.rpe); })); return v.length ? r1(v.reduce((t, x) => t + x, 0) / v.length) : null; };

  /* Contexto: lo que ya existe (incluye lo borrado, para no resucitarlo) */
  const ctxOf = store => ({
    exercises: store.list('exercise', { deleted: true }), sessions: store.list('session', { deleted: true }), plans: store.list('plan'),
    weights: store.list('weight', { deleted: true }), profile: store.getProfile()
  });

  /* Une ejercicios: por id de Halterofilia, o por nombre con uno que ya tengas. Devuelve { map, ops, stat } */
  function matchExercises(list, used, ctx) {
    const have = ctx.exercises.filter(e => e.discipline === DISC), byId = {}, byName = {}; have.forEach(e => { byId[e.id] = e; byName[norm(e.name)] = e; });
    const map = {}, ops = [], stat = { add: 0, update: 0, skip: 0 }, seen = {};
    list.forEach(e => {
      if (!e || !e.name || !e.id) return;
      const isUsed = used[e.id], hasMax = num(e.max) && e.max > 0;
      if (!isUsed && !hasMax && e.builtin === true) return;          // catálogo base sin uso ni máximo: no se trae
      const id = 'hal_' + e.id, mine = byId[id] || byName[norm(e.name)];
      const max = hasMax && e.max <= 1000 ? e.max : null;
      if (mine) {
        map[e.id] = mine.id;
        if (!mine.deleted && max != null && !(mine.max > 0)) { ops.push({ type: 'exercise', rec: { id: mine.id, max: max, maxDate: e.maxDate || null } }); stat.update++; } else stat.skip++;
        return;
      }
      if (seen[norm(e.name)]) { map[e.id] = seen[norm(e.name)]; return; }
      const rec = { id: id, name: String(e.name).slice(0, 120), discipline: DISC, meas: S.MEAS.indexOf(e.meas) >= 0 ? e.meas : 'kg', max: max, maxDate: max != null ? (e.maxDate || null) : null, rest: num(e.rest) && e.rest >= 10 && e.rest <= 900 ? Math.round(e.rest) : null, cat: e.cat || null, source: 'halterofilia' };
      if (num(e.goal) && e.goal > 0) { rec.goal = e.goal; rec.goalDate = e.goalDate || null; }
      map[e.id] = id; seen[norm(e.name)] = id; ops.push({ type: 'exercise', rec: rec }); stat.add++;
    });
    return { map: map, ops: ops, stat: stat, names: have };
  }

  function fromJson(o, ctx, opts) {
    const warnings = [], ops = [], sum = { exercises: { add: 0, update: 0, skip: 0 }, sessions: { add: 0, skip: 0, invalid: 0 }, weights: { add: 0, skip: 0 }, plan: 'none', profile: false };
    const ended = o.sessions.filter(s => s && s.endedAt && U.isYmd(s.date));
    const used = {}; ended.forEach(s => (s.items || []).forEach(it => { used[it.exId] = 1; }));
    (o.plan.days || []).forEach(d => (d.items || []).forEach(p => { used[p.exId] = 1; }));
    const exName = {}; o.exercises.forEach(e => { exName[e.id] = e.name; });
    const ex = matchExercises(o.exercises, used, ctx); sum.exercises = ex.stat; ex.ops.forEach(x => ops.push(x));
    const nameOf = id => { const t = ctx.exercises.filter(e => e.id === ex.map[id])[0]; return t ? t.name : (exName[id] || 'Ejercicio'); };

    /* sesiones */
    const have = {}; ctx.sessions.forEach(s => { if (s.srcKey) have[s.srcKey] = 1; });
    ended.forEach(s => {
      const key = 'hal:' + s.id;
      if (have[key]) { sum.sessions.skip++; return; }
      const items = (s.items || []).map(it => ({ exId: ex.map[it.exId] || 'hal_' + it.exId, name: nameOf(it.exId), rest: num(it.rest) && it.rest > 0 ? it.rest : null, sets: convSets(it.sets) })).filter(it => it.sets.length);
      if (!items.length) { sum.sessions.invalid++; return; }
      const rec = { id: 'hal_' + s.id, discipline: DISC, date: s.date, mode: 'live', items: items, rpe: meanRpe(items), notes: s.notes ? String(s.notes).slice(0, 2000) : null, startedAt: num(s.startedAt) ? s.startedAt : null, endedAt: num(s.endedAt) ? s.endedAt : null, dayName: s.name || null, source: 'halterofilia', srcKey: key };
      if (num(s.bw) && s.bw > 0) rec.bw = s.bw;
      ops.push({ type: 'session', rec: rec }); sum.sessions.add++;
    });

    /* rutina semanal: índice 0 = lunes */
    const days = [];
    (o.plan.days || []).forEach((d, i) => {
      if (!d || !(d.on || (d.items || []).length)) return;
      const items = (d.items || []).filter(p => p && ex.map[p.exId]).map(p => { const it = { exId: ex.map[p.exId], sets: num(+p.sets) && +p.sets > 0 ? Math.round(+p.sets) : 3, reps: parseReps(p.reps) || null };
        if (numOf(p.pct) > 0) it.pct = numOf(p.pct); else if (numOf(p.kg) > 0) it.kg = numOf(p.kg); return it; });
      days.push({ id: 'hal_d' + i, name: String(d.name || 'Día ' + (i + 1)).slice(0, 60), dow: (i + 1) % 7, items: items });
    });
    if (days.length) {
      const cur = ctx.plans.filter(p => p.discipline === DISC)[0];
      if (!cur) { ops.push({ type: 'plan', rec: { name: 'Rutina de halterofilia', discipline: DISC, kind: 'weekly', days: days, source: 'halterofilia' } }); sum.plan = 'add'; }
      else if (opts && opts.replacePlan) { ops.push({ type: 'plan', rec: { id: cur.id, name: cur.name, discipline: DISC, kind: 'weekly', days: days, source: 'halterofilia' } }); sum.plan = 'replace'; }
      else { sum.plan = 'skip'; warnings.push('Ya tienes una rutina de halterofilia; no se cambió. Puedes marcar «Reemplazar mi rutina» para usar la de Halterofilia.'); }
    }

    /* peso corporal */
    const wHave = {}; ctx.weights.forEach(w => { wHave[w.date] = 1; });
    const log = o.profile && Array.isArray(o.profile.bwLog) ? o.profile.bwLog : [];
    log.forEach(x => { if (!x || !U.isYmd(x.d) || !num(x.kg) || x.kg < 20 || x.kg > 400) return; if (wHave[x.d]) { sum.weights.skip++; return; } wHave[x.d] = 1; ops.push({ type: 'weight', rec: { date: x.d, kg: x.kg, source: 'halterofilia' } }); sum.weights.add++; });

    /* perfil: solo lo que falta */
    const patch = {}; if (o.profile && (o.profile.sex === 'M' || o.profile.sex === 'F') && !ctx.profile.sex) patch.sex = o.profile.sex;
    if (o.profile && o.profile.name && !ctx.profile.name) patch.name = String(o.profile.name).slice(0, 60);
    if (Object.keys(patch).length) { ops.push({ profile: patch }); sum.profile = true; }
    if (!ended.length && !sum.exercises.add && !days.length) warnings.push('El respaldo no trae sesiones terminadas ni rutina.');
    return { kind: 'json', ops: ops, summary: sum, warnings: warnings, hasPlan: !!ctx.plans.filter(p => p.discipline === DISC)[0] };
  }

  /* ---------- CSV ---------- */
  function parseCsv(text) {
    const t = String(text).replace(/^﻿/, ''), first = t.split(/\r?\n/)[0] || '', sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x !== '')) rows.push(row); row = []; }
      else cell += c;
    }
    row.push(cell); if (row.some(x => x !== '')) rows.push(row);
    return rows;
  }
  function fromCsv(text, ctx) {
    const rows = parseCsv(text), head = (rows[0] || []).map(norm), col = n => head.indexOf(n);
    if (col('fecha') < 0 || col('ejercicio') < 0 || col('repeticiones') < 0) throw new Error('El CSV no tiene las columnas de Halterofilia (fecha, sesion, ejercicio, serie, kg, repeticiones…).');
    const get = (r, n) => { const i = col(n); return i < 0 ? '' : (r[i] || '').trim(); }, yes = v => norm(v) === 'si' || norm(v) === 'yes' || v === '1';
    const bySession = {}, order = [], names = {};
    rows.slice(1).forEach(r => { const d = get(r, 'fecha'); if (!U.isYmd(d)) return; const k = d + '|' + get(r, 'sesion'); if (!bySession[k]) { bySession[k] = []; order.push(k); } bySession[k].push(r); names[get(r, 'ejercicio')] = 1; });
    const list = Object.keys(names).filter(Boolean).map(n => ({ id: 'csv-' + slug(n), name: n, builtin: false }));
    const used = {}; list.forEach(e => { used[e.id] = 1; });
    const ex = matchExercises(list, used, ctx), idOf = n => ex.map['csv-' + slug(n)] || 'hal_csv-' + slug(n);
    const have = {}; ctx.sessions.forEach(s => { if (s.discipline === DISC) { if (s.srcKey) have[s.srcKey] = 1; have['d|' + s.date + '|' + norm(s.dayName)] = 1; } });
    const ops = ex.ops.slice(), sum = { exercises: ex.stat, sessions: { add: 0, skip: 0, invalid: 0 }, weights: { add: 0, skip: 0 }, plan: 'none', profile: false };
    order.forEach(k => {
      const rs = bySession[k], date = k.split('|')[0], name = k.slice(date.length + 1), key = 'halcsv:' + k;
      if (have[key] || have['d|' + date + '|' + norm(name)]) { sum.sessions.skip++; return; }
      const items = [], at = {};
      rs.forEach(r => { const en = get(r, 'ejercicio'); if (!en) return; const sets = convSets([{ kg: get(r, 'kg'), reps: get(r, 'repeticiones'), pct: get(r, 'pct_1rm'), rpe: get(r, 'rpe'), secs: get(r, 'segundos'), done: yes(get(r, 'hecha')), miss: yes(get(r, 'fallada')) }]);
        if (!sets.length) return; if (!at[en]) { at[en] = { exId: idOf(en), name: en, rest: null, sets: [] }; items.push(at[en]); } at[en].sets.push(sets[0]); });
      if (!items.length) { sum.sessions.invalid++; return; }
      const dur = numOf(get(rs[0], 'duracion_min')), rpeS = numOf(get(rs[0], 'rpe_sesion')), t0 = new Date(date + 'T12:00:00').getTime();
      const rec = { id: 'hal_csv_' + slug(date + name) + '_' + order.indexOf(k), discipline: DISC, date: date, mode: 'live', items: items, rpe: rpeS != null && rpeS >= 0 && rpeS <= 10 ? rpeS : meanRpe(items), notes: null, startedAt: dur > 0 ? t0 : null, endedAt: dur > 0 ? t0 + dur * 60000 : null, dayName: name || null, source: 'halterofilia', srcKey: key };
      ops.push({ type: 'session', rec: rec }); sum.sessions.add++;
    });
    return { kind: 'csv', ops: ops, summary: sum, warnings: sum.sessions.add || sum.sessions.skip ? [] : ['El CSV no trae sesiones con fecha válida.'], hasPlan: false };
  }

  /* Texto (JSON o CSV) o respaldo ya leído → operaciones y resumen. Lanza Error con un motivo claro. */
  function prepare(input, ctx, opts) {
    let o = input;
    if (typeof input === 'string') {
      const t = input.replace(/^﻿/, '').trim(); if (!t) throw new Error('El archivo está vacío.');
      if (t[0] === '{' || t[0] === '[') { try { o = JSON.parse(t); } catch (e) { throw new Error('No es un archivo JSON válido.'); } }
      else return fromCsv(t, ctx);
    }
    if (!isBackup(o)) throw new Error(o && o.format === 'halterofilia-respaldo-equipo' ? 'Ese es el respaldo del equipo (entrenador). Usa el respaldo personal: en Halterofilia, Más → Exportar respaldo (JSON).' : 'No es un respaldo personal de Halterofilia.');
    return fromJson(o, ctx, opts);
  }

  /* Guarda las operaciones. Devuelve { saved, failed } y deja una nota en la bitácora de importaciones. */
  function apply(store, prep) {
    let saved = 0, failed = 0;
    prep.ops.forEach(op => { try { if (op.profile) store.setProfile(op.profile); else store.save(op.type, op.rec); saved++; } catch (e) { failed++; } });
    try { store.save('importlog', { source: 'halterofilia', at: Date.now(), summary: prep.summary }); } catch (e) { /* la bitácora es opcional */ }
    return { saved: saved, failed: failed };
  }

  const H = { isBackup, prepare, apply, ctxOf, parseCsv, parseReps, parseSecs };
  A.halter = H;
  if (typeof module !== 'undefined' && module.exports) module.exports = H;
})(typeof window !== 'undefined' ? window : globalThis);
