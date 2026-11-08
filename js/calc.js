/* Cálculos de peso y pasos (puros, sin DOM): tendencia, proyección, ritmo necesario, mes contra mes, objetivos cortos y rachas.
   Los números que muestra la app salen de aquí, y se prueban en Node (tests/unit.js). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const U = A.util;
  const KCAL_PER_KG = 7700;   // aproximación habitual: ~7.700 kcal por kg de peso corporal
  const MIN_SLOPE = 0.002;    // kg/día: bajo esto se considera estable (≈ 0,014 kg por semana)

  const sortByDate = a => a.slice().sort((x, y) => x.date < y.date ? -1 : x.date > y.date ? 1 : 0);
  /* Serie de peso [{date, value}] a partir de los registros guardados */
  const weightSeries = list => sortByDate(list.map(r => ({ date: r.date, value: r.kg })));
  const trend = series => U.trailingAvg(series, 7);
  /* Último punto de la tendencia con fecha ≤ date y no más viejo que `maxAge` días */
  function trendAt(tr, date, maxAge) {
    for (let i = tr.length - 1; i >= 0; i--) if (tr[i].date <= date) { const age = U.daysBetween(tr[i].date, date); return age <= (maxAge == null ? 10 : maxAge) ? tr[i] : null; }
    return null;
  }

  /* Resumen: último peso, tendencia actual y cambios a 7 y 30 días (de la tendencia, no del peso suelto) */
  function stats(series) {
    if (!series.length) return null;
    const tr = trend(series), last = series[series.length - 1], lastT = tr[tr.length - 1];
    const back = d => { const p = trendAt(tr, U.ymd(U.addDays(U.parseYmd(last.date), -d)), 10); return p ? U.round(lastT.avg - p.avg, 2) : null; };
    return { n: series.length, first: series[0], last: last, avg: lastT.avg, d7: back(7), d30: back(30), sinceStart: U.round(lastT.avg - tr[0].avg, 2) };
  }

  /* Recta de mínimos cuadrados sobre los pesos de los últimos `days` días. Necesita ≥5 pesos repartidos en ≥14 días. */
  function fit(series, days) {
    if (!series.length) return null;
    const end = series[series.length - 1].date, from = U.ymd(U.addDays(U.parseYmd(end), -(days || 28) + 1));
    const pts = series.filter(p => p.date >= from);
    if (pts.length < 5 || U.daysBetween(pts[0].date, end) < 14) return null;
    const x = pts.map(p => U.daysBetween(pts[0].date, p.date)), y = pts.map(p => p.value), n = pts.length;
    const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) * (x[i] - mx); }
    const slope = sxx ? sxy / sxx : 0, base = pts[0].date;
    return { slope: slope, n: n, base: base, end: end, at: date => my + slope * (U.daysBetween(base, date) - mx) };
  }

  /* ¿Qué pasa si sigo a este ritmo? goal = { target, targetDate?, startValue? } */
  function projection(series, goal) {
    if (!goal) return { status: 'sin-objetivo' };
    const f = fit(series, 28);
    if (!f) return { status: 'pocos-datos' };
    const now = f.at(f.end), start = goal.startValue != null ? goal.startValue : series[0].value, loss = goal.target < start;
    if (loss ? now <= goal.target : now >= goal.target) return { status: 'logrado', current: now };
    const need = goal.target - now, slope = f.slope;
    if (Math.abs(slope) < MIN_SLOPE) return { status: 'estable', current: now, slope: slope };
    if (need * slope <= 0) return { status: 'alejandose', current: now, slope: slope };
    const days = Math.ceil(need / slope - 1e-9), reach = U.ymd(U.addDays(U.parseYmd(f.end), days));
    return { status: 'en-camino', current: now, slope: slope, perWeek: slope * 7, days: days, reachDate: reach, aheadDays: goal.targetDate ? U.daysBetween(reach, goal.targetDate) : null };
  }

  /* Ritmo necesario para llegar a la fecha. kcalPerDay: negativo = déficit. */
  function requiredRate(currentKg, goal, today) {
    const days = goal && goal.targetDate ? U.daysBetween(today, goal.targetDate) : null;
    if (days == null || days <= 0) return null;
    const perDay = (goal.target - currentKg) / days, perWeek = perDay * 7, pct = Math.abs(perWeek) / currentKg * 100;
    return { days: days, remaining: U.round(goal.target - currentKg, 2), perWeek: perWeek, kcalPerDay: perDay * KCAL_PER_KG, pctPerWeek: pct, high: Math.abs(perWeek) > 1 || pct > 1 };
  }

  /* Promedios por mes calendario, con cambio contra el mes anterior */
  function monthly(series) {
    const by = {};
    series.forEach(p => { const k = p.date.slice(0, 7); (by[k] = by[k] || []).push(p.value); });
    const rows = Object.keys(by).sort().map(k => { const v = by[k]; return { month: k, n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length, min: Math.min.apply(null, v), max: Math.max.apply(null, v), delta: null }; });
    rows.forEach((r, i) => { if (i && U.daysBetween(rows[i - 1].month + '-01', r.month + '-01') <= 31) r.delta = U.round(r.avg - rows[i - 1].avg, 2); });
    return rows;
  }
  /* Pesos de un mes por día del mes: [{x:día, y}] */
  const byDayOfMonth = (series, month) => series.filter(p => p.date.slice(0, 7) === month).map(p => ({ x: +p.date.slice(8), y: p.value }));
  const prevMonth = m => { const d = U.parseYmd(m + '-01'); return U.ymd(new Date(d.getFullYear(), d.getMonth() - 1, 1)).slice(0, 7); };

  /* Objetivos cortos: puntos intermedios en línea recta desde hoy hasta la meta cada `everyDays` días (máx. 26) */
  function milestones(startValue, target, today, targetDate, everyDays) {
    const total = U.daysBetween(today, targetDate);
    if (total == null || total <= 0 || !(everyDays > 0)) return [];
    const out = []; let d = everyDays;
    while (d < total - 2 && out.length < 25) { out.push({ targetDate: U.ymd(U.addDays(U.parseYmd(today), d)), target: U.round(startValue + (target - startValue) * d / total, 1) }); d += everyDays; }
    out.push({ targetDate: targetDate, target: target });
    return out;
  }
  /* Estado de un objetivo corto: logrado | tarde | pendiente | vencido (se mira la tendencia desde que se creó) */
  function milestoneStatus(m, tr, today) {
    const loss = m.target < m.startValue;
    const hit = tr.filter(p => p.date >= m.startDate && p.date <= today).filter(p => loss ? p.avg <= m.target : p.avg >= m.target)[0];
    if (hit) return { state: hit.date <= m.targetDate ? 'logrado' : 'tarde', date: hit.date };
    return { state: today > m.targetDate ? 'vencido' : 'pendiente' };
  }

  /* Pasos: racha actual (hoy no la corta si aún no llega a la meta), mejor racha, % de los últimos 30 días y promedio de 7 */
  function stepsStats(list, goal, today) {
    const by = {}; list.forEach(r => { by[r.date] = r.count; });
    const met = d => goal != null && by[d] != null && by[d] >= goal;
    const back = n => U.ymd(U.addDays(U.parseYmd(today), -n));
    let streak = 0, i = met(today) ? 0 : 1;
    while (met(back(i)) && i < 3650) { streak++; i++; }
    const days = Object.keys(by).sort(); let best = 0, run = 0, prev = null;
    days.forEach(d => { if (met(d)) { run = prev && U.daysBetween(prev, d) === 1 ? run + 1 : 1; prev = d; if (run > best) best = run; } else { run = 0; prev = null; } });
    let m30 = 0; for (let k = 0; k < 30; k++) if (met(back(k))) m30++;
    const w = []; for (let k = 0; k < 7; k++) if (by[back(k)] != null) w.push(by[back(k)]);
    return { streak: streak, best: best, pct30: goal ? Math.round(m30 / 30 * 100) : null, avg7: w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null, metToday: met(today) };
  }

  A.calc = { KCAL_PER_KG, weightSeries, trend, trendAt, stats, fit, projection, requiredRate, monthly, byDayOfMonth, prevMonth, milestones, milestoneStatus, stepsStats };
  if (typeof module !== 'undefined' && module.exports) module.exports = A.calc;
})(typeof window !== 'undefined' ? window : globalThis);
