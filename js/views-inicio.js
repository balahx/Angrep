/* Inicio (fase 6): lo de hoy (peso, comida, pasos, entrenamiento), avisos, resumen de la semana y rachas. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, U = A.util, store = A.store, C = A.calc, F = A.food, T = A.train, K = A.comp, W = A.vw;
  const tile = W.tile, tiles = W.tiles, meter = W.meter, signed = W.signed;
  const link = (href, text, cls) => h('a', { class: cls || 'btn ghost sm', href: href }, text);
  const DN = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  W.wrapView('inicio', (el, again) => {
    const today = U.today(), now = new Date(), prof = store.getProfile(), hr = now.getHours(), week = K.weekOf(today), g = W.foodGoals();
    const hi = hr >= 5 && hr < 12 ? 'Buenos días' : hr >= 12 && hr < 20 ? 'Buenas tardes' : 'Buenas noches';
    const weights = store.list('weight'), series = C.weightSeries(weights), st = C.stats(series), steps = store.list('steps'), gs = store.get('goal', 'goal_steps'), stepGoal = gs ? gs.target : null;
    const meals = store.list('meal'), nutri = store.list('nutriday'), sessions = store.list('session'), plans = store.list('plan');
    const total = Object.keys(store.counts()).reduce((t, k) => t + store.counts()[k], 0);
    const dayMeals = F.dayTotal(meals.filter(m => m.date === today), nutri.filter(q => q.date === today)[0]);

    el.appendChild(h('section', { class: 'card' }, h('h2', null, hi + (prof.name ? ', ' + prof.name : '')), h('p', { class: 'muted' }, DN[now.getDay()].replace(/^./, c => c.toUpperCase()) + ' ' + U.fmtDate(today) + '.')));
    if (!total) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Empieza por aquí'), h('p', { class: 'muted' }, 'Todavía no hay registros. Con estos tres pasos Inicio se llena de información útil:'),
      h('ol', null, h('li', null, link('#/datos/perfil', 'Completa tu perfil', 'lnk'), ' (sexo, estatura, nacimiento y actividad).'), h('li', null, link('#/peso/registro', 'Registra tu peso', 'lnk'), ' de hoy.'), h('li', null, link('#/datos/halterofilia', 'Importa tu Halterofilia', 'lnk'), ' si la usabas.')))); return; }

    /* Avisos */
    const notes = [];
    if (weights.length && !weights.some(w => w.date === today)) notes.push(['Aún no registras tu peso de hoy.', '#/peso/registro', 'Registrar']);
    if (g.kcal && !dayMeals && hr >= 12) notes.push(['Aún no registras comidas hoy.', '#/comida/registro', 'Registrar']);
    const last = store.getLocal().lastBackupAt, days = last ? Math.floor((Date.now() - last) / 86400000) : null;
    if (total > 10 && (days == null || days >= 14)) notes.push([days == null ? 'Aún no descargas un respaldo de tus datos.' : 'Hace ' + days + ' días que no descargas un respaldo.', '#/datos/respaldo', 'Respaldar']);
    if (notes.length) el.appendChild(h('section', { class: 'card', 'aria-label': 'Avisos' }, h('h2', null, 'Avisos'), h('ul', { class: 'rows' }, notes.slice(0, 3).map(n => h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', null, n[0])), link(n[1], n[2]))))));

    /* Peso */
    const wc = h('section', { class: 'card' }, h('h2', null, 'Peso'));
    if (st) {
      wc.appendChild(tiles([tile('Último peso', U.fmtNum(st.last.value, 1) + ' kg', st.last.date === today ? 'de hoy' : U.fmtDate(st.last.date)), tile('Tendencia (7 d)', U.fmtNum(st.avg, 1) + ' kg', st.d7 == null ? 'aún sin comparar' : signed(st.d7, 1, 'kg') + ' en 7 días')]));
      const gm = store.get('goal', 'goal_main_weight');
      if (gm) { const left = U.round(st.avg - gm.target, 1), dd = U.daysBetween(today, gm.targetDate); wc.appendChild(h('p', { class: 'muted' }, left === 0 || (gm.target < gm.startValue ? left <= 0 : left >= 0) ? '¡Llegaste a tu meta de ' + U.fmtNum(gm.target, 1) + ' kg!' : 'Te faltan ' + U.fmtNum(Math.abs(left), 1) + ' kg para ' + U.fmtNum(gm.target, 1) + ' kg' + (dd != null && dd > 0 ? ' (' + dd + ' días hasta tu fecha)' : dd != null ? ' (la fecha ya pasó)' : '') + '.')); }
    } else wc.appendChild(h('p', { class: 'muted' }, 'Aún no hay pesos registrados.'));
    wc.appendChild(h('div', { class: 'row-end' }, link('#/peso/registro', weights.some(w => w.date === today) ? 'Ver registro' : 'Registrar peso', 'btn sm'))); el.appendChild(wc);

    /* Comida */
    const fc = h('section', { class: 'card' }, h('h2', null, 'Alimentación de hoy'));
    if (g.kcal) {
      const eaten = dayMeals ? dayMeals.kcal : 0, left = Math.round(g.kcal - eaten);
      fc.appendChild(meter('Kcal', eaten, g.kcal, 'kcal', 0)); if (g.p) fc.appendChild(meter('Proteína', dayMeals ? dayMeals.p : 0, g.p, 'g', 0));
      fc.appendChild(h('p', { class: 'muted' }, left >= 0 ? 'Te quedan ' + U.fmtNum(left, 0) + ' kcal' + (g.p && (dayMeals ? dayMeals.p : 0) < g.p ? ' y ' + U.fmtNum(Math.round(g.p - (dayMeals ? dayMeals.p : 0)), 0) + ' g de proteína.' : '.') : 'Pasaste tu objetivo por ' + U.fmtNum(-left, 0) + ' kcal.'));
    } else fc.appendChild(h('p', { class: 'muted' }, dayMeals ? 'Hoy llevas ' + U.fmtNum(dayMeals.kcal, 0) + ' kcal. Define tu objetivo para ver cuánto te queda.' : 'Define tu objetivo de kcal para ver cuánto te queda cada día.'));
    const todayCardio = sessions.filter(s => s.discipline === 'cardio' && s.date === today).reduce((t, s) => { const c = T.cardioTotals(s); return { m: t.m + c.minutes, k: t.k + c.kcal }; }, { m: 0, k: 0 });
    if (todayCardio.k) fc.appendChild(h('p', { class: 'hint' }, 'Actividad de hoy: ' + todayCardio.m + ' min y ' + U.fmtNum(todayCardio.k, 0) + ' kcal gastadas (se muestran aparte, no se descuentan de tu objetivo).'));
    fc.appendChild(h('div', { class: 'row-end' }, link(g.kcal ? '#/comida/registro' : '#/comida/objetivos', g.kcal ? 'Registrar comida' : 'Definir objetivo', 'btn sm'))); el.appendChild(fc);

    /* Pasos */
    const todaySteps = steps.filter(r => r.date === today)[0], sc = h('section', { class: 'card' }, h('h2', null, 'Pasos de hoy'));
    if (todaySteps || stepGoal) sc.appendChild(meter('Pasos', todaySteps ? todaySteps.count : 0, stepGoal, 'pasos', 0, true)); else sc.appendChild(h('p', { class: 'muted' }, 'Aún no registras pasos. Puedes anotar los de hoy y fijar una meta.'));
    sc.appendChild(h('div', { class: 'row-end' }, link('#/peso/pasos', todaySteps ? 'Ver pasos' : 'Registrar pasos', 'btn sm'))); el.appendChild(sc);

    /* Entrenamiento */
    const tc = h('section', { class: 'card' }, h('h2', null, 'Entrenamiento de hoy')), dow = now.getDay(); let any = false;
    ['halterofilia', 'pesas'].forEach(d => {
      const plan = plans.filter(p => p.discipline === d)[0], day = plan ? K.plannedDays(plan).filter(x => x.dow === dow)[0] : null, did = sessions.filter(s => s.discipline === d && s.date === today);
      if (!day && !did.length) return; any = true;
      tc.appendChild(h('div', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, W.DISC_LABEL[d] + (day ? ' · ' + day.name : '')), h('span', { class: 'hint' }, did.length ? 'Sesión hecha: ' + U.fmtNum(T.sessionStats(did[0]).tonnage, 0) + ' kg de tonelaje' : day.items.length + (day.items.length === 1 ? ' ejercicio planificado' : ' ejercicios planificados'))),
        did.length ? h('span', { class: 'status logrado' }, '✓ Hecha') : link('#/entrenos/' + d + '/hoy', 'Empezar', 'btn sm')));
    });
    if (todayCardio.m) { any = true; tc.appendChild(h('p', { class: 'muted' }, 'Cardio y otros: ' + todayCardio.m + ' min' + (todayCardio.k ? ' · ' + U.fmtNum(todayCardio.k, 0) + ' kcal' : '') + '.')); }
    if (!any) tc.appendChild(h('p', { class: 'muted' }, 'Hoy no tienes sesión planificada. Puedes registrar una igual:'));
    if (!any) tc.appendChild(h('div', { class: 'row-end wrap' }, link('#/entrenos/pesas/hoy', 'Pesas'), link('#/entrenos/halterofilia/hoy', 'Halterofilia'), link('#/entrenos/cardio/hoy', 'Cardio')));
    el.appendChild(tc);

    /* Resumen de la semana (lunes a hoy) */
    const dates = []; for (let d = week; d <= today; d = U.ymd(U.addDays(U.parseYmd(d), 1))) dates.push(d);
    const fser = F.series(meals, nutri, week, today), kOk = g.kcal ? fser.filter(s => F.dayStatus(s.total, g).ok).length : null, kLog = fser.filter(s => s.total).length;
    const sOk = stepGoal ? dates.filter(d => steps.some(r => r.date === d && r.count >= stepGoal)).length : null, wN = dates.filter(d => weights.some(w => w.date === d)).length;
    let planned = 0, done = 0, hasPlan = false; ['halterofilia', 'pesas'].forEach(d => { const plan = plans.filter(p => p.discipline === d)[0]; if (!K.plannedDays(plan).length) return; hasPlan = true; const w = K.weekStatus(plan, sessions.filter(s => s.discipline === d), week, today); planned += w.planned; done += w.done; });
    const totalSes = sessions.filter(s => s.date >= week && s.date <= today && s.discipline !== 'cardio').length, cardioMin = sessions.filter(s => s.discipline === 'cardio' && s.date >= week && s.date <= today).reduce((t, s) => t + T.cardioTotals(s).minutes, 0);
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Esta semana'), tiles([
      tile('Pesajes', wN + ' de ' + dates.length, 'días con peso'), tile('Kcal en meta', kOk == null ? '–' : kOk + ' de ' + kLog, kOk == null ? 'sin objetivo' : 'días registrados'),
      tile('Pasos en meta', sOk == null ? '–' : sOk + ' de ' + dates.length, sOk == null ? 'sin meta' : 'días'), tile('Sesiones', hasPlan ? done + ' de ' + planned : String(totalSes), hasPlan ? 'planificadas' : 'de fuerza'), tile('Cardio y otros', cardioMin + ' min')])));

    /* Rachas */
    const ls = K.logStreak(weights.map(w => w.date), today), ssn = C.stepsStats(steps, stepGoal, today), kc = g.kcal ? F.compliance(F.series(meals, nutri, U.ymd(U.addDays(U.parseYmd(today), -59)), today), g, today, 30) : null;
    let tw = 0; ['halterofilia', 'pesas'].forEach(d => { const plan = plans.filter(p => p.discipline === d)[0]; if (K.plannedDays(plan).length) tw = Math.max(tw, K.summary(K.weeks(plan, sessions.filter(s => s.discipline === d), today, 12)).streak); });
    const u = (n, a, b) => n + ' ' + (n === 1 ? a : b);
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Rachas'), tiles([tile('Pesaje', u(ls.streak, 'día', 'días'), 'mejor: ' + ls.best), tile('Kcal en meta', kc ? u(kc.streak, 'día', 'días') : '–', kc ? '' : 'sin objetivo'), tile('Pasos', stepGoal ? u(ssn.streak, 'día', 'días') : '–', stepGoal ? 'mejor: ' + ssn.best : 'sin meta'), tile('Entrenos', tw ? u(tw, 'semana', 'semanas') : '–', tw ? 'cumpliendo la rutina' : 'sin racha todavía')]),
      h('p', { class: 'hint' }, 'Ver el detalle de cumplimiento:'), h('div', { class: 'row-end wrap' }, link('#/peso/cumplimiento', 'Peso'), link('#/comida/cumplimiento', 'Comida'), link('#/entrenos/pesas/cumplimiento', 'Entrenos'))));
  });
})(window);
