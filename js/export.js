/* Exportación (fase 7): CSV para Excel (separador «;», coma decimal) e informe PDF. Todo se arma en el dispositivo, sin conexión.
   Lógica pura: recibe los datos ya leídos (ctx) y devuelve el texto o los bytes del archivo. Se prueba en Node. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const g = n => A[n] || (typeof require !== 'undefined' ? require('./' + { util: 'util', calc: 'calc', food: 'food', train: 'train', pdf: 'pdf', comp: 'compliance' }[n] + '.js') : null);
  const U = g('util'), C = g('calc'), F = g('food'), T = g('train'), P = g('pdf');
  const DOWN = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'], DISC = { halterofilia: 'Halterofilia', pesas: 'Pesas', cardio: 'Cardio y otros', otro: 'Otro' };
  const inR = (d, from, to) => (!from || d >= from) && (!to || d <= to);
  const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0;

  /* ---------- CSV ---------- */
  const cell = v => {
    if (v == null || v === '') return '';
    if (typeof v === 'number') return isFinite(v) ? String(v).replace('.', ',') : '';
    if (typeof v === 'boolean') return v ? 'sí' : 'no';
    let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;            // evita que Excel lo trate como fórmula
    return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows => '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  const exName = (ctx, id, fb) => { const e = (ctx.exercises || []).filter(x => x.id === id)[0]; return e ? e.name : fb || ''; };
  const SLOT = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', once: 'Once', cena: 'Cena', colacion: 'Colación' };

  const SETS = {
    peso: { label: 'Peso', head: ['fecha', 'kg', 'nota'], rows: (c, f, t) => c.weights.filter(r => inR(r.date, f, t)).sort(byDate).map(r => [r.date, r.kg, r.note || '']) },
    pasos: { label: 'Pasos', head: ['fecha', 'pasos'], rows: (c, f, t) => c.steps.filter(r => inR(r.date, f, t)).sort(byDate).map(r => [r.date, r.count]) },
    medidas: { label: 'Medidas corporales', head: ['fecha', 'zona', 'cm'], rows: (c, f, t) => c.measures.filter(r => inR(r.date, f, t)).sort(byDate).map(r => [r.date, r.site, r.cm]) },
    comidas: { label: 'Comidas', head: ['fecha', 'comida', 'alimento', 'cantidad', 'unidad', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasas_g'],
      rows: (c, f, t) => c.meals.filter(r => inR(r.date, f, t)).map(r => [r.date, SLOT[r.slot] || r.slot, r.name, r.qty, r.unit || '', r.kcal, r.p, r.c, r.f])
        .concat(c.nutri.filter(r => inR(r.date, f, t) && !c.meals.some(m => m.date === r.date)).map(r => [r.date, 'Total del día', '', '', '', r.kcal, r.p, r.c, r.f])).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0) },
    entrenos: { label: 'Entrenamientos (series)', head: ['fecha', 'disciplina', 'sesion', 'ejercicio', 'serie', 'kg', 'repeticiones', 'pct_1rm', 'rpe', 'hecha', 'fallada', 'segundos', 'rpe_sesion'],
      rows: (c, f, t) => { const out = []; c.sessions.filter(s => s.discipline !== 'cardio' && inR(s.date, f, t)).sort(byDate).forEach(s => (s.items || []).forEach(it => (it.sets || []).forEach((x, j) => out.push([s.date, DISC[s.discipline] || s.discipline, s.dayName || '', exName(c, it.exId, it.name), j + 1, x.kg, x.reps, x.pct, x.rpe, x.done !== false, !!x.miss, x.secs, s.rpe])))); return out; } },
    cardio: { label: 'Cardio y otras actividades', head: ['fecha', 'actividad', 'minutos', 'km', 'kcal', 'rpe'],
      rows: (c, f, t) => { const out = []; c.sessions.filter(s => s.discipline === 'cardio' && inR(s.date, f, t)).sort(byDate).forEach(s => (s.items || []).forEach(it => out.push([s.date, it.activity, it.minutes, it.km, it.kcal, s.rpe]))); return out; } }
  };
  /* kind: clave de SETS. Devuelve { name, text, count } */
  function makeCsv(kind, ctx, from, to) {
    const d = SETS[kind]; if (!d) throw new Error('Tipo de datos desconocido.');
    const rows = d.rows(ctx, from, to);
    return { name: kind + (from || to ? '-' + (from || 'inicio') + '_' + (to || 'hoy') : '') + '.csv', text: csv([d.head].concat(rows)), count: rows.length };
  }

  /* ---------- Informe PDF ---------- */
  const num = (v, d) => v == null || !isFinite(v) ? '–' : U.fmtNum(v, d == null ? 1 : d);
  const sgn = (v, d, u) => v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + U.fmtNum(Math.abs(v), d) + (u ? ' ' + u : '');
  const lng = s => { const d = U.parseYmd(s); return d ? d.getDate() + ' ' + ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()] + ' ' + d.getFullYear() : s; };

  /* opts: { from, to, today, sections: { peso, pasos, comida, entrenos, rutinas } }. Devuelve { bytes, pages } */
  function report(ctx, opts) {
    const today = opts.today || U.today(), from = opts.from, to = opts.to, S = opts.sections || {}, who = ctx.profile && ctx.profile.name ? ctx.profile.name : '';
    const doc = P.Doc({ title: 'Informe de seguimiento', footer: 'Seguimiento personal · generado el ' + lng(today) });
    doc.heading('Informe de seguimiento' + (who ? ' · ' + who : ''));
    doc.para('Periodo: ' + lng(from) + ' al ' + lng(to) + '. Los datos salen de este dispositivo; los promedios usan solo los días con registro.', { gray: 0.35, size: 9 });
    let any = false;

    if (S.peso) { any = true; doc.heading('Peso', 2);
      const ws = ctx.weights.filter(r => inR(r.date, from, to)).sort(byDate), all = C.weightSeries(ctx.weights).filter(p => p.date <= to), st = C.stats(all);
      if (!ws.length) doc.para('No hay pesos registrados en este periodo.', { gray: 0.4 });
      else { const first = ws[0], last = ws[ws.length - 1];
        doc.stats([['Primer peso', num(first.kg) + ' kg'], ['Último peso', num(last.kg) + ' kg'], ['Cambio', sgn(Math.round((last.kg - first.kg) * 10) / 10, 1, 'kg')], ['Tendencia (7 d)', st ? num(st.avg) + ' kg' : '–']]);
        const gm = ctx.goals && ctx.goals.main; if (gm) doc.para('Meta: ' + num(gm.target) + ' kg para el ' + lng(gm.targetDate) + (st ? '. Te faltan ' + num(Math.abs(st.avg - gm.target)) + ' kg según tu tendencia.' : '.'), { size: 9 });
        doc.line(ws.map(r => ({ x: U.daysBetween(from, r.date), y: r.kg })), { title: 'Peso (kg)', xLabels: [[0, U.fmtShort(from)], [U.daysBetween(from, to), U.fmtShort(to)]] });
        const wk = {}; ws.forEach(r => { const k = U.ymd(U.mondayOf(U.parseYmd(r.date))); (wk[k] = wk[k] || []).push(r.kg); });
        doc.table([{ label: 'Semana del', w: 0.28 }, { label: 'Registros', w: 0.18, align: 'right' }, { label: 'Promedio (kg)', w: 0.18, align: 'right' }, { label: 'Mínimo', w: 0.18, align: 'right' }, { label: 'Máximo', w: 0.18, align: 'right' }],
          Object.keys(wk).sort().map(k => { const v = wk[k]; return [lng(k), String(v.length), num(v.reduce((a, b) => a + b, 0) / v.length), num(Math.min.apply(null, v)), num(Math.max.apply(null, v))]; })); } }

    if (S.pasos) { any = true; doc.heading('Pasos', 2);
      const ps = ctx.steps.filter(r => inR(r.date, from, to)), goal = ctx.goals && ctx.goals.steps ? ctx.goals.steps.target : null;
      if (!ps.length) doc.para('No hay pasos registrados en este periodo.', { gray: 0.4 });
      else { const avg = Math.round(ps.reduce((t, r) => t + r.count, 0) / ps.length), met = goal ? ps.filter(r => r.count >= goal).length : null;
        doc.stats([['Días con registro', String(ps.length)], ['Promedio diario', U.fmtNum(avg, 0)], ['Mejor día', U.fmtNum(Math.max.apply(null, ps.map(r => r.count)), 0)], ['Días con la meta', goal ? met + ' de ' + ps.length : 'sin meta']]); } }

    if (S.comida) { any = true; doc.heading('Alimentación', 2);
      const days = Math.min(400, U.daysBetween(from, to) + 1), ser = F.series(ctx.meals, ctx.nutri, from, to).slice(0, days), avg = F.average(ser), gl = ctx.goals && ctx.goals.food ? ctx.goals.food : { kcal: null };
      if (!avg) doc.para('No hay comidas registradas en este periodo.', { gray: 0.4 });
      else { const sts = ser.map(s => F.dayStatus(s.total, gl)), okN = sts.filter(s => s.ok).length, logN = sts.filter(s => s.logged).length;
        doc.stats([['Días registrados', String(avg.n)], ['Kcal promedio', U.fmtNum(avg.kcal, 0)], ['Proteína (g)', num(avg.p, 0)], ['Días en meta', gl.kcal ? okN + ' de ' + logN : 'sin meta']]);
        if (gl.kcal) doc.para('Objetivo: ' + U.fmtNum(gl.kcal, 0) + ' kcal' + (gl.p ? ' · proteína ' + U.fmtNum(gl.p, 0) + ' g' : '') + '. Un día cuenta si las kcal quedan a ±10 % del objetivo' + (gl.p ? ' y la proteína llega al 90 % de su meta' : '') + '.', { size: 9 });
        const rows = ser.filter(s => s.total).slice(-14).reverse().map(s => { const st = F.dayStatus(s.total, gl); return [lng(s.date), U.fmtNum(s.total.kcal, 0), num(s.total.p, 0), num(s.total.c, 0), num(s.total.f, 0), st.ok == null ? '–' : st.ok ? 'En meta' : 'Fuera de meta']; });
        doc.para('Últimos días registrados', { bold: true, size: 9, gap: 2 });
        doc.table([{ label: 'Día', w: 0.24 }, { label: 'Kcal', w: 0.14, align: 'right' }, { label: 'Prot. (g)', w: 0.15, align: 'right' }, { label: 'Carb. (g)', w: 0.15, align: 'right' }, { label: 'Grasa (g)', w: 0.15, align: 'right' }, { label: 'Estado', w: 0.17 }], rows); } }

    if (S.entrenos) { any = true; doc.heading('Entrenamientos', 2);
      const ss = ctx.sessions.filter(s => inR(s.date, from, to)).sort(byDate);
      if (!ss.length) doc.para('No hay sesiones registradas en este periodo.', { gray: 0.4 });
      else { const by = {}; ss.forEach(s => { const o = by[s.discipline] = by[s.discipline] || { n: 0, sets: 0, ton: 0, min: 0, km: 0 }; o.n++;
          if (s.discipline === 'cardio') { const t = T.cardioTotals(s); o.min += t.minutes; o.km += t.km; } else { const st = T.sessionStats(s); o.sets += st.sets; o.ton += st.tonnage; o.min += st.minutes || 0; } });
        doc.table([{ label: 'Disciplina', w: 0.28 }, { label: 'Sesiones', w: 0.14, align: 'right' }, { label: 'Series', w: 0.14, align: 'right' }, { label: 'Tonelaje (kg)', w: 0.18, align: 'right' }, { label: 'Minutos', w: 0.12, align: 'right' }, { label: 'Km', w: 0.14, align: 'right' }],
          Object.keys(by).map(k => [DISC[k] || k, String(by[k].n), k === 'cardio' ? '–' : String(by[k].sets), k === 'cardio' ? '–' : U.fmtNum(by[k].ton, 0), by[k].min ? String(by[k].min) : '–', k === 'cardio' ? num(by[k].km) : '–']));
        doc.para('Sesiones (las más recientes primero)', { bold: true, size: 9, gap: 2 });
        doc.table([{ label: 'Fecha', w: 0.2 }, { label: 'Tipo', w: 0.2 }, { label: 'Sesión', w: 0.24 }, { label: 'Ejerc.', w: 0.1, align: 'right' }, { label: 'Tonelaje', w: 0.14, align: 'right' }, { label: 'RPE', w: 0.12, align: 'right' }],
          ss.slice().reverse().slice(0, 80).map(s => { if (s.discipline === 'cardio') { const t = T.cardioTotals(s); return [lng(s.date), 'Cardio', (s.items[0] || {}).activity || '', '–', t.minutes + ' min', num(s.rpe)]; } const st = T.sessionStats(s); return [lng(s.date), DISC[s.discipline] || s.discipline, s.dayName || '', String(st.exercises), U.fmtNum(st.tonnage, 0), num(s.rpe)]; }));
        const rec = T.records(ss.filter(s => s.discipline !== 'cardio')).slice(0, 20);
        if (rec.length) { doc.para('Récords del periodo', { bold: true, size: 9, gap: 2 });
          doc.table([{ label: 'Ejercicio', w: 0.4 }, { label: 'Mayor peso', w: 0.2, align: 'right' }, { label: 'Fecha', w: 0.2 }, { label: '1RM estimado', w: 0.2, align: 'right' }], rec.map(r => [exName(ctx, r.key, r.name), num(r.maxKg) + ' kg', lng(r.maxKgDate), r.maxE1rm ? num(r.maxE1rm) + ' kg' : '–'])); } } }

    if (S.rutinas) { any = true; doc.heading('Rutinas', 2); const plans = ctx.plans.filter(p => (p.days || []).length);
      if (!plans.length) doc.para('No hay rutinas armadas.', { gray: 0.4 });
      plans.forEach(p => { doc.para(p.name + ' (' + (DISC[p.discipline] || p.discipline) + ')', { bold: true, gap: 2 });
        (p.days || []).filter(d => (d.items || []).length).sort((a, b) => ((a.dow + 6) % 7) - ((b.dow + 6) % 7)).forEach(d => {
          doc.para(DOWN[d.dow].replace(/^./, c => c.toUpperCase()) + ' · ' + d.name, { size: 9, bold: true, gap: 1 });
          doc.table([{ label: 'Ejercicio', w: 0.5 }, { label: 'Series × reps', w: 0.2, align: 'right' }, { label: 'Carga', w: 0.3, align: 'right' }], d.items.map(it => { const ex = (ctx.exercises || []).filter(e => e.id === it.exId)[0], kg = ex && it.pct != null ? T.kgFromPct(ex.max, it.pct) : it.kg;
            return [ex ? ex.name : '(ejercicio eliminado)', (it.sets || '?') + ' × ' + (it.reps || '?'), it.pct != null ? it.pct + ' %' + (kg != null ? ' = ' + num(kg) + ' kg' : '') : it.kg != null ? num(it.kg) + ' kg' : 'según avance']; })); }); }); }

    if (!any) doc.para('No elegiste ninguna sección.', { gray: 0.4 });
    const bytes = doc.finish(); return { bytes: bytes, pages: doc.pages.length };
  }

  const E = { SETS, makeCsv, csv, cell, report };
  A.exporter = E;
  if (typeof module !== 'undefined' && module.exports) module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
