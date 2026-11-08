/* Cumplimiento de entrenamientos y del pesaje (puro, sin DOM): sesiones hechas vs planificadas por semana, rachas y %.
   Se compara con la rutina ACTUAL (si cambias la rutina, el pasado se mide con la nueva). Se prueba en Node. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util || (typeof require !== 'undefined' ? require('./util.js') : null);
  const weekOf = date => U.ymd(U.mondayOf(U.parseYmd(date)));
  const addD = (ymd, n) => U.ymd(U.addDays(U.parseYmd(ymd), n));
  /* Fecha del día `dow` (0 dom … 6 sáb) dentro de la semana que parte el lunes `week` */
  const dateOfDow = (week, dow) => addD(week, (dow + 6) % 7);
  const plannedDays = plan => ((plan && plan.days) || []).filter(d => d && Array.isArray(d.items) && d.items.length && d.dow >= 0 && d.dow <= 6);

  /* Una semana: días planificados (con su estado) y sesiones hechas */
  function weekStatus(plan, sessions, week, today) {
    const days = plannedDays(plan), end = addD(week, 6), inWeek = sessions.filter(s => s.date >= week && s.date <= end);
    const isCurrent = today >= week && today <= end, future = week > today;
    const per = days.map(d => { const date = dateOfDow(week, d.dow), did = inWeek.some(s => s.date === date);
      return { name: d.name, dow: d.dow, date: date, state: did ? 'hecha' : date === today ? 'hoy' : date > today ? 'pendiente' : 'perdida' }; }).sort((a, b) => a.date < b.date ? -1 : 1);
    const planned = days.length, base = isCurrent ? per.filter(p => p.date <= today).length : future ? 0 : planned, done = inWeek.length;
    return { week: week, planned: planned, base: base, done: done, met: planned > 0 && done >= planned, current: isCurrent, days: per,
      pct: base > 0 ? Math.min(100, Math.round(100 * done / base)) : (planned > 0 && done >= planned ? 100 : null) };
  }
  /* Últimas `n` semanas (de la más antigua a la actual). No se cuentan las semanas anteriores a tu primera sesión. */
  function weeks(plan, sessions, today, n) {
    const first = sessions.length ? weekOf(sessions.reduce((m, s) => s.date < m ? s.date : m, sessions[0].date)) : null;
    const out = []; let w = weekOf(today); for (let i = 0; i < (n || 8); i++) { if (i > 0 && (!first || w < first)) break; out.unshift(weekStatus(plan, sessions, w, today)); w = addD(w, -7); }
    return out;
  }
  /* Rachas de semanas cumplidas (la semana en curso suma si ya cumplió, pero no corta si aún no) y % de las últimas 4 semanas */
  function summary(ws) {
    let streak = 0, i = ws.length - 1; if (ws[i] && ws[i].current && !ws[i].met) i--;
    while (i >= 0 && ws[i].planned > 0 && ws[i].met) { streak++; i--; }
    let best = 0, run = 0; ws.forEach(w => { if (w.planned > 0 && w.met) { run++; if (run > best) best = run; } else if (!w.current) run = 0; });
    const l4 = ws.slice(-4), planned = l4.reduce((t, w) => t + w.base, 0), done = l4.reduce((t, w) => t + Math.min(w.done, w.base || w.planned), 0);
    return { streak: streak, best: best, pct4: planned ? Math.round(100 * done / planned) : null, planned4: planned, done4: done };
  }

  /* Pesaje: racha de días seguidos con peso (hoy sin registrar no la corta), mejor racha y % de los últimos 30 días */
  function logStreak(dates, today) {
    const set = {}; dates.forEach(d => { set[d] = 1; });
    let streak = 0, i = set[today] ? 0 : 1; while (set[addD(today, -i)] && i < 3650) { streak++; i++; }
    const all = Object.keys(set).sort(); let best = 0, run = 0, prev = null; all.forEach(d => { run = prev && U.daysBetween(prev, d) === 1 ? run + 1 : 1; prev = d; if (run > best) best = run; });
    let n30 = 0; for (let k = 0; k < 30; k++) if (set[addD(today, -k)]) n30++;
    return { streak: streak, best: best, n30: n30, pct30: Math.round(n30 / 30 * 100) };
  }

  const C = { weekOf, dateOfDow, plannedDays, weekStatus, weeks, summary, logStreak };
  A.comp = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
