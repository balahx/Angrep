/* Cálculos de entrenamiento (puros, sin DOM): 1RM estimado, tonelaje, historial por ejercicio, récords,
   kilos desde % del máximo, sugerencia de carga, proyección y cardio por semana. Se prueban en Node. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const num = v => typeof v === 'number' && isFinite(v);
  const r1 = n => U.round(n, 1);

  /* 1RM estimado (Epley). Con una repetición es el propio peso. Pasadas 12 repeticiones deja de ser fiable: devuelve null. */
  function e1rm(kg, reps) {
    if (!num(kg) || !num(reps) || kg <= 0 || reps < 1 || reps > 12) return null;
    return reps === 1 ? kg : r1(kg * (1 + reps / 30));
  }
  /* Series válidas: hechas (done distinto de false), con repeticiones y peso ≥ 0 */
  const doneSets = item => (item.sets || []).filter(s => s.done !== false && num(s.reps) && s.reps > 0 && num(s.kg) && s.kg >= 0);
  const ord = s => s.createdAt || s.startedAt || s.updatedAt || 0;
  const key = it => it.exId || 'n:' + String(it.name || '').toLowerCase();

  function sessionStats(s) {
    let tonnage = 0, reps = 0, sets = 0;
    (s.items || []).forEach(it => doneSets(it).forEach(x => { tonnage += x.kg * x.reps; reps += x.reps; sets++; }));
    const dur = s.startedAt && s.endedAt && s.endedAt > s.startedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
    return { tonnage: Math.round(tonnage), reps: reps, sets: sets, exercises: (s.items || []).filter(it => doneSets(it).length).length, minutes: dur, rpe: num(s.rpe) ? s.rpe : null, load: dur != null && num(s.rpe) ? Math.round(dur * s.rpe) : null };
  }
  const weekOf = date => U.ymd(U.mondayOf(U.parseYmd(date)));
  /* Por semana (lunes): sesiones, series, repeticiones y tonelaje. Incluye semanas vacías entre la primera y la última. */
  function weekly(sessions, disc, to) {
    const list = sessions.filter(s => !disc || s.discipline === disc); if (!list.length) return [];
    const by = {}; list.forEach(s => { const k = weekOf(s.date), st = sessionStats(s), w = by[k] = by[k] || { week: k, sessions: 0, sets: 0, reps: 0, tonnage: 0 }; w.sessions++; w.sets += st.sets; w.reps += st.reps; w.tonnage += st.tonnage; });
    const out = []; let k = Object.keys(by).sort()[0]; const last = weekOf(to || Object.keys(by).sort().pop());
    while (k <= last) { out.push(by[k] || { week: k, sessions: 0, sets: 0, reps: 0, tonnage: 0 }); k = U.ymd(U.addDays(U.parseYmd(k), 7)); }
    return out;
  }
  /* Historial de un ejercicio: por sesión, el mayor peso, el mejor 1RM estimado, series y tonelaje */
  function history(sessions, k) {
    const out = [];
    sessions.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : ord(a) - ord(b)).forEach(s => (s.items || []).forEach(it => {
      if (key(it) !== k) return; const ds = doneSets(it); if (!ds.length) return;
      const top = Math.max.apply(null, ds.map(x => x.kg)), est = ds.map(x => e1rm(x.kg, x.reps)).filter(num);
      out.push({ date: s.date, topKg: top, topReps: Math.max.apply(null, ds.filter(x => x.kg === top).map(x => x.reps)), e1rm: est.length ? Math.max.apply(null, est) : null, sets: ds.length, tonnage: Math.round(ds.reduce((t, x) => t + x.kg * x.reps, 0)), rpe: num(s.rpe) ? s.rpe : null, allReps: ds.map(x => x.reps) });
    }));
    return out;
  }
  /* Récords por ejercicio: mayor peso y mejor 1RM estimado, con su fecha */
  function records(sessions) {
    const names = {}, keys = {}; sessions.forEach(s => (s.items || []).forEach(it => { keys[key(it)] = 1; names[key(it)] = it.name || names[key(it)]; }));
    return Object.keys(keys).map(k => { const h = history(sessions, k); if (!h.length) return null;
      const m = h.reduce((a, b) => b.topKg >= a.topKg ? b : a), e = h.filter(x => x.e1rm != null).reduce((a, b) => !a || b.e1rm >= a.e1rm ? b : a, null);
      return { key: k, name: names[k] || '', maxKg: m.topKg, maxKgDate: m.date, maxE1rm: e ? e.e1rm : null, maxE1rmDate: e ? e.date : null, sessions: h.length };
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  }
  /* ¿La sesión estableció un récord de peso para algún ejercicio? (frente a lo anterior) */
  function newRecords(sessions, session) {
    const before = sessions.filter(s => s.id !== session.id && (s.date < session.date || (s.date === session.date && ord(s) < ord(session))));
    const out = []; (session.items || []).forEach(it => { const h = history(before, key(it)), mine = history([session], key(it))[0]; if (!mine) return; const prev = h.length ? Math.max.apply(null, h.map(x => x.topKg)) : null; if (prev != null && mine.topKg > prev) out.push({ name: it.name, kg: mine.topKg, prev: prev }); });
    return out;
  }
  /* Kilos desde un porcentaje del máximo, redondeado al paso de las pesas (por defecto 1 kg) */
  const kgFromPct = (max, pct, step) => !num(max) || !num(pct) || max <= 0 ? null : Math.round(max * pct / 100 / (step || 1)) * (step || 1);
  /* Sugerencia para la próxima sesión: si en la última lograste todas las repeticiones objetivo con el peso más alto
     (y el esfuerzo no fue extremo), sube `inc` kg; si no, repite. */
  function suggestNext(hist, targetReps, inc) {
    if (!hist.length) return null; const last = hist[hist.length - 1], step = inc || 2.5;
    const atTop = last.allReps.length, ok = last.topReps >= (targetReps || 1) && (last.rpe == null || last.rpe <= 9) && atTop >= 1;
    return ok ? { kg: last.topKg + step, why: 'Lograste ' + last.topReps + ' repeticiones con ' + last.topKg + ' kg: sube ' + step + ' kg.' } : { kg: last.topKg, why: 'Repite ' + last.topKg + ' kg hasta lograr ' + (targetReps || last.topReps + 1) + ' repeticiones.' };
  }
  /* Tendencia del 1RM estimado (mínimo 3 sesiones en 14 días) y su valor dentro de `weeks` semanas */
  function projectE1rm(hist, weeks, today) {
    const pts = hist.filter(x => x.e1rm != null).map(x => ({ x: U.daysBetween('2000-01-01', x.date), y: x.e1rm })); if (pts.length < 3) return null;
    if (pts[pts.length - 1].x - pts[0].x < 14) return null;
    const n = pts.length, mx = pts.reduce((t, p) => t + p.x, 0) / n, my = pts.reduce((t, p) => t + p.y, 0) / n;
    const sxx = pts.reduce((t, p) => t + (p.x - mx) * (p.x - mx), 0), sxy = pts.reduce((t, p) => t + (p.x - mx) * (p.y - my), 0); if (!sxx) return null;
    const slope = sxy / sxx, x1 = U.daysBetween('2000-01-01', today || U.today()) + (weeks || 8) * 7;
    return { perWeek: U.round(slope * 7, 2), at: r1(my + slope * (x1 - mx)), weeks: weeks || 8, n: n };
  }
  /* «3x5@80», «3 x 5 80kg», «5×3 @ 100,5» → series. Sin peso: 0 kg (peso corporal). */
  function parseSets(text) {
    const m = /^\s*(\d{1,2})\s*[x×]\s*(\d{1,3})\s*(?:@|con|a)?\s*([\d.,]+)?\s*(?:kg)?\s*$/i.exec(String(text || '')); if (!m) return null;
    const n = +m[1], reps = +m[2], kg = m[3] == null ? 0 : U.parseNum(m[3]); if (kg == null || n < 1 || reps < 1) return null;
    const out = []; for (let i = 0; i < n; i++) out.push({ kg: kg, reps: reps, done: true }); return out;
  }
  /* Día de la rutina que corresponde a una fecha (dow: 0 domingo … 6 sábado) */
  const planDay = (plan, date) => { const d = U.parseYmd(date); return plan && d ? (plan.days || []).filter(x => x.dow === d.getDay()) : []; };

  /* Cardio: cada sesión trae items [{ activity, minutes, km?, kcal? }] */
  function cardioTotals(s) { let minutes = 0, km = 0, kcal = 0; (s.items || []).forEach(it => { minutes += num(it.minutes) ? it.minutes : 0; km += num(it.km) ? it.km : 0; kcal += num(it.kcal) ? it.kcal : 0; }); return { minutes: Math.round(minutes), km: r1(km), kcal: Math.round(kcal) }; }
  function cardioWeekly(sessions, to) {
    const list = sessions.filter(s => s.discipline === 'cardio'); if (!list.length) return [];
    const by = {}; list.forEach(s => { const k = weekOf(s.date), t = cardioTotals(s), w = by[k] = by[k] || { week: k, sessions: 0, minutes: 0, km: 0, kcal: 0 }; w.sessions++; w.minutes += t.minutes; w.km = r1(w.km + t.km); w.kcal += t.kcal; });
    const out = []; let k = Object.keys(by).sort()[0]; const last = weekOf(to || Object.keys(by).sort().pop());
    while (k <= last) { out.push(by[k] || { week: k, sessions: 0, minutes: 0, km: 0, kcal: 0 }); k = U.ymd(U.addDays(U.parseYmd(k), 7)); }
    return out;
  }
  const T = { e1rm, doneSets, key, sessionStats, weekOf, weekly, history, records, newRecords, kgFromPct, suggestNext, projectE1rm, parseSets, planDay, cardioTotals, cardioWeekly };
  A.train = T;
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
