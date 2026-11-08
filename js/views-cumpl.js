/* Pantallas de «Cumplimiento» (fase 6): Peso y Entrenamientos (halterofilia y pesas). */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, store = A.store, C = A.calc, K = A.comp, W = A.vw;
  const tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, DISC_LABEL = W.DISC_LABEL;
  const back = n => U.ymd(U.addDays(U.parseYmd(U.today()), -n));
  const cellGrid = (label, days, state) => {
    const ul = h('ul', { class: 'cells', 'aria-label': label });
    days.forEach(d => { const s = state(d), cls = s ? 'ok' : 'none';
      ul.appendChild(h('li', { class: 'cell ' + cls, 'aria-label': U.fmtDate(d) + ': ' + (s ? 'cumplido' : 'sin registro') }, h('span', { class: 'cell-d' }, String(+d.slice(8))), h('span', { class: 'cell-s', 'aria-hidden': 'true' }, s ? '✓' : '·'))); });
    return ul;
  };

  /* ---------- Peso · Cumplimiento ---------- */
  wrapView('peso/cumplimiento', (el, again) => {
    const today = U.today(), ws = store.list('weight'), series = C.weightSeries(ws), tr = C.trend(series);
    if (!ws.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Aún no hay pesos'), h('p', { class: 'muted' }, 'El cumplimiento muestra tu constancia al pesarte, los pasos y los objetivos cortos.'), h('a', { class: 'btn', href: '#/peso/registro' }, 'Registrar peso'))); return; }
    const ls = K.logStreak(ws.map(w => w.date), today), gs = store.get('goal', 'goal_steps'), ss = C.stepsStats(store.list('steps'), gs ? gs.target : null, today);
    const ms = store.list('goal').filter(x => x.parentId === 'goal_main_weight').sort((a, b) => a.targetDate < b.targetDate ? -1 : 1), st = ms.map(m => C.milestoneStatus(m, tr, today).state), hit = st.filter(x => x === 'logrado' || x === 'tarde').length;
    el.appendChild(tiles([tile('Racha de pesaje', ls.streak + (ls.streak === 1 ? ' día' : ' días'), 'mejor: ' + ls.best), tile('Días con peso', ls.n30 + ' de 30', ls.pct30 + ' %'),
      tile('Objetivos cortos', ms.length ? hit + ' de ' + ms.length : '–', ms.length ? 'logrados' : 'sin objetivos'), tile('Pasos en meta', ss.pct30 == null ? '–' : ss.pct30 + ' %', gs ? 'racha ' + ss.streak + (ss.streak === 1 ? ' día' : ' días') : 'sin meta de pasos')]));
    const days = []; for (let i = 29; i >= 0; i--) days.push(back(i));
    const have = {}; ws.forEach(w => { have[w.date] = 1; });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Pesaje, últimos 30 días'), cellGrid('Días con peso registrado', days, d => have[d]), h('p', { class: 'hint' }, '✓ con peso · · sin registro. Pesarte seguido hace más confiable tu tendencia de 7 días.')));
    if (gs) { const sd = {}; store.list('steps').forEach(r => { if (r.count >= gs.target) sd[r.date] = 1; });
      el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Pasos en meta, últimos 30 días'), cellGrid('Días con la meta de pasos', days, d => sd[d]), h('p', { class: 'hint' }, 'Meta: ' + U.fmtNum(gs.target, 0) + ' pasos al día. Promedio de 7 días: ' + (ss.avg7 == null ? '–' : U.fmtNum(ss.avg7, 0)) + '.'))); }
    const L = { logrado: ['✓', 'Logrado'], tarde: ['✓', 'Logrado (tarde)'], pendiente: ['○', 'Pendiente'], vencido: ['!', 'No logrado'] };
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Objetivos cortos'), ms.length ? h('ul', { class: 'rows', 'aria-label': 'Objetivos cortos' }, ms.map((m, i) => h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, U.fmtNum(m.target, 1) + ' kg'), h('span', { class: 'hint' }, 'para el ' + W.longDate(m.targetDate))), h('span', { class: 'status ' + st[i] }, L[st[i]][0] + ' ' + L[st[i]][1]))))
      : h('p', { class: 'muted' }, 'Aún no tienes objetivos cortos. Se crean en Peso → Objetivo.'), ms.length ? null : h('a', { class: 'btn ghost', href: '#/peso/objetivo' }, 'Ir a Objetivo')));
  });

  /* ---------- Entrenamientos · Cumplimiento ---------- */
  ['halterofilia', 'pesas'].forEach(disc => wrapView('entrenos/' + disc + '/cumplimiento', (el, again) => {
    const today = U.today(), plan = store.list('plan').filter(p => p.discipline === disc)[0] || null, ss = store.list('session').filter(s => s.discipline === disc);
    if (!K.plannedDays(plan).length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Primero arma tu rutina'), h('p', { class: 'muted' }, 'El cumplimiento compara las sesiones que haces con las que planificaste en tu rutina semanal.'), h('a', { class: 'btn', href: '#/entrenos/' + disc + '/plan' }, 'Ir a Plan'))); return; }
    const ws = K.weeks(plan, ss, today, 8), cur = ws[ws.length - 1], sm = K.summary(ws);
    el.appendChild(tiles([tile('Esta semana', cur.done + ' de ' + cur.planned, cur.met ? 'semana cumplida' : 'sesiones'), tile('Racha de semanas', sm.streak + (sm.streak === 1 ? ' semana' : ' semanas'), 'mejor: ' + sm.best), tile('Últimas 4 semanas', sm.pct4 == null ? '–' : sm.pct4 + ' %', sm.done4 + ' de ' + sm.planned4 + ' planificadas'), tile('Sesiones (8 sem.)', String(ws.reduce((t, w) => t + w.done, 0)), DISC_LABEL[disc].toLowerCase())]));
    const ICON = { hecha: ['✓', 'Hecha'], hoy: ['●', 'Hoy'], pendiente: ['○', 'Pendiente'], perdida: ['!', 'No hecha'] }, DN = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const extra = Math.max(0, cur.done - cur.days.filter(d => d.state === 'hecha').length);
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Esta semana'), h('ul', { class: 'rows', 'aria-label': 'Días de la semana' }, cur.days.map(d => h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, DN[d.dow] + ' · ' + d.name), h('span', { class: 'hint' }, U.fmtDate(d.date))),
      h('span', { class: 'status ' + (d.state === 'hecha' ? 'logrado' : d.state === 'perdida' ? 'vencido' : 'pendiente') }, ICON[d.state][0] + ' ' + ICON[d.state][1])))),
      extra ? h('p', { class: 'hint' }, 'Además hiciste ' + extra + (extra === 1 ? ' sesión' : ' sesiones') + ' en días no planificados; cuentan para la semana.') : null,
      h('div', { class: 'row-end' }, h('a', { class: 'btn ghost', href: '#/entrenos/' + disc + '/hoy' }, 'Ir a la sesión'))));
    const host = h('div'); el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Sesiones por semana'), host, h('p', { class: 'hint' }, 'Se compara con tu rutina actual: si la cambias, las semanas pasadas se miden con la nueva.')));
    A.charts.bars(host, { ariaLabel: 'Gráfico de columnas: sesiones hechas por semana, últimas 8 semanas, con la línea de sesiones planificadas.', unit: 'sesiones', decimals: 0, name: 'Sesiones', pts: ws.map(w => ({ label: U.fmtShort(w.week), y: w.done, tip: 'Semana del ' + U.fmtShort(w.week) + ' · ' + w.done + ' de ' + w.planned })), goal: { y: cur.planned, label: 'Plan' } });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Semana a semana'), h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Semana', 'Hechas', 'Plan', 'Estado'].map(x => h('th', { scope: 'col' }, x)))),
      h('tbody', null, ws.slice().reverse().map(w => h('tr', null, h('th', { scope: 'row' }, U.fmtShort(w.week)), h('td', null, String(w.done)), h('td', null, String(w.planned)), h('td', null, w.met ? '✓ Cumplida' : w.current ? 'En curso' : 'Incompleta'))))))));
  }));
})(window);
