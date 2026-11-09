/* Pantallas de «Entrenamientos» (fase 4), segunda parte: Plan (ejercicios, rutina semanal, proyección) y Cardio. */
(function (root) {
  'use strict';
  const A = root.App = root.App || {};
  const h = A.ui.h, field = A.ui.field, U = A.util, store = A.store, T = A.train, W = A.vw;
  const tile = W.tile, tiles = W.tiles, wrapView = W.wrapView, dateInput = W.dateInput, errBox = W.errBox, optionsOf = W.optionsOf, removeWithUndo = W.removeWithUndo, chips = W.chips, readNum = W.readNum, exOf = W.exOf, REST = W.REST, DISC_LABEL = W.DISC_LABEL;
  const numInput = (id, ph, val) => h('input', { class: 'txt', id: id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: ph || '', value: val == null ? '' : String(val).replace('.', ',') });
  const DOW = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [0, 'Domingo']], DOW_NAME = {}; DOW.forEach(x => { DOW_NAME[x[0]] = x[1]; });
  let editEx = null;

  function planView(disc) {
    wrapView('entrenos/' + disc + '/plan', (el, again) => {
      const exs = exOf(disc), sessions = store.list('session').filter(s => s.discipline === disc), getPlan = () => store.list('plan').filter(p => p.discipline === disc)[0] || null, plan = getPlan();

      /* Ejercicios */
      const ul = h('ul', { class: 'rows stack', 'aria-label': 'Ejercicios' });
      exs.forEach(e => ul.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, e.name), h('span', { class: 'hint' }, (e.max ? 'Máximo ' + U.fmtNum(e.max, 1) + ' kg' + (e.maxDate ? ' (' + U.fmtShort(e.maxDate) + ')' : '') : 'Sin máximo') + ' · descanso ' + (e.rest || REST[disc] || 90) + ' s')),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Editar ' + e.name, onclick: () => { editEx = e; again(); } }, 'Editar'),
        h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + e.name, onclick: () => removeWithUndo('exercise', e, () => store.save('exercise', e), again, 'Ejercicio eliminado. Las sesiones guardadas no cambian.') }, 'Eliminar'))));
      const exCard = h('section', { class: 'card' }, h('h2', null, 'Mis ejercicios'), exs.length ? ul : h('p', { class: 'muted' }, 'Aún no tienes ejercicios de ' + DISC_LABEL[disc].toLowerCase() + '.'));
      if (!exs.length) exCard.appendChild(h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { W.SEEDS[disc].forEach(n => store.save('exercise', { name: n, discipline: disc, meas: 'kg', rest: REST[disc] })); A.ui.toast('Ejercicios típicos agregados. Puedes editarlos o borrarlos.'); again(); } }, 'Cargar ejercicios típicos')));
      el.appendChild(exCard);
      const ed = editEx && exs.some(x => x.id === editEx.id) ? editEx : null;
      const nm = h('input', { class: 'txt', id: 'ex-name', type: 'text', maxlength: 120, value: ed ? ed.name : '', placeholder: 'Ej. Arranque' }), mx = numInput('ex-max', 'Opcional', ed ? ed.max : null), rs = numInput('ex-rest', String(REST[disc]), ed ? ed.rest : null), err = errBox();
      el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
        e.preventDefault(); err.textContent = '';
        const name = nm.value.trim(), m = readNum(mx, true), r = readNum(rs, true);
        if (!name) { err.textContent = 'Escribe el nombre del ejercicio.'; return; }
        if (m != null && (isNaN(m) || m <= 0 || m > 1000)) { err.textContent = 'El máximo debe ser un número de kilos (1 a 1.000), o quedar vacío.'; return; }
        if (r != null && (isNaN(r) || r < 10 || r > 900)) { err.textContent = 'El descanso va de 10 a 900 segundos.'; return; }
        if (exs.some(x => x.name.toLowerCase() === name.toLowerCase() && (!ed || x.id !== ed.id))) { err.textContent = 'Ya tienes un ejercicio con ese nombre.'; return; }
        try { store.save('exercise', Object.assign(ed ? { id: ed.id } : {}, { name: name, discipline: disc, meas: 'kg', max: m, maxDate: m != null ? (ed && ed.max === m && ed.maxDate ? ed.maxDate : U.today()) : null, rest: r == null ? null : Math.round(r) })); } catch (x) { err.textContent = x.message; return; }
        editEx = null; A.ui.toast(ed ? 'Ejercicio actualizado.' : 'Ejercicio agregado.'); again();
      } }, h('h3', { class: 'sub' }, ed ? 'Editar ejercicio' : 'Agregar ejercicio'), field('ex-name', 'Nombre', nm),
      h('div', { class: 'grid2' }, field('ex-max', 'Máximo (kg)', mx, 'Para calcular kilos desde un %'), field('ex-rest', 'Descanso (seg)', rs)), err,
      h('div', { class: 'row-end' }, ed ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { editEx = null; again(); } }, 'Cancelar') : null, h('button', { class: 'btn', type: 'submit' }, ed ? 'Actualizar' : 'Agregar'))));

      /* Rutina semanal */
      const mutate = fn => { const days = JSON.parse(JSON.stringify(plan ? plan.days : [])); fn(days); return store.save('plan', Object.assign(plan ? { id: plan.id } : {}, { name: 'Rutina de ' + DISC_LABEL[disc].toLowerCase(), discipline: disc, kind: 'weekly', days: days })); };
      const rt = h('section', { class: 'card' }, h('h2', null, 'Rutina semanal'));
      const days = plan ? plan.days.slice().sort((a, b) => ((a.dow + 6) % 7) - ((b.dow + 6) % 7)) : [];
      if (!days.length) rt.appendChild(h('p', { class: 'muted' }, 'Arma tu rutina: crea un día, elige en qué día de la semana va y agrégale ejercicios. Así la sesión de hoy se carga con un toque.'));
      days.forEach(day => {
        const li = h('ul', { class: 'rows stack', 'aria-label': day.name });
        day.items.forEach((pi, ix) => { const ex = store.get('exercise', pi.exId), kg = ex && pi.pct != null ? T.kgFromPct(ex.max, pi.pct) : pi.kg;
          const sug = ex && kg == null ? T.suggestNext(T.history(sessions, ex.id), pi.reps) : null;
          li.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, ex ? ex.name : '(ejercicio eliminado)'), h('span', { class: 'hint' }, (pi.sets || '?') + '×' + (pi.reps || '?') + (pi.pct != null ? ' al ' + pi.pct + ' %' + (kg != null ? ' = ' + U.fmtNum(kg, 1) + ' kg' : ' (falta el máximo)') : pi.kg != null ? ' con ' + U.fmtNum(pi.kg, 1) + ' kg' : sug ? ' · sugerido ' + U.fmtNum(sug.kg, 1) + ' kg' : ''))),
            h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Quitar ' + (ex ? ex.name : 'ejercicio') + ' de ' + day.name, onclick: () => { const before = plan; mutate(ds => { ds.filter(x => x.id === day.id)[0].items.splice(ix, 1); }); A.ui.toast('Ejercicio quitado del día.', { label: 'Deshacer', run: () => { store.save('plan', before); again(); } }); again(); } }, 'Quitar'))); });
        rt.appendChild(h('div', { class: 'slot' }, h('div', { class: 'slot-head' }, h('h3', { class: 'sub' }, DOW_NAME[day.dow] + ' · ' + day.name),
          h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar el día ' + day.name, onclick: () => { const before = plan; mutate(ds => { ds.splice(ds.findIndex(x => x.id === day.id), 1); }); A.ui.toast('Día eliminado.', { label: 'Deshacer', run: () => { store.save('plan', before); again(); } }); again(); } }, 'Eliminar día')), day.items.length ? li : h('p', { class: 'hint' }, 'Sin ejercicios.')));
      });
      el.appendChild(rt);

      /* Agregar ejercicio a un día */
      if (exs.length) {
        const daySel = h('select', { class: 'txt', id: 'pl-day' }, [h('option', { value: '' }, '+ Nuevo día')].concat(days.map(d => h('option', { value: d.id }, DOW_NAME[d.dow] + ' · ' + d.name)))), dn = h('input', { class: 'txt', id: 'pl-dname', type: 'text', maxlength: 60, placeholder: 'Ej. Día A' }), dw = h('select', { class: 'txt', id: 'pl-dow' }, optionsOf(DOW.map(x => [String(x[0]), x[1]]), '1')),
          exSel = h('select', { class: 'txt', id: 'pl-ex' }, exs.map(e => h('option', { value: e.id }, e.name))), sets = numInput('pl-sets', 'Ej. 4'), reps = numInput('pl-reps', 'Ej. 5'), how = h('select', { class: 'txt', id: 'pl-how' }, optionsOf([['none', 'Sin peso fijo (sugerir)'], ['pct', '% de mi máximo'], ['kg', 'Kilos fijos']], 'none')), val = numInput('pl-val', 'Ej. 80'), perr = errBox();
        const newBox = h('div', { class: 'grid2' }, field('pl-dname', 'Nombre del día', dn), field('pl-dow', 'Día de la semana', dw)), syncNew = () => { newBox.hidden = !!daySel.value; }; daySel.addEventListener('change', syncNew); syncNew();
        el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
          e.preventDefault(); perr.textContent = '';
          const s = readNum(sets), r = readNum(reps), v = how.value === 'none' ? null : readNum(val), ex = store.get('exercise', exSel.value);
          if (isNaN(s) || s < 1 || s > 20 || isNaN(r) || r < 1 || r > 100) { perr.textContent = 'Series (1 a 20) y repeticiones (1 a 100) deben ser números.'; return; }
          if (how.value !== 'none' && (isNaN(v) || v <= 0 || (how.value === 'pct' && v > 150) || v > 1000)) { perr.textContent = how.value === 'pct' ? 'El porcentaje va de 1 a 150.' : 'Escribe los kilos como número.'; return; }
          if (how.value === 'pct' && ex && !ex.max) { perr.textContent = 'Para usar un %, define primero el máximo de «' + ex.name + '» en Mis ejercicios.'; return; }
          if (!daySel.value && !dn.value.trim()) { perr.textContent = 'Ponle un nombre al día nuevo.'; return; }
          const item = { exId: exSel.value, sets: Math.round(s), reps: Math.round(r) }; if (how.value === 'pct') item.pct = v; if (how.value === 'kg') item.kg = v;
          mutate(ds => { let d = ds.filter(x => x.id === daySel.value)[0]; if (!d) { d = { id: U.uid(), name: dn.value.trim(), dow: +dw.value, items: [] }; ds.push(d); } d.items.push(item); });
          A.ui.toast('Agregado a la rutina.'); again();
        } }, h('h3', { class: 'sub' }, 'Agregar a la rutina'), field('pl-day', 'Día', daySel), newBox, field('pl-ex', 'Ejercicio', exSel),
        h('div', { class: 'grid2' }, field('pl-sets', 'Series', sets), field('pl-reps', 'Repeticiones', reps)), h('div', { class: 'grid2' }, field('pl-how', 'Carga', how), field('pl-val', 'Valor', val)), perr,
        h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit' }, 'Agregar'))));
      }

      /* Proyección de pesos */
      const rows = exs.map(e => { const hist = T.history(sessions, e.id); if (!hist.length) return null; const last = hist[hist.length - 1], pj = T.projectE1rm(hist, 8), pi = plan ? [].concat.apply([], plan.days.map(d => d.items)).filter(i => i.exId === e.id)[0] : null, sug = T.suggestNext(hist, pi ? pi.reps : null);
        return h('tr', null, h('th', { scope: 'row' }, e.name), h('td', null, U.fmtNum(last.topKg, 1) + ' kg'), h('td', null, sug ? U.fmtNum(sug.kg, 1) + ' kg' : '–'), h('td', null, pj ? W.signed(pj.perWeek, 1, 'kg/sem') + ' → ' + U.fmtNum(pj.at, 1) + ' kg' : '–')); }).filter(Boolean);
      if (rows.length) el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Proyección de pesos'), h('p', { class: 'hint' }, 'Sugerido: sube 2,5 kg si en la última sesión lograste las repeticiones del plan con esfuerzo hasta 9. Proyección: tendencia de tu 1RM estimado a 8 semanas (necesita 3 sesiones en 2 semanas o más).'),
        h('div', { class: 'dt-scroll' }, h('table', { class: 'dt' }, h('thead', null, h('tr', null, ['Ejercicio', 'Último', 'Próximo', '1RM en 8 sem'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, rows)))));
    });
  }

  /* ---------- Cardio y otras actividades ---------- */
  const ACTS = ['Caminata', 'Trote', 'Bicicleta', 'Natación', 'Elíptica', 'Fútbol', 'Otra'];
  const paceTxt = p => { const m = Math.floor(p), sec = Math.round((p - m) * 60); return (sec === 60 ? m + 1 : m) + ':' + String(sec === 60 ? 0 : sec).padStart(2, '0'); };
  const cardio = () => store.list('session').filter(s => s.discipline === 'cardio');
  wrapView('entrenos/cardio/hoy', (el, again) => {
    const today = U.today(), dIn = dateInput('cd-date', today), act = h('select', { class: 'txt', id: 'cd-act' }, optionsOf(ACTS.map(a => [a, a]), 'Caminata')), other = h('input', { class: 'txt', id: 'cd-other', type: 'text', maxlength: 60, placeholder: 'Ej. Pádel' }), mins = numInput('cd-min', 'Ej. 40'), km = numInput('cd-km', 'Opcional'), kc = numInput('cd-kcal', 'Opcional'), rpe = numInput('cd-rpe', '0 a 10'), err = errBox();
    const otherF = field('cd-other', '¿Qué hiciste?', other), sync = () => { otherF.hidden = act.value !== 'Otra'; }; act.addEventListener('change', sync); sync();
    el.appendChild(h('form', { class: 'card form', novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = '';
      const m = readNum(mins), k = readNum(km, true), c = readNum(kc, true), r = readNum(rpe, true), name = act.value === 'Otra' ? other.value.trim() : act.value;
      if (!U.isYmd(dIn.value) || dIn.value > today) { err.textContent = 'La fecha no es válida.'; return; }
      if (!name) { err.textContent = 'Escribe qué actividad hiciste.'; return; }
      if (isNaN(m) || m < 1 || m > 1440) { err.textContent = 'La duración va de 1 a 1.440 minutos.'; return; }
      if ((k != null && (isNaN(k) || k < 0 || k > 1000)) || (c != null && (isNaN(c) || c < 0 || c > 20000))) { err.textContent = 'Distancia y kcal deben ser números, o quedar vacías.'; return; }
      if (r != null && (isNaN(r) || r < 0 || r > 10)) { err.textContent = 'El esfuerzo va de 0 a 10.'; return; }
      try { store.save('session', { discipline: 'cardio', date: dIn.value, mode: 'quick', items: [{ activity: name, minutes: Math.round(m), km: k, kcal: c == null ? null : Math.round(c) }], rpe: r }); } catch (x) { err.textContent = x.message; return; }
      A.ui.toast('Actividad guardada.'); again();
    } }, h('h2', null, 'Registrar actividad'), field('cd-date', 'Fecha', dIn), field('cd-act', 'Actividad', act), otherF,
    h('div', { class: 'grid2' }, field('cd-min', 'Duración (min)', mins), field('cd-km', 'Distancia (km)', km)), h('div', { class: 'grid2' }, field('cd-kcal', 'Kcal gastadas', kc, 'Si tu reloj las da'), field('cd-rpe', 'Esfuerzo (RPE)', rpe)), err,
    h('div', { class: 'row-end' }, h('button', { class: 'btn', type: 'submit' }, 'Guardar'))));
    const recent = cardio().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 3);
    if (recent.length) el.appendChild(h('section', { class: 'card' }, h('h3', { class: 'sub' }, 'Últimas actividades'), h('ul', { class: 'rows' }, recent.map(s => { const it = s.items[0], t = T.cardioTotals(s); return h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, it.activity), h('span', { class: 'hint' }, U.fmtDate(s.date) + (t.km > 0 && t.minutes ? ' · ritmo ' + paceTxt(t.minutes / t.km) + ' /km' : ''))), h('strong', null, t.minutes + ' min' + (t.km ? ' · ' + U.fmtNum(t.km, 1) + ' km' : ''))); }))));
  });
  wrapView('entrenos/cardio/progreso', (el, again) => {
    const today = U.today(), ss = cardio();
    if (!ss.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin datos todavía'), h('p', { class: 'muted' }, 'Registra una actividad para ver tu tiempo y distancia por semana.'), h('a', { class: 'btn', href: '#/entrenos/cardio/hoy' }, 'Registrar actividad'))); return; }
    const wk = T.cardioWeekly(ss, today), cur = wk.filter(w => w.week === T.weekOf(today))[0] || { minutes: 0, km: 0, sessions: 0, kcal: 0 }, last8 = wk.slice(-8);
    el.appendChild(tiles([tile('Esta semana', cur.minutes + ' min', cur.sessions + (cur.sessions === 1 ? ' actividad' : ' actividades')), tile('Distancia', U.fmtNum(cur.km, 1) + ' km', 'esta semana'), tile('Kcal gastadas', cur.kcal ? U.fmtNum(cur.kcal, 0) : '–', 'las que anotaste'), tile('Semana anterior', (wk[wk.length - 2] ? wk[wk.length - 2].minutes : 0) + ' min')]));
    const grp = {}; ss.forEach(x => { const t = T.cardioTotals(x), a = (x.items[0] || {}).activity; if (a && t.km > 0 && t.minutes) (grp[a] = grp[a] || []).push({ date: x.date, p: t.minutes / t.km }); });
    const best = Object.keys(grp).sort((a, b) => grp[b].length - grp[a].length)[0], gl = best && grp[best].length > 1 ? grp[best].sort((a, b) => a.date < b.date ? -1 : 1) : null;
    if (gl) { const f = gl[0], l = gl[gl.length - 1], wks = Math.max(1, Math.round(U.daysBetween(f.date, l.date) / 7)); if (Math.abs(l.p - f.p) >= 0.05) el.appendChild(h('p', { class: 'coach-s' }, (l.p < f.p ? 'Bajaste' : 'Subiste') + ' el ritmo de ' + paceTxt(f.p) + ' a ' + paceTxt(l.p) + ' por km en ' + wks + (wks === 1 ? ' semana' : ' semanas') + ' (' + best + ').')); }
    const mk = (title, key, unit, d) => { const host = h('div'); el.appendChild(h('section', { class: 'card' }, h('h2', null, title), host)); A.charts.bars(host, { ariaLabel: 'Gráfico de columnas: ' + title.toLowerCase() + ', últimas ' + last8.length + ' semanas.', unit: unit, decimals: d, name: title, pts: last8.map(w => ({ label: U.fmtShort(w.week), y: w[key], tip: 'Semana del ' + U.fmtShort(w.week) + ' · ' + w.sessions + (w.sessions === 1 ? ' actividad' : ' actividades') })) }); };
    mk('Minutos por semana', 'minutes', 'min', 0); if (last8.some(w => w.km > 0)) mk('Distancia por semana', 'km', 'km', 1);
  });
  let cShown = 20;
  wrapView('entrenos/cardio/historial', (el, again) => {
    const all = cardio().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (b.updatedAt || 0) - (a.updatedAt || 0));
    if (!all.length) { el.appendChild(h('section', { class: 'card empty' }, h('h2', null, 'Sin actividades todavía'), h('a', { class: 'btn', href: '#/entrenos/cardio/hoy' }, 'Registrar actividad'))); return; }
    const ul = h('ul', { class: 'rows stack', 'aria-label': 'Actividades' });
    all.slice(0, cShown).forEach(s => { const it = s.items[0] || {}, t = T.cardioTotals(s); ul.appendChild(h('li', { class: 'row' }, h('div', { class: 'row-main' }, h('span', { class: 'row-t' }, it.activity), h('span', { class: 'hint' }, U.fmtDate(s.date) + (t.kcal ? ' · ' + t.kcal + ' kcal' : '') + (s.rpe != null ? ' · RPE ' + U.fmtNum(s.rpe, 1) : ''))), h('strong', null, t.minutes + ' min' + (t.km ? ' · ' + U.fmtNum(t.km, 1) + ' km' : '')),
      h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Eliminar ' + it.activity + ' del ' + U.fmtDate(s.date), onclick: () => removeWithUndo('session', s, () => store.save('session', s), again, 'Actividad eliminada.') }, 'Eliminar'))); });
    el.appendChild(h('section', { class: 'card' }, h('h2', null, 'Actividades anteriores'), ul, all.length > cShown ? h('div', { class: 'row-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { cShown += 20; again(); } }, 'Mostrar más')) : null));
  });

  planView('halterofilia'); planView('pesas');
})(window);
