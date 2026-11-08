/* Pantallas de «Alimentación» (fase 3), segunda parte: Objetivos, Progreso y Cumplimiento. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, F = A.food, C = A.calc, W = A.vw;
  const tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, errBox = W.errBox, signed = W.signed, chips = W.chips;
  const goals = () => W.foodGoals();

  const readNum = (inp) => { const t = inp.value.trim(); if (!t) return NaN; const v = U.parseNum(t); return v == null ? NaN : v; };
  const numInput = (id, ph, val) => h('input', { class: 'txt', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: ph || '', value: val == null ? '' : String(val).replace('.', ',') });
  /* Peso de referencia: la tendencia de 7 días (o el último peso) */
  const refWeight = () => { const s = C.weightSeries(store.list('weight')), st = C.stats(s); return { series: s, st: st, kg: st ? U.round(st.avg, 1) : null }; };
  const rateText = r => r === 0 ? 'Mantener el peso' : (r < 0 ? 'Bajar ' : 'Subir ') + U.fmtNum(Math.abs(r), 2) + ' kg por semana';

  /* ---------- Alimentación · Objetivos ---------- */
  let pace = null;   // kg por semana elegidos (null = el que corresponde a tu meta de peso, o −0,5)
  wrapView('comida/objetivos', (el, again) => {
    const today = U.today(), profile = store.getProfile(), g = goals(), ref = refWeight(), wg = store.get('goal', 'goal_main_weight');
    const miss = F.missing(profile, ref.kg, today), wr = wg && ref.kg ? C.requiredRate(ref.kg, wg, today) : null;
    const gaining = wg && ref.kg ? wg.target > ref.kg : false;
    const presets = (gaining ? [0, 0.25, 0.5] : [0, -0.25, -0.5, -0.75, -1]).map(r => [r, r === 0 ? 'Mantener' : (r > 0 ? '+' : '−') + U.fmtNum(Math.abs(r), 2) + ' kg/sem']);
    const goalRate = wr ? U.round(wr.perWeek, 2) : null;
    if (pace == null || (pace === 'goal' && goalRate == null)) pace = goalRate != null ? 'goal' : -0.5;
    const rate = pace === 'goal' ? goalRate : pace;

    /* Cálculo según tus datos */
    const calc = h('section', { class: 'card' }, h('h2', null, 'Kcal calculadas para ti'));
    if (miss.length) {
      calc.appendChild(h('p', { class: 'note warn', role: 'status' }, 'Para calcular faltan: ' + miss.join(', ') + '.'));
      calc.appendChild(h('div', { class: 'row-end wrap' }, h('a', { class: 'btn ghost', href: '#/datos/perfil' }, 'Completar perfil'), ref.kg ? null : h('a', { class: 'btn ghost', href: '#/peso/registro' }, 'Registrar peso')));
      calc.appendChild(h('p', { class: 'hint' }, 'Mientras tanto puedes escribir tu objetivo a mano, más abajo.'));
    } else {
      const options = presets.slice(); if (goalRate != null) options.push(['goal', 'Para mi fecha meta']);
      const rec = F.recommend(profile, ref.kg, rate, today);
      calc.appendChild(tiles([tile('Metabolismo basal', U.fmtNum(rec.bmr, 0) + ' kcal', 'en reposo'), tile('Gasto diario estimado', U.fmtNum(rec.tdee, 0) + ' kcal', 'con tu actividad'), tile('Peso usado', U.fmtNum(ref.kg, 1) + ' kg', 'tendencia de 7 días')]));
      calc.appendChild(h('h3', { class: 'sub' }, '¿A qué ritmo?'));
      calc.appendChild(chips(options, pace, v => { pace = v; again(); }, 'Ritmo de cambio de peso'));
      calc.appendChild(h('p', { class: 'muted' }, rateText(rate) + (pace === 'goal' ? ' (el que necesitas para llegar a tu fecha meta)' : '') + '.'));
      calc.appendChild(h('p', null, 'Objetivo sugerido: ', h('strong', { class: 'big' }, U.fmtNum(rec.target, 0) + ' kcal por día'), rec.adjust ? h('span', { class: 'muted' }, ' (gasto ' + U.fmtNum(rec.tdee, 0) + signed(rec.adjust, 0).replace('+', ' + ').replace('−', ' − ') + ')') : null));
      if (rec.belowFloor) calc.appendChild(h('p', { class: 'note warn', role: 'note' }, 'Ese objetivo queda bajo tu metabolismo basal (≈ ' + U.fmtNum(rec.floor, 0) + ' kcal): suele ser difícil de sostener. Considera un ritmo más suave o una fecha más lejana.'));
      else if (Math.abs(rate) > 1 || (ref.kg && Math.abs(rate) > ref.kg * 0.01)) calc.appendChild(h('p', { class: 'note warn', role: 'note' }, 'Ese ritmo es alto: más de 1 kg por semana (o 1 % de tu peso) cuesta sostenerlo. Conversa con un profesional de la salud si lo eliges.'));
      calc.appendChild(h('p', { class: 'hint' }, 'Es una estimación (fórmula Mifflin-St Jeor y 7.700 kcal ≈ 1 kg). Observa tu tendencia 2 o 3 semanas y ajusta. Las kcal del ejercicio se mostrarán aparte cuando llegue Entrenamientos.'));
      calc.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'button', onclick: () => { store.save('goal', { id: 'goal_kcal', kind: 'kcal', target: rec.target, mode: 'auto', rate: rate }); A.ui.toast('Objetivo guardado: ' + U.fmtNum(rec.target, 0) + ' kcal por día.'); again(); } }, g.kcal === rec.target ? 'Ya es tu objetivo' : 'Usar este objetivo')));
    }
    el.appendChild(calc);

    /* Objetivo de kcal (a mano) */
    const kin = numInput('ok-kcal', 'Ej. 2100', g.kcal), kerr = errBox();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); kerr.textContent = '';
      const v = readNum(kin);
      if (isNaN(v) || v < 800 || v > 8000) { kerr.textContent = 'El objetivo debe estar entre 800 y 8.000 kcal por día.'; return; }
      store.save('goal', { id: 'goal_kcal', kind: 'kcal', target: Math.round(v), mode: 'manual', rate: null }); A.ui.toast('Objetivo guardado.'); again();
    } }, h('h2', null, 'Tu objetivo de kcal'),
    g.kcal ? h('p', { class: 'muted' }, 'Hoy: ' + U.fmtNum(g.kcal, 0) + ' kcal por día' + (g.kcalRec && g.kcalRec.mode === 'manual' ? ' (escrito a mano).' : ' (calculado).')) : h('p', { class: 'muted' }, 'Todavía no defines un objetivo. Usa el calculado arriba o escribe el tuyo.'),
    field('ok-kcal', 'Kcal por día', kin, 'Puedes cambiarlo cuando quieras.'), kerr,
    h('div', { class: 'row-end' }, g.kcal ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { const k = g.kcalRec; store.remove('goal', 'goal_kcal'); A.ui.toast('Objetivo quitado.', { label: 'Deshacer', run: () => { store.save('goal', k); again(); } }); again(); } }, 'Quitar') : null, h('button', { class: 'btn', type: 'submit' }, 'Guardar'))));

    /* Macros */
    if (!g.kcal) { el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Meta de macros'), h('p', { class: 'muted' }, 'Define primero tu objetivo de kcal para proponerte los gramos de proteínas, carbohidratos y grasas.'))); return; }
    const def = F.macroDefaults(g.kcal, ref.kg), p = numInput('om-p', '', g.p != null ? g.p : def.p), c = numInput('om-c', '', g.c != null ? g.c : def.c), f = numInput('om-f', '', g.f != null ? g.f : def.f);
    const info = h('p', { class: 'muted', role: 'status' }), merr = errBox();
    const upd = () => { const pv = readNum(p), cv = readNum(c), fv = readNum(f); if ([pv, cv, fv].some(isNaN)) { info.textContent = ''; return; } const k = F.kcalOfMacros(pv, cv, fv), d = Math.round(k - g.kcal); info.textContent = 'Suman ' + U.fmtNum(k, 0) + ' kcal' + (Math.abs(d) <= 25 ? ': coincide con tu objetivo.' : d > 0 ? ' (' + U.fmtNum(d, 0) + ' más que tu objetivo).' : ' (' + U.fmtNum(-d, 0) + ' menos que tu objetivo).'); };
    [p, c, f].forEach(i => i.addEventListener('input', upd));
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); merr.textContent = '';
      const pv = readNum(p), cv = readNum(c), fv = readNum(f);
      if ([pv, cv, fv].some(v => isNaN(v) || v < 0 || v > 1000)) { merr.textContent = 'Escribe los tres macros como números en gramos (0 a 1.000).'; return; }
      store.save('goal', { id: 'goal_macros', kind: 'macros', target: Math.round(F.kcalOfMacros(pv, cv, fv)), p: Math.round(pv), c: Math.round(cv), f: Math.round(fv) }); A.ui.toast('Meta de macros guardada.'); again();
    } }, h('h2', null, 'Meta de macros (gramos por día)'),
    h('p', { class: 'muted' }, g.p != null ? 'Estos son tus macros guardados.' : 'Propuesta inicial: proteínas 1,8 g por kg de peso, grasas 25 % de las kcal y el resto en carbohidratos. Ajústala a tu gusto.'),
    h('div', { class: 'grid2' }, field('om-p', 'Proteínas (g)', p), field('om-c', 'Carbohidratos (g)', c)), field('om-f', 'Grasas (g)', f), info, merr,
    h('div', { class: 'row-end wrap' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { const d = F.macroDefaults(g.kcal, ref.kg); p.value = String(d.p); c.value = String(d.c); f.value = String(d.f); upd(); } }, 'Usar la propuesta'),
      g.macRec ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { const m = g.macRec; store.remove('goal', 'goal_macros'); A.ui.toast('Meta de macros quitada.', { label: 'Deshacer', run: () => { store.save('goal', m); again(); } }); again(); } }, 'Quitar') : null,
      h('button', { class: 'btn', type: 'submit' }, 'Guardar macros'))));
    upd();
  });

  /* ---------- Alimentación · Progreso ---------- */
  let fRange = 14;
  const rangeFrom = (today, n) => U.ymd(U.addDays(U.parseYmd(today), -(n - 1)));
  wrapView('comida/progreso', (el, again) => {
    const today = U.today(), g = goals(), meals = store.list('meal'), nutri = store.list('nutriday');
    const ser = F.series(meals, nutri, rangeFrom(today, fRange), today), avg = F.average(ser), bal = F.balance(ser, g.kcal);
    if (!avg) {
      el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin datos todavía'), h('p', { class: 'muted' }, 'Registra tus comidas (o los totales del día) para ver el consumo por día y semana.'), h('a', { class: 'btn', href: '#/comida/registro' }, 'Registrar comida')));
      return;
    }
    el.appendChild(tiles([tile('Promedio diario', U.fmtNum(avg.kcal, 0) + ' kcal', avg.n + ' de ' + fRange + ' días con registro'), tile('Tu meta', g.kcal ? U.fmtNum(g.kcal, 0) + ' kcal' : '–', g.kcal ? 'por día' : 'Defínela en Objetivos'),
      tile('Frente a la meta', bal ? signed(bal.kcal, 0, 'kcal') : '–', bal ? '≈ ' + signed(bal.kg, 2, 'kg') + ' (días registrados)' : ''), tile('Proteínas', U.fmtNum(avg.p, 0) + ' g', g.p ? 'meta ' + U.fmtNum(g.p, 0) + ' g' : 'promedio diario')]));

    const kHost = h('div'), anyMac = ser.some(s => s.total && s.total.macros), pHost = h('div');
    const pts = key => ser.map(s => ({ label: String(+s.date.slice(8)), y: s.total ? s.total[key] : 0, tip: U.fmtDate(s.date) + (s.total ? '' : ' · sin registro') }));
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Kcal por día'), chips([[7, '7 días'], [14, '14 días'], [30, '30 días'], [90, '90 días']], fRange, v => { fRange = v; again(); }, 'Periodo'), kHost));
    A.charts.bars(kHost, { ariaLabel: 'Gráfico de columnas: kcal por día, últimos ' + fRange + ' días.' + (g.kcal ? ' Meta: ' + U.fmtNum(g.kcal, 0) + ' kcal.' : ''), unit: 'kcal', decimals: 0, name: 'Kcal', pts: pts('kcal'), goal: g.kcal ? { y: g.kcal, label: 'Meta ' + U.fmtNum(g.kcal, 0) } : null });
    if (anyMac) {
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Proteínas por día'), pHost));
      A.charts.bars(pHost, { ariaLabel: 'Gráfico de columnas: gramos de proteína por día.' + (g.p ? ' Meta: ' + U.fmtNum(g.p, 0) + ' g.' : ''), unit: 'g', decimals: 0, name: 'Proteínas', pts: pts('p'), goal: g.p ? { y: g.p, label: 'Meta ' + U.fmtNum(g.p, 0) } : null });
    }

    /* Por semana */
    const wk = {}; ser.forEach(s => { if (!s.total) return; const k = U.ymd(U.mondayOf(U.parseYmd(s.date))); (wk[k] = wk[k] || []).push(s); });
    const rows = Object.keys(wk).sort().reverse().map(k => { const a = F.average(wk[k]); return h('tr', null, h('th', { scope: 'row' }, U.fmtShort(k)), h('td', null, U.fmtNum(a.kcal, 0)), h('td', null, U.fmtNum(a.p, 0)), h('td', null, U.fmtNum(a.c, 0)), h('td', null, U.fmtNum(a.f, 0)), h('td', null, String(a.n))); });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Promedio por semana'), h('p', { class: 'hint' }, 'Cada fila es una semana y muestra su lunes. Promedio diario de los días con registro.'),
      h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Semana', 'Kcal', 'P (g)', 'C (g)', 'G (g)', 'Días'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, rows)))));

    /* Proyección con el consumo real */
    const s14 = F.series(meals, nutri, rangeFrom(today, 14), today), a14 = F.average(s14), proj = h('section', { class: 'card' }, h('h2', null, 'Qué dice tu consumo'));
    const ref = refWeight(), miss = F.missing(store.getProfile(), ref.kg, today);
    if (!a14 || a14.n < 5) proj.appendChild(h('p', { class: 'muted' }, 'Con al menos 5 días registrados en las últimas 2 semanas, la app compara tu consumo con tu gasto estimado.'));
    else if (miss.length) proj.appendChild(h('p', { class: 'muted' }, ['Para comparar con tu gasto faltan: ' + miss.join(', ') + '. ', h('a', { href: '#/datos/perfil' }, 'Completar perfil'), '.']));
    else {
      const rec = F.recommend(store.getProfile(), ref.kg, 0, today), perDay = a14.kcal - rec.tdee, perWeek = U.round(perDay * 7 / F.KCAL_PER_KG, 2), fit = C.fit(ref.series, 28);
      proj.appendChild(h('p', null, 'Con tu consumo promedio de los últimos 14 días (' + U.fmtNum(a14.kcal, 0) + ' kcal en ' + a14.n + ' días registrados) y tu gasto estimado (' + U.fmtNum(rec.tdee, 0) + ' kcal), el balance es de ' + signed(Math.round(perDay), 0, 'kcal') + ' por día: unos ', h('strong', null, signed(perWeek, 2, 'kg') + ' por semana'), '.'));
      if (fit) proj.appendChild(h('p', { class: 'muted' }, 'Tu peso cambió ' + signed(U.round(fit.slope * 7, 2), 2, 'kg') + ' por semana en las últimas 4 semanas.'));
      proj.appendChild(h('p', { class: 'hint' }, 'Si los dos números no se parecen, suele ser porque faltan registros de comida o el gasto real es distinto del estimado. Es una guía, no una medición.'));
    }
    el.appendChild(proj);
  });

  /* ---------- Alimentación · Cumplimiento ---------- */
  wrapView('comida/cumplimiento', (el, again) => {
    const today = U.today(), g = goals();
    if (!g.kcal) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Primero define tu meta'), h('p', { class: 'muted' }, 'El cumplimiento compara cada día con tu objetivo de kcal.'), h('a', { class: 'btn', href: '#/comida/objetivos' }, 'Ir a Objetivos'))); return; }
    const ser = F.series(store.list('meal'), store.list('nutriday'), rangeFrom(today, 30), today), cp = F.compliance(ser, g, today, 30);
    el.appendChild(tiles([tile('Días en meta', cp.logged ? cp.ok + ' de ' + cp.logged : '–', cp.logged ? 'de los días registrados (30 d)' : 'Aún sin registros'), tile('Cumplimiento', cp.pct == null ? '–' : cp.pct + ' %', 'últimos 30 días'), tile('Racha actual', cp.streak + (cp.streak === 1 ? ' día' : ' días'), 'seguidos en meta'), tile('Mejor racha', cp.best + (cp.best === 1 ? ' día' : ' días'), 'en los últimos 30 días')]));
    const grid = h('ul', { class: 'cells', 'aria-label': 'Últimos 30 días' });
    ser.forEach(s => { const st = F.dayStatus(s.total, g), cls = !st.logged ? 'none' : st.ok ? 'ok' : st.ok === false ? 'bad' : 'none', sym = cls === 'ok' ? '✓' : cls === 'bad' ? '!' : '·', lbl = cls === 'ok' ? 'en meta' : cls === 'bad' ? 'fuera de meta' : 'sin registro';
      grid.appendChild(h('li', { class: 'cell ' + cls, 'aria-label': U.fmtDate(s.date) + ': ' + lbl }, h('span', { class: 'cell-d' }, String(+s.date.slice(8))), h('span', { class: 'cell-s', 'aria-hidden': 'true' }, sym))); });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Últimos 30 días'), grid, h('p', { class: 'hint' }, '✓ en meta · ! fuera de meta · · sin registro. Un día cuenta si las kcal quedan a ±10 % de tu objetivo' + (g.p ? ' y la proteína llega al 90 % de su meta' : '') + '. Los días sin registro no suman ni restan, pero cortan la racha.')));
    const last = ser.slice(-7).reverse(), rows = last.map(s => { const st = F.dayStatus(s.total, g); return h('tr', null, h('th', { scope: 'row' }, U.fmtDate(s.date)), h('td', null, s.total ? U.fmtNum(s.total.kcal, 0) : '–'), h('td', null, st.diff == null ? '–' : signed(st.diff, 0)), h('td', null, !st.logged ? 'Sin registro' : st.ok ? '✓ En meta' : st.protOk === false && st.kcalOk ? '! Poca proteína' : '! Fuera de meta')); });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Última semana'), h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Día', 'Kcal', 'Dif.', 'Estado'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, rows)))));
  });
})(window);
